import { downlink, uplink } from "@midspace/component-clients/rabbitmq";
import type { Channel, ConsumeMessage } from "amqplib";
import { Mutex } from "async-mutex";
import { is } from "typescript-is";
import { logger } from "../../lib/logger";
import { canIUDMessage } from "../../lib/permissions";
import type { Action, Message } from "../../types/chat";
import { MessageDistributionQueueSize, MessageWritebackQueueSize } from "./params";

const exchange = "chat.messages";
const exchangeParams = {
    autoDelete: false,
    durable: true,
};

let _uplinkChannel: Channel;
const uplinkChannelMutex = new Mutex();
async function uplinkChannel() {
    const release = await uplinkChannelMutex.acquire();
    try {
        if (!_uplinkChannel) {
            const connection = await uplink();
            _uplinkChannel = await connection.createChannel();
            await _uplinkChannel.assertExchange(exchange, "topic", exchangeParams);
        }
    } finally {
        release();
    }
    return _uplinkChannel;
}

const distributionQueue = `${exchange}.distribution`;
const writebackQueue = `${exchange}.writeback`;

let _distributionDownlinkChannel: Channel;
const distributionDownChannelMutex = new Mutex();
async function distributionDownlinkChannel() {
    const release = await distributionDownChannelMutex.acquire();
    try {
        if (!_distributionDownlinkChannel) {
            const connection = await downlink();
            _distributionDownlinkChannel = await connection.createChannel();

            await _distributionDownlinkChannel.assertExchange(exchange, "topic", exchangeParams);
        }
    } finally {
        release();
    }
    return _distributionDownlinkChannel;
}

let _writebackDownlinkChannel: Channel;
const writebackDownChannelMutex = new Mutex();
async function writebackDownlinkChannel() {
    const release = await writebackDownChannelMutex.acquire();
    try {
        if (!_writebackDownlinkChannel) {
            const connection = await downlink();
            _writebackDownlinkChannel = await connection.createChannel();

            await _writebackDownlinkChannel.assertExchange(exchange, "topic", exchangeParams);
        }
    } finally {
        release();
    }
    return _writebackDownlinkChannel;
}

async function distributionDownChannel() {
    const channel = await distributionDownlinkChannel();
    channel.prefetch(MessageDistributionQueueSize);
    await channel.assertQueue(distributionQueue, {
        autoDelete: true,
        durable: false,
    });
    await channel.bindQueue(distributionQueue, exchange, "*");
    return channel;
}

async function writebackDownChannel() {
    const channel = await writebackDownlinkChannel();
    // Prefetch enables us to fetch N messages before we have to ack some to receive more messages
    channel.prefetch(MessageWritebackQueueSize);
    await _writebackDownlinkChannel.assertQueue(writebackQueue, {
        autoDelete: false,
        durable: true,
    });
    await _writebackDownlinkChannel.bindQueue(writebackQueue, exchange, "*");
    return channel;
}

export async function action(action: Action<Message>, userId: string): Promise<boolean> {
    if (await canIUDMessage(userId, action.data.chatId)) {
        if (action.op === "INSERT") {
            if ("id" in action.data) {
                delete (action.data as any).id;
            }

            action.data.created_at = new Date().toISOString();
        }
        action.data.updated_at = new Date().toISOString();

        return publishAction(action);
    }
    return false;
}

export async function publishAction(action: Action<Message>): Promise<boolean> {
    const channel = await uplinkChannel();
    return channel.publish(exchange, action.data.chatId, Buffer.from(JSON.stringify(action)), {
        persistent: true,
    });
}

export async function onDistributionMessage(handler: (message: Action<Message>) => Promise<void>): Promise<void> {
    const channel = await distributionDownChannel();
    channel.consume(distributionQueue, (rabbitMQMsg) => {
        try {
            if (rabbitMQMsg) {
                // Ack immediately
                channel.ack(rabbitMQMsg);

                const message = JSON.parse(rabbitMQMsg.content.toString());
                if (is<Action<Message>>(message)) {
                    handler(message);
                } else {
                    logger.warn(
                        { message },
                        "Invalid chat message received. Data does not match type. (Distribution queue)"
                    );
                }
            }
        } catch (error: any) {
            logger.error({ error }, "Error processing chat message for distribution");
        }
    });
}

export async function onWritebackMessage(
    handler: (rabbitMQMsg: ConsumeMessage, message: Action<Message>) => Promise<void>
): Promise<void> {
    const channel = await writebackDownChannel();
    channel.consume(writebackQueue, (rabbitMQMsg) => {
        try {
            if (rabbitMQMsg) {
                // Do not ack until the message has been written into the db

                const message = JSON.parse(rabbitMQMsg.content.toString());
                if (is<Action<Message>>(message)) {
                    handler(rabbitMQMsg, message);
                } else {
                    logger.warn(
                        { message },
                        "Invalid chat message received. Data does not match type. (Writeback queue)"
                    );
                    // Ack invalid messages to remove them from the queue
                    channel.ack(rabbitMQMsg);
                }
            }
        } catch (error: any) {
            logger.error({ error }, "Error processing chat message for writeback");
        }
    });
}

export async function onWritebackMessagesComplete(rabbitMQMsgs: ConsumeMessage[]): Promise<void> {
    const channel = await writebackDownChannel();
    for (const rabbitMQMsg of rabbitMQMsgs) {
        channel.ack(rabbitMQMsg);
    }
}

export async function onWritebackMessagesFail(rabbitMQMsgs: ConsumeMessage[]): Promise<void> {
    const channel = await writebackDownChannel();
    for (const rabbitMQMsg of rabbitMQMsgs) {
        channel.nack(rabbitMQMsg, undefined, true);
    }
}
