import { generateChatRoomName } from "../../../lib/chat";
import { logger } from "../../../lib/logger";
import { onDistributionReaction } from "../../../rabbitmq/chat/reactions";
import { emitter } from "../../../socket-emitter/socket-emitter";
import type { Action, Reaction } from "../../../types/chat";

logger.info("Chat reactions distribution worker running");

async function onReaction(action: Action<Reaction>) {
    const eventName =
        action.op === "INSERT"
            ? "receive"
            : action.op === "UPDATE"
            ? "update"
            : action.op === "DELETE"
            ? "delete"
            : "unknown";

    const chatId = action.data.chatId;
    emitter.to(generateChatRoomName(chatId)).emit(`chat.reactions.${eventName}`, action.data);
}

async function Main() {
    onDistributionReaction(onReaction);
}

Main();
