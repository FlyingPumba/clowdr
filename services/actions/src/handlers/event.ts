import { gql } from "@apollo/client/core";
import type { stopEventBroadcastArgs, StopEventBroadcastOutput } from "@midspace/hasura/action-types";
import type { EventPayload } from "@midspace/hasura/event";
import type { EventData } from "@midspace/hasura/event-data";
import type { ContinuationTo } from "@midspace/shared-types/continuation";
import { ContinuationType } from "@midspace/shared-types/continuation";
import type { P } from "pino";
import { is } from "typescript-is";
import type { EndChatDuplicationMutationVariables, StartChatDuplicationMutationVariables } from "../generated/graphql";
import {
    EndChatDuplicationDocument,
    Event_GetEventVonageSessionDocument,
    GetEventChatInfoDocument,
    GetEventTimingsDocument,
    NotifyRealtimeEventEndedDocument,
    NotifyRealtimeEventStartedDocument,
    Schedule_Mode_Enum,
    StartChatDuplicationDocument,
} from "../generated/graphql";
import { apolloClient } from "../graphqlClient";
import {
    createEventEndTrigger,
    createEventStartTrigger,
    createEventVonageSession,
    eventHasVonageSession,
    isLive,
} from "../lib/event";
import { sendFailureEmail } from "../lib/logging/failureEmails";
import { createItemVideoChatRoom } from "../lib/room";
import Vonage from "../lib/vonage/vonageClient";
import {
    startEventBroadcast,
    startRoomVonageArchiving,
    stopEventBroadcasts,
    stopRoomVonageArchiving,
} from "../lib/vonage/vonageTools";
import { callWithRetry } from "../utils";
import { createMediaPackageHarvestJob } from "./recording";

export async function handleEventUpdated(logger: P.Logger, payload: EventPayload<EventData>): Promise<void> {
    const newRow = payload.event.data.new;

    if (!newRow) {
        logger.error({ oldEventId: payload.event.data.old?.id }, "handleEventUpdated: new content was empty");
        return;
    }

    if (!newRow.modeName) {
        return;
    }

    try {
        if (newRow && newRow.scheduledStartTime && newRow.scheduledEndTime) {
            await createEventStartTrigger(
                logger,
                newRow.id,
                newRow.scheduledStartTime,
                Date.parse(newRow.timings_updated_at)
            );
            await createEventEndTrigger(
                logger,
                newRow.id,
                newRow.scheduledEndTime,
                Date.parse(newRow.timings_updated_at)
            );
        }
    } catch (err) {
        logger.error({ eventId: newRow.id, err }, "Could not insert event start/end triggers");
        await sendFailureEmail(logger, "Could not insert event start/end triggers", JSON.stringify(err));
    }

    try {
        const hasVonageSession = await eventHasVonageSession(newRow.id);
        if (!hasVonageSession && isLive(newRow.modeName)) {
            await createEventVonageSession(logger, newRow.id, newRow.conferenceId, newRow.subconferenceId);
        }
    } catch (err) {
        logger.error({ eventId: newRow.id, err }, "Could not create Vonage session for event");
        await sendFailureEmail(logger, "Could not create Vonage session for event", JSON.stringify(err));
    }
}

gql`
    query GetEventChatInfo($eventId: uuid!) {
        schedule_Event_by_pk(id: $eventId) {
            id
            scheduledStartTime
            scheduledEndTime
            room {
                id
                name
                chatId
            }
            item {
                id
                title
                chatId
            }
        }
    }

    mutation StartChatDuplication(
        $chatId1: uuid!
        $chatId2: uuid! # $data: jsonb! # $message: String! # $systemId1: String!
    ) {
        update_chat1: update_chat_Chat_by_pk(pk_columns: { id: $chatId1 }, _set: { duplicateToId: $chatId2 }) {
            id
        }
        update_chat2: update_chat_Chat_by_pk(pk_columns: { id: $chatId2 }, _set: { duplicateToId: $chatId1 }) {
            id
        }
    }

    mutation EndChatDuplication(
        $chatId1: uuid!
        $chatId2: uuid! # $data: jsonb! # $message: String! # $systemId1: String! # $systemId2: String!
    ) {
        update_chat1: update_chat_Chat_by_pk(pk_columns: { id: $chatId1 }, _set: { duplicateToId: null }) {
            id
        }
        update_chat2: update_chat_Chat_by_pk(pk_columns: { id: $chatId2 }, _set: { duplicateToId: null }) {
            id
        }
    }

    mutation NotifyRealtimeEventStarted($eventId: uuid!) {
        notifyEventStarted(eventId: $eventId) {
            ok
        }
    }

    mutation NotifyRealtimeEventEnded($eventId: uuid!) {
        notifyEventEnded(eventId: $eventId) {
            ok
        }
    }
`;

