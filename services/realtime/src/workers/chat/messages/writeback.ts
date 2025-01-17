import { gqlClient } from "@midspace/component-clients/graphqlClient";
import { redlock } from "@midspace/component-clients/redis";
import { CombinedError } from "@urql/core";
import type { ConsumeMessage } from "amqplib";
import { gql } from "graphql-tag";
import type {
    Chat_Message_Insert_Input,
    DeleteChatMessagesMutation,
    DeleteChatMessagesMutationVariables,
    InsertChatMessagesMutation,
    InsertChatMessagesMutationVariables,
    UpdateChatMessageMutation,
    UpdateChatMessageMutationVariables,
} from "../../../generated/graphql";
import {
    DeleteChatMessagesDocument,
    InsertChatMessagesDocument,
    UpdateChatMessageDocument,
} from "../../../generated/graphql";
import { logger } from "../../../lib/logger";
import {
    onWritebackMessage,
    onWritebackMessagesComplete,
    onWritebackMessagesFail,
} from "../../../rabbitmq/chat/messages";
import { MessageWritebackIntervalMs, MessageWritebackQueueSize } from "../../../rabbitmq/chat/params";
import type { Action, Message } from "../../../types/chat";

logger.info("Chat messages writeback worker running");

type UnackedMessageInfo = {
    rabbitMQMsg: ConsumeMessage;
    actionMsg: Message;
};

type Delayed<T> = T & {
    delayUntil: number;
};

// Note: We cannot assume that inserts, updates and deletes will be processed in
// order. They must account for out-of-order processing and recovery
let insertQueue: UnackedMessageInfo[] = [];
let updateQueue: Delayed<UnackedMessageInfo>[] = [];
let deleteQueue: Delayed<UnackedMessageInfo>[] = [];

const queuesLockKey = `locks:writebackMessages:${process.env.DYNO}`;

gql`
    mutation InsertChatMessages($objects: [chat_Message_insert_input!]!) {
        insert_chat_Message(
            objects: $objects
            on_conflict: { constraint: Message_sId_key, update_columns: [updated_at] }
        ) {
            returning {
                sId
            }
        }
    }

    mutation UpdateChatMessage($messageId: uuid!, $object: chat_Message_set_input!) {
        update_chat_Message(where: { sId: { _eq: $messageId } }, _set: $object) {
            returning {
                sId
            }
        }
    }

    mutation DeleteChatMessages($messageIds: [uuid!]!) {
        delete_chat_Message(where: { sId: { _in: $messageIds } }) {
            returning {
                sId
            }
        }
    }
`;

async function processInsertQueue() {
    const insertObjects = insertQueue.map<Chat_Message_Insert_Input>((msg) => ({
        chatId: msg.actionMsg.chatId,
        data: msg.actionMsg.data,
        duplicatedMessageSId: msg.actionMsg.duplicatedMessageSId,
        isPinned: msg.actionMsg.isPinned,
        message: msg.actionMsg.message,
        sId: msg.actionMsg.sId,
        senderId: msg.actionMsg.senderId,
        systemId: msg.actionMsg.systemId,
        type: msg.actionMsg.type,
    }));

    if (insertObjects.length === 0) {
        return;
    }

    try {
        const response = await gqlClient
            ?.mutation<InsertChatMessagesMutation, InsertChatMessagesMutationVariables>(InsertChatMessagesDocument, {
                objects: insertObjects,
            })
            .toPromise();
        if (!response) {
            throw new Error("No response / no gqlClient");
        } else if (response.error) {
            throw response.error;
        }

        const results = insertQueue.map((original) => ({
            sId: original.actionMsg.sId,
            rabbitMQMsg: original.rabbitMQMsg,
            ok: !!response.data?.insert_chat_Message?.returning.some((x) => x.sId === original.actionMsg.sId),
        }));
        const acks = results.filter((x) => x.ok).map((x) => x.rabbitMQMsg);
        const nacks = results.filter((x) => !x.ok).map((x) => x.rabbitMQMsg);

        insertQueue = [];

        try {
            onWritebackMessagesComplete(acks);
        } catch (error: any) {
            logger.error(
                { error },
                "Error acknowleding to RabbitMQ chat messages that were successfully written into the DB"
            );
        }

        if (nacks.length > 0) {
            logger.error(
                "Somehow Hasura returned a partial insert failure when writing back chat messages?!",
                nacks.length + " failures"
            );
            try {
                onWritebackMessagesFail(nacks);
            } catch (error: any) {
                logger.error(
                    { error },
                    "Error not-acknowleding to RabbitMQ chat messages that could not be written into the DB"
                );
            }
        }
    } catch (error: any) {
        let wasNetworkError: boolean;
        if (error instanceof CombinedError) {
            if (error.networkError) {
                wasNetworkError = true;
            } else if (error.graphQLErrors) {
                wasNetworkError = false;
            } else {
                wasNetworkError = false;
            }
        } else {
            wasNetworkError = false;
        }

        if (wasNetworkError) {
            logger.error({ error }, "Writeback of chat messages failed due to network error");
            insertQueue = [];
            onWritebackMessagesFail(insertQueue.map((x) => x.rabbitMQMsg));
        } else {
            const responses = await Promise.all(
                insertObjects.map(async (obj) => {
                    try {
                        const resp = await gqlClient
                            ?.mutation<InsertChatMessagesMutation, InsertChatMessagesMutationVariables>(
                                InsertChatMessagesDocument,
                                {
                                    objects: [obj],
                                }
                            )
                            .toPromise();
                        if (!resp) {
                            throw new Error("No response / no gqlClient");
                        } else if (resp.error) {
                            throw resp.error;
                        }
                        return { ...resp, sId: obj.sId };
                    } catch (error: any) {
                        return {
                            sId: obj.sId,
                            errors: [error],
                        };
                    }
                })
            );

            const results = insertQueue.map((original) => ({
                sId: original.actionMsg.sId,
                rabbitMQMsg: original.rabbitMQMsg,
                response: responses.find((response) => response.sId === original.actionMsg.sId),
            }));
            const acks = results.filter((x) => !x.response?.errors);
            const nacks = results.filter((x) => !!x.response?.errors);

            insertQueue = [];

            try {
                onWritebackMessagesComplete(acks.map((x) => x.rabbitMQMsg));
            } catch (error: any) {
                logger.error(
                    { error },
                    "Error acknowleding to RabbitMQ chat messages that were successfully written into the DB"
                );
            }

            if (nacks.length > 0) {
                logger.error(
                    "Failed to write back some individual chat messages into the database",
                    nacks.length + " failures"
                );
                nacks.forEach((x) =>
                    logger.error({ response: x.response }, "Individual chat message writeback failure")
                );
                // TODO: Send email to system alerts address
                try {
                    // At this point, we just have to give up on them. We've logged the failure and
                    // it's time to drop these from the queue lest we end up in infinite re-attempts
                    onWritebackMessagesComplete(nacks.map((x) => x.rabbitMQMsg));
                } catch (error: any) {
                    logger.error(
                        { error },
                        "Error not-acknowleding to RabbitMQ chat messages that could not be written into the DB"
                    );
                }
            }
        }
    }
}

