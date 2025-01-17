import { ChatCache } from "@midspace/caches/chat";
import { ConferenceCache } from "@midspace/caches/conference";
import { chatPinsCache } from "@midspace/caches/pin";
import { ReadUpToIndexCache } from "@midspace/caches/readUpToIndex";
import { RegistrantCache } from "@midspace/caches/registrant";
import type { RoomEntity } from "@midspace/caches/room";
import { RoomCache } from "@midspace/caches/room";
import { chatSubscriptionsCache } from "@midspace/caches/subscription";
import { redisClientP, redisClientPool } from "@midspace/component-clients/redis";
import { Chat_MessageType_Enum, Room_ManagementMode_Enum } from "../../../generated/graphql";
import { chatListenersKeyName, generateChatRecentMessagesSetKey, generateChatRoomName } from "../../../lib/chat";
import { logger } from "../../../lib/logger";
import { sendNotifications } from "../../../lib/notifications";
import { maxUnreadMessages, sendUnreadCount } from "../../../lib/unreadCounts";
import { onDistributionMessage } from "../../../rabbitmq/chat/messages";
import { emitter } from "../../../socket-emitter/socket-emitter";
import type { Action, Message } from "../../../types/chat";

logger.info("Chat messages distribution worker running");

async function onMessage(action: Action<Message>) {
    const eventName =
        action.op === "INSERT"
            ? "receive"
            : action.op === "UPDATE"
            ? "update"
            : action.op === "DELETE"
            ? "delete"
            : "unknown";

    const chatId = action.data.chatId;

    const client = await redisClientPool.acquire("workers/chat/messages/distribution/onMessage");
    let clientReleased = false;
    try {
        if (
            action.op === "INSERT" &&
            action.data.type !== Chat_MessageType_Enum.DuplicationMarker &&
            action.data.type !== Chat_MessageType_Enum.Emote
        ) {
            const redisSetKey = generateChatRecentMessagesSetKey(chatId);
            await redisClientP.zadd(client)(redisSetKey, Date.parse(action.data.created_at), action.data.sId);
            await redisClientP.zremrangebyrank(client)(redisSetKey, 0, -(1 + maxUnreadMessages));
        } else if (action.op === "DELETE") {
            const redisSetKey = generateChatRecentMessagesSetKey(chatId);
            await redisClientP.zrem(client)(redisSetKey, action.data.sId);
        }

        redisClientPool.release("workers/chat/messages/distribution/onMessage", client);
        clientReleased = true;

        emitter.to(generateChatRoomName(chatId)).emit(`chat.messages.${eventName}`, action.data);

        if (
            action.data.type !== Chat_MessageType_Enum.DuplicationMarker &&
            action.data.type !== Chat_MessageType_Enum.Emote
        ) {
            if (action.op === "INSERT") {
                await new Promise<unknown>((resolve, reject) => {
                    setTimeout(
                        () =>
                            Promise.all([
                                distributeMessageToSubscribedUsers(action),
                                updateRecentMessagesAndUnreadCounts(action),
                            ])
                                .then(resolve)
                                .catch(reject),
                        1500
                    );
                });
            } else if (action.op === "DELETE") {
                await new Promise<unknown>((resolve, reject) => {
                    setTimeout(() => updateRecentMessagesAndUnreadCounts(action).then(resolve).catch(reject), 1500);
                });
            }
        }
    } finally {
        if (!clientReleased) {
            redisClientPool.release("workers/chat/messages/distribution/onMessage", client);
        }
    }
}

async function updateRecentMessagesAndUnreadCounts(action: Action<Message>) {
    const chatId = action.data.chatId;

    const pins = await chatPinsCache(logger).getEntity(chatId);
    if (pins) {
        const infos = await Promise.all(
            Object.keys(pins).map((registrantId) => new RegistrantCache(logger).getEntity(registrantId))
        );
        const senderInfo = infos.find((x) => x?.id === action.data.senderId);
        if (senderInfo?.userId) {
            await new ReadUpToIndexCache(logger).setField(chatId, senderInfo.userId, action.data.sId);
        }
        const pinnedUserIds = new Set(infos.filter((x) => !!x?.userId).map((x) => x?.userId) as string[]);

        await Promise.all(
            [...pinnedUserIds].map(
                (userId) =>
                    new Promise<void>((resolve, reject) => {
                        setTimeout(() => {
                            sendUnreadCount(chatId, userId).then(resolve).catch(reject);
                        }, Math.random() * 1000);
                    })
            )
        );
    }
}

async function distributeMessageToSubscribedUsers(action: Action<Message>) {
    const chatId = action.data.chatId;

    const subscriptions = await chatSubscriptionsCache(logger).getEntity(chatId);
    if (subscriptions) {
        const client = await redisClientPool.acquire(
            "workers/chat/messages/distribution/distributeMessageToSubscribedUsers"
        );
        let clientReleased = false;
        try {
            const listenerUserIds = (await redisClientP.smembers(client)(chatListenersKeyName(chatId))).map(
                (x) => x.split("¬")[1]
            );

            redisClientPool.release("workers/chat/messages/distribution/distributeMessageToSubscribedUsers", client);
            clientReleased = true;

            const subscribedRegistrantIds = Object.keys(subscriptions).filter((x) => x !== action.data.senderId);
            const subscribedUserIds = new Set(
                (
                    await Promise.all(
                        subscribedRegistrantIds.map((registrantId) =>
                            new RegistrantCache(logger).getEntity(registrantId)
                        )
                    )
                )
                    .filter((x) => !!x?.userId && !listenerUserIds.includes(x.userId))
                    .map((x) => x?.userId) as string[]
            );

            const chatInfo = await new ChatCache(logger).getEntity(chatId);
            if (chatInfo) {
                const roomId = chatInfo.roomId;
                let registrantDisplayName: string | undefined;
                let room: RoomEntity | undefined;
                if (roomId) {
                    room = await new RoomCache(logger).getEntity(roomId);
                    registrantDisplayName =
                        (!room || room.managementModeName === Room_ManagementMode_Enum.Dm) && action.data.senderId
                            ? await new RegistrantCache(logger).getField(action.data.senderId, "displayName")
                            : undefined;
                }

                const chatName = room?.name ?? "";
                const conference = await new ConferenceCache(logger).getEntity(chatInfo.conferenceId);

                if (conference) {
                    sendNotifications(subscribedUserIds, {
                        description: action.data.message,
                        title:
                            (conference?.shortName ? conference.shortName + ": " : "") +
                            `New ${
                                action.data.type === Chat_MessageType_Enum.Message
                                    ? "message"
                                    : action.data.type === Chat_MessageType_Enum.Answer
                                    ? "answer"
                                    : action.data.type === Chat_MessageType_Enum.Question
                                    ? "question"
                                    : action.data.type === Chat_MessageType_Enum.Emote
                                    ? "emote"
                                    : action.data.type === Chat_MessageType_Enum.DuplicationMarker
                                    ? "event"
                                    : "message"
                            }`,
                        chatId,
                        linkURL: `/conference/${conference.slug}/chat/${chatId}`,
                        subtitle: registrantDisplayName ? `from ${registrantDisplayName}` : `in ${chatName}`,
                    });
                }
            }
        } finally {
            if (!clientReleased) {
                redisClientPool.release(
                    "workers/chat/messages/distribution/distributeMessageToSubscribedUsers",
                    client
                );
            }
        }
    }
}

async function Main() {
    onDistributionMessage(onMessage);
}

Main();