async function insertChatDuplicationMarkers(eventId: string, isStart: boolean): Promise<void> {
    const chatInfo = await apolloClient.query({
        query: GetEventChatInfoDocument,
        variables: {
            eventId,
        },
    });

    if (chatInfo.data.schedule_Event_by_pk) {
        if (chatInfo.data.schedule_Event_by_pk.item) {
            const chatId1 = chatInfo.data.schedule_Event_by_pk.item.chatId;
            const chatId2 = chatInfo.data.schedule_Event_by_pk.room.chatId;
            if (chatId1 && chatId2 && (!isStart || chatId1 !== chatId2)) {
                await apolloClient.mutate({
                    mutation: isStart ? StartChatDuplicationDocument : EndChatDuplicationDocument,
                    variables: {
                        chatId1,
                        chatId2,
                    } as StartChatDuplicationMutationVariables | EndChatDuplicationMutationVariables,
                });
            }
        }
    }
}

async function notifyRealtimeServiceEventStarted(eventId: string): Promise<void> {
    await apolloClient.mutate({
        mutation: NotifyRealtimeEventStartedDocument,
        variables: {
            eventId,
        },
    });
}

async function notifyRealtimeServiceEventEnded(eventId: string): Promise<void> {
    await apolloClient.mutate({
        mutation: NotifyRealtimeEventEndedDocument,
        variables: {
            eventId,
        },
    });
}

gql`
    query GetEventTimings($eventId: uuid!) {
        schedule_Event_by_pk(id: $eventId) {
            id
            name
            timingsUpdatedAt
            scheduledStartTime
            scheduledEndTime
            conferenceId
            subconferenceId
            modeName
            roomId
            enableRecording
            eventVonageSession {
                id
                sessionId
            }
            item {
                id
                title
                chatId
            }
            continuations {
                id
                to
            }
            room {
                id
                rtmpInput {
                    id
                    inputId
                }
            }
        }
    }
`;