/* On the topic of detecting updates and deletes for messages that are yet to be
 * inserted.
 *
 * We assume that updates and deletes are valid: i.e. that if they are invalid
 * they will either have been denied at the inbound permissions check or they
 * will eventually be dropped due to persistent failure (because perhaps they
 * refer to a message that failed to insert).
 *
 * We know that valid updates and deletes will have been generated (by clients)
 * after the target message was sent via an insert action. However, the insert
 * action may currently reside in another worker's queue (i.e. not yet be
 * written into the database).
 *
 * An update may come after a delete (due to client races and/or lag) in which
 * case it can be treated like an invalid update. This means it will eventually
 * be dropped / ignored due to persistent failure.
 *
 * Thus remains only the situation that a valid update or delete is being
 * processed for a message that is yet to be inserted. Since the insert must be
 * residing in another worker's queue, and we know queues are processed at least
 * every `MessageWritebackIntervalMs` milliseconds, we know the message will be
 * inserted (or the insert will fail outright) within
 * `2 * MessageWritebackIntervalMs` milliseconds.
 *
 * We attempt each update or delete and compare whether it had an effect on the
 * target row. If it did, good, we ack and complete. Otherwise, if this is the
 * first attempt, we put it into a delayed processing queue with a target
 * processing time set to `2 * MessageWritebackIntervalMs`. When the update or
 * delete is processed from this queue, we always ack it with RabbitMQ. If the
 * update or delete continues to fail, we drop it and log the event (but not as
 * an error).
 */

async function processUpdateQueue() {
    const now = Date.now();
    const processNow = updateQueue.filter((x) => x.delayUntil <= now);
    const deferred: Delayed<UnackedMessageInfo>[] = updateQueue.filter((x) => x.delayUntil > now);

    const completed: Delayed<UnackedMessageInfo>[] = [];
    const failedFirst: Delayed<UnackedMessageInfo>[] = [];
    const failedSecond: Delayed<UnackedMessageInfo>[] = [];

    for (const updateAction of processNow) {
        try {
            const response = await gqlClient
                ?.mutation<UpdateChatMessageMutation, UpdateChatMessageMutationVariables>(UpdateChatMessageDocument, {
                    messageId: updateAction.actionMsg.sId,
                    object: updateAction.actionMsg,
                })
                .toPromise();

            if (response?.data?.update_chat_Message?.returning?.some((x) => x.sId === updateAction.actionMsg.sId)) {
                completed.push(updateAction);
            } else {
                if (updateAction.delayUntil === -1) {
                    failedFirst.push(updateAction);
                } else {
                    failedSecond.push(updateAction);
                }
            }
        } catch (error: any) {
            logger.error({ error }, "Error processing chat message update: ");
        }
    }

    try {
        await onWritebackMessagesComplete(completed.map((x) => x.rabbitMQMsg));
    } catch (error: any) {
        logger.error({ error }, "Error ack'ing completed chat message updates: ");
    }
    try {
        await onWritebackMessagesComplete(failedSecond.map((x) => x.rabbitMQMsg));
    } catch (error: any) {
        logger.error({ error }, "Error ack'ing second-failure chat message updates: ");
    }

    updateQueue = [
        ...deferred,
        ...failedFirst.map((x) => ({
            ...x,
            delayUntil: now + 2 * MessageWritebackIntervalMs,
        })),
    ];
}

async function processDeleteQueue() {
    const now = Date.now();
    const processNow = deleteQueue.filter((x) => x.delayUntil <= now);
    const deferred: Delayed<UnackedMessageInfo>[] = deleteQueue.filter((x) => x.delayUntil > now);

    let completed: Delayed<UnackedMessageInfo>[] = [];
    let failedFirst: Delayed<UnackedMessageInfo>[] = [];
    let failedSecond: Delayed<UnackedMessageInfo>[] = [];

    try {
        if (processNow.length > 0) {
            const response = await gqlClient
                ?.mutation<DeleteChatMessagesMutation, DeleteChatMessagesMutationVariables>(
                    DeleteChatMessagesDocument,
                    {
                        messageIds: processNow.map((x) => x.actionMsg.sId),
                    }
                )
                .toPromise();

            completed = processNow.filter(
                (deleteAction) =>
                    !!response?.data?.delete_chat_Message?.returning?.some((x) => x.sId === deleteAction.actionMsg.sId)
            );
            failedFirst = processNow.filter(
                (deleteAction) =>
                    !response?.data?.delete_chat_Message?.returning?.some(
                        (x) => x.sId === deleteAction.actionMsg.sId
                    ) && deleteAction.delayUntil === -1
            );
            failedSecond = processNow.filter(
                (deleteAction) =>
                    !response?.data?.delete_chat_Message?.returning?.some(
                        (x) => x.sId === deleteAction.actionMsg.sId
                    ) && deleteAction.delayUntil !== -1
            );
        }
    } catch (error: any) {
        logger.error({ error }, "Error processing chat message delete: ");
    }

    try {
        await onWritebackMessagesComplete(completed.map((x) => x.rabbitMQMsg));
    } catch (error: any) {
        logger.error({ error }, "Error ack'ing completed chat message deletes: ");
    }
    try {
        await onWritebackMessagesComplete(failedSecond.map((x) => x.rabbitMQMsg));
    } catch (error: any) {
        logger.error({ error }, "Error ack'ing second-failure chat message deletes: ");
    }

    deleteQueue = [
        ...deferred,
        ...failedFirst.map((x) => ({
            ...x,
            delayUntil: now + 2 * MessageWritebackIntervalMs,
        })),
    ];
}

let lastProcessQueuesTime = 0;
async function processQueues(proceedWithPartial: boolean) {
    // We need to sum of the queue sizes because that is the number waiting acknowledgment
    // in RabbitMQ (the prefetch size)
    const totalQueueSize = insertQueue.length + updateQueue.length + deleteQueue.length;

    proceedWithPartial = proceedWithPartial && Date.now() - lastProcessQueuesTime >= MessageWritebackIntervalMs - 100;

    if (totalQueueSize > 0 && (proceedWithPartial || totalQueueSize >= MessageWritebackQueueSize)) {
        const lease = await redlock.acquire(queuesLockKey, 180000);
        lastProcessQueuesTime = Date.now();
        try {
            logger.info(`Writing back messages:
    * Total queue size: ${totalQueueSize}
    * Proceed with partial: ${proceedWithPartial}

    - Insert    ${insertQueue.length}
    - Update    ${updateQueue.length}
    - Delete    ${deleteQueue.length}
`);
            await processInsertQueue();
            await processUpdateQueue();
            await processDeleteQueue();
        } catch (error: any) {
            logger.error({ error }, "Error writing back queues (some messages may now be stuck!)");
        } finally {
            await lease.unlock();
        }
    }
}

async function onMessage(rabbitMQMsg: ConsumeMessage, action: Action<Message>) {
    // logger.info("Message for writeback", message);

    let ok = false;
    try {
        const lease = await redlock.acquire(queuesLockKey, 60000);
        try {
            switch (action.op) {
                case "INSERT":
                    insertQueue.push({ rabbitMQMsg, actionMsg: action.data });
                    break;
                case "UPDATE":
                    // Note: The delayUntil must be -1 for the update algorithm to work
                    updateQueue.push({ rabbitMQMsg, actionMsg: action.data, delayUntil: -1 });
                    break;
                case "DELETE":
                    // Note: The delayUntil must be -1 for the delete algorithm to work
                    deleteQueue.push({ rabbitMQMsg, actionMsg: action.data, delayUntil: -1 });
                    break;
            }

            ok = true;
        } finally {
            await lease.unlock();
        }
    } catch (error: any) {
        logger.error({ error }, "Erroring process chat message: writeback.onMessage");

        await onWritebackMessagesFail([rabbitMQMsg]);
    }

    if (ok) {
        await processQueues(false);
    }
}

async function Main() {
    onWritebackMessage(onMessage);

    setInterval(() => {
        processQueues(true);
    }, MessageWritebackIntervalMs);
}

Main();