export async function handleEventStartNotification(
    logger: P.Logger,
    eventId: string,
    scheduledStartTime: string,
    updatedAt: number | null
): Promise<void> {
    logger.info({ eventId, scheduledStartTime }, "Handling event start");
    const result = await callWithRetry(
        async () =>
            await apolloClient.query({
                query: GetEventTimingsDocument,
                variables: {
                    eventId,
                },
            })
    );

    if (
        result.data.schedule_Event_by_pk &&
        result.data.schedule_Event_by_pk.scheduledStartTime === scheduledStartTime &&
        (!updatedAt || Date.parse(result.data.schedule_Event_by_pk.timingsUpdatedAt) === updatedAt)
    ) {
        const isHybrid = Boolean(result.data.schedule_Event_by_pk.room?.rtmpInput?.inputId);
        logger.info(
            { eventId: result.data.schedule_Event_by_pk.id, scheduledStartTime, isHybrid },
            "Handling event start: matched expected scheduledStartTime"
        );
        const nowMillis = new Date().getTime();
        const scheduledStartTimeMillis = Date.parse(scheduledStartTime);
        // If the event is hybrid, delay by 3 seconds to reduce risk of RTMP PUSH Input conflict between events
        const preloadMillis = isHybrid ? -3000 : 10000;
        const waitForMillis = Math.max(scheduledStartTimeMillis - nowMillis - preloadMillis, 0);
        const eventId = result.data.schedule_Event_by_pk.id;
        const roomId = result.data.schedule_Event_by_pk.roomId;
        const modeName = result.data.schedule_Event_by_pk.modeName;
        const intendedRecordingEnabled = result.data.schedule_Event_by_pk.enableRecording;

        setTimeout(() => {
            if (modeName === Schedule_Mode_Enum.Livestream) {
                startEventBroadcast(logger, eventId).catch((e) => {
                    logger.error({ eventId, err: e }, "Failed to start event broadcast");
                });
            } else if (modeName === Schedule_Mode_Enum.VideoChat && intendedRecordingEnabled) {
                startRoomVonageArchiving(logger, roomId, eventId).catch((e) => {
                    logger.error(
                        {
                            roomId,
                            eventId,
                            err: e,
                        },
                        "Failed to start event archiving"
                    );
                });
            }
        }, waitForMillis);

        setTimeout(() => {
            insertChatDuplicationMarkers(eventId, true).catch((e) => {
                logger.error({ eventId, err: e }, "Failed to insert chat duplication start markers");
            });

            notifyRealtimeServiceEventStarted(eventId).catch((e) => {
                logger.error("Failed to notify real-time service event started", { eventId, e });
            });
        }, Math.max(scheduledStartTimeMillis - nowMillis + 500, 0));

        // Used to skip creating duplicate rooms by accident
        const itemsCreatedRoomsFor: string[] = [];
        for (const continuation of result.data.schedule_Event_by_pk.continuations) {
            if (is<ContinuationTo>(continuation.to)) {
                const to: ContinuationTo = continuation.to;
                if (to.type === ContinuationType.AutoDiscussionRoom) {
                    if (to.id) {
                        if (!itemsCreatedRoomsFor.includes(to.id)) {
                            try {
                                await createItemVideoChatRoom(
                                    logger,
                                    to.id,
                                    result.data.schedule_Event_by_pk.conferenceId,
                                    result.data.schedule_Event_by_pk.subconferenceId
                                );
                                itemsCreatedRoomsFor.push(to.id);
                            } catch (e: any) {
                                logger.error(
                                    { eventId, err: e },
                                    "Failed to create automatic discussion room (specified item)"
                                );
                            }
                        }
                    } else if (result.data.schedule_Event_by_pk.item?.id) {
                        if (!itemsCreatedRoomsFor.includes(result.data.schedule_Event_by_pk.item.id)) {
                            try {
                                await createItemVideoChatRoom(
                                    logger,
                                    result.data.schedule_Event_by_pk.item.id,
                                    result.data.schedule_Event_by_pk.conferenceId,
                                    result.data.schedule_Event_by_pk.subconferenceId
                                );
                                itemsCreatedRoomsFor.push(result.data.schedule_Event_by_pk.item.id);
                            } catch (e: any) {
                                logger.error(
                                    { eventId, err: e },
                                    "Failed to create automatic discussion room (matching event)"
                                );
                            }
                        }
                    }
                }
            }
        }

        // TODO: During the migration to Continuations, Ed left the logic for generating
        //       discussion rooms for Presentation/Q&A events as a fallback. Once
        //       continuations are fully bedded in, the logic can be removed as it is
        //       redundant.
        if (
            Schedule_Mode_Enum.Livestream === modeName &&
            result.data.schedule_Event_by_pk.item &&
            !itemsCreatedRoomsFor.includes(result.data.schedule_Event_by_pk.item.id)
        ) {
            try {
                await createItemVideoChatRoom(
                    logger,
                    result.data.schedule_Event_by_pk.item.id,
                    result.data.schedule_Event_by_pk.conferenceId,
                    result.data.schedule_Event_by_pk.subconferenceId
                );
            } catch (e: any) {
                logger.error({ eventId, err: e }, "Failed to create automatic discussion room (fallback)");
            }
        }
    } else {
        logger.info(
            {
                eventId,
                scheduledStartTime,
                updatedAt,
            },
            "Event start notification did not match current event start time, skipping."
        );
    }
}

export async function handleEventEndNotification(
    logger: P.Logger,
    eventId: string,
    scheduledEndTime: string,
    updatedAt: number | null
): Promise<void> {
    logger.info({ eventId, scheduledEndTime }, "Handling event end");
    const result = await callWithRetry(
        async () =>
            await apolloClient.query({
                query: GetEventTimingsDocument,
                variables: {
                    eventId,
                },
            })
    );

    if (
        result.data.schedule_Event_by_pk &&
        result.data.schedule_Event_by_pk.scheduledEndTime === scheduledEndTime &&
        (!updatedAt || Date.parse(result.data.schedule_Event_by_pk.timingsUpdatedAt) === updatedAt)
    ) {
        logger.info(
            { eventId: result.data.schedule_Event_by_pk.id, scheduledEndTime },
            "Handling event end: matched expected scheduledEndTime"
        );
        const nowMillis = new Date().getTime();
        const endTimeMillis = Date.parse(scheduledEndTime);
        const preloadMillis = 1000;
        const waitForMillis = Math.max(endTimeMillis - nowMillis - preloadMillis, 0);
        const eventId = result.data.schedule_Event_by_pk.id;
        const roomId = result.data.schedule_Event_by_pk.roomId;
        const enableRecording = result.data.schedule_Event_by_pk.enableRecording;
        const conferenceId = result.data.schedule_Event_by_pk.conferenceId;
        const subconferenceId = result.data.schedule_Event_by_pk.subconferenceId;
        const modeName = result.data.schedule_Event_by_pk.modeName;

        setTimeout(() => {
            if (modeName === Schedule_Mode_Enum.Livestream) {
                stopEventBroadcasts(logger, eventId).catch((e) => {
                    logger.error({ eventId, e }, "Failed to stop event broadcasts");
                });
            } else if (modeName === Schedule_Mode_Enum.VideoChat && enableRecording) {
                stopRoomVonageArchiving(logger, roomId, eventId).catch((e) => {
                    logger.error({ eventId, e }, "Failed to stop event archiving");
                });
            }

            notifyRealtimeServiceEventEnded(eventId).catch((e) => {
                logger.error({ eventId, e }, "Failed to notify real-time service event ended");
            });
        }, waitForMillis);

        setTimeout(() => {
            insertChatDuplicationMarkers(eventId, false).catch((e) => {
                logger.error({ eventId, e }, "Failed to insert chat duplication end markers");
            });
        }, endTimeMillis - nowMillis - 500);

        if (enableRecording) {
            const harvestJobWaitForMillis = Math.max(endTimeMillis - nowMillis + 5000, 0);
            setTimeout(() => {
                if (modeName === Schedule_Mode_Enum.Livestream) {
                    createMediaPackageHarvestJob(logger, eventId, conferenceId, subconferenceId).catch((e) => {
                        logger.error({ eventId, e }, "Failed to create MediaPackage harvest job");
                    });
                }
            }, harvestJobWaitForMillis);
        }
    } else {
        logger.info(
            { eventId, scheduledEndTime, updatedAt },
            "Event stop notification did not match current event, skipping."
        );
    }
}

gql`
    query Event_GetEventVonageSession($eventId: uuid!) {
        schedule_Event_by_pk(id: $eventId) {
            id
            eventVonageSession {
                id
                sessionId
            }
        }
    }
`;

export async function handleStopEventBroadcasts(
    logger: P.Logger,
    params: stopEventBroadcastArgs
): Promise<StopEventBroadcastOutput> {
    logger.info({ eventId: params.eventId }, "Stopping broadcasts for event");

    const eventDetails = await apolloClient.query({
        query: Event_GetEventVonageSessionDocument,
        variables: {
            eventId: params.eventId,
        },
    });

    if (!eventDetails.data.schedule_Event_by_pk) {
        logger.error({ eventId: params.eventId }, "Could not retrieve event");
        throw new Error("Could not retrieve event");
    }

    if (!eventDetails.data.schedule_Event_by_pk.eventVonageSession) {
        logger.info({ eventId: params.eventId }, "Event has no associated Vonage session");
        return { broadcastsStopped: 0 };
    }

    const broadcasts = await Vonage.listBroadcasts({
        sessionId: eventDetails.data.schedule_Event_by_pk.eventVonageSession.sessionId,
    });

    if (!broadcasts) {
        logger.info({ eventId: params.eventId }, "No broadcasts return for Vonage session");
        return { broadcastsStopped: 0 };
    }

    let broadcastsStopped = 0;
    for (const broadcast of broadcasts) {
        try {
            logger.info({ eventId: params.eventId, broadcastId: broadcast.id }, "Attempting to stop broadcast");
            await Vonage.stopBroadcast(broadcast.id);
            broadcastsStopped++;
        } catch (e: any) {
            logger.warn(
                { eventId: params.eventId, broadcastId: broadcast.id, err: e },
                "Failure while trying to stop broadcast"
            );
        }
    }

    return { broadcastsStopped };
}
