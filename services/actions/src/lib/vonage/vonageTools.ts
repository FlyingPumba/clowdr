import { gql } from "@apollo/client/core";
import { DeleteAttendeeCommand } from "@aws-sdk/client-chime";
import {
    CreateEventParticipantStreamDocument,
    GetEventBroadcastDetailsDocument,
    GetEventByVonageSessionIdDocument,
    RemoveEventParticipantStreamDocument,
} from "../../generated/graphql";
import { apolloClient } from "../../graphqlClient";
import { StreamData } from "../../types/vonage";
import { callWithRetry } from "../../utils";
import { Chime, shortId } from "../aws/awsClient";
import { getRoomParticipantDetails, removeRoomParticipant } from "../roomParticipant";
import Vonage from "./vonageClient";

gql`
    query GetEventBroadcastDetails($eventId: uuid!) {
        Event_by_pk(id: $eventId) {
            id
            startTime
            durationSeconds
            endTime
            intendedRoomModeName
            room {
                id
                mediaLiveChannel {
                    rtmpInputUri
                    id
                }
            }
            eventVonageSession {
                sessionId
                id
            }
        }
    }
`;

interface EventBroadcastDetails {
    rtmpServerUrl: string;
    rtmpStreamName: string;
    vonageSessionId: string;
}

export async function getEventBroadcastDetails(eventId: string): Promise<EventBroadcastDetails> {
    const eventResult = await apolloClient.query({
        query: GetEventBroadcastDetailsDocument,
        variables: {
            eventId,
        },
    });

    if (!eventResult.data.Event_by_pk) {
        throw new Error("Could not find event");
    }

    if (!eventResult.data.Event_by_pk.room.mediaLiveChannel?.rtmpInputUri) {
        throw new Error("No RTMP Push URI available for event room.");
    }

    const rtmpUri = eventResult.data.Event_by_pk.room.mediaLiveChannel.rtmpInputUri;
    const rtmpUriParts = rtmpUri.split("/");
    if (rtmpUriParts.length < 2) {
        throw new Error("RTMP Push URI has unexpected format");
    }
    const streamName = rtmpUriParts[rtmpUriParts.length - 1];
    const serverUrl = rtmpUri.substring(0, rtmpUri.length - streamName.length);

    if (!eventResult.data.Event_by_pk.eventVonageSession?.sessionId) {
        throw new Error("Could not find Vonage session ID for event");
    }

    return {
        rtmpServerUrl: serverUrl,
        rtmpStreamName: streamName,
        vonageSessionId: eventResult.data.Event_by_pk.eventVonageSession.sessionId,
    };
}

export async function startEventBroadcast(eventId: string): Promise<void> {
    let broadcastDetails: EventBroadcastDetails;
    try {
        broadcastDetails = await callWithRetry(async () => await getEventBroadcastDetails(eventId));
    } catch (e) {
        console.error("Error retrieving Vonage broadcast details for event", e);
        return;
    }

    const existingSessionBroadcasts = await callWithRetry(
        async () =>
            await Vonage.listBroadcasts({
                sessionId: broadcastDetails.vonageSessionId,
            })
    );

    if (!existingSessionBroadcasts) {
        console.error("Could not retrieve existing session broadcasts.", broadcastDetails.vonageSessionId);
        return;
    }

    const startedSessionBroadcasts = existingSessionBroadcasts?.filter((broadcast) => broadcast.status === "started");

    console.log(
        `Vonage session has ${startedSessionBroadcasts.length} existing live broadcasts`,
        broadcastDetails.vonageSessionId,
        startedSessionBroadcasts
    );

    if (startedSessionBroadcasts.length > 1) {
        console.warn(
            "Found more than one live broadcast for session - which is not allowed. Stopping them.",
            broadcastDetails.vonageSessionId
        );
        for (const broadcast of startedSessionBroadcasts) {
            try {
                await Vonage.stopBroadcast(broadcast.id);
            } catch (e) {
                console.error(
                    "Error while stopping invalid broadcast",
                    broadcastDetails.vonageSessionId,
                    broadcast.status,
                    e
                );
            }
        }
    }

    const existingBroadcast = startedSessionBroadcasts.find((broadcast) =>
        broadcast.broadcastUrls.rtmp?.find(
            (destination) =>
                destination.serverUrl === broadcastDetails.rtmpServerUrl &&
                destination.streamName === broadcastDetails.rtmpStreamName
        )
    );

    if (!existingBroadcast) {
        const rtmpId = shortId();
        console.log(
            "Starting a broadcast from session to event room",
            broadcastDetails.vonageSessionId,
            eventId,
            rtmpId
        );
        try {
            const broadcast = await Vonage.startBroadcast(broadcastDetails.vonageSessionId, {
                layout: {
                    type: "bestFit",
                    screenshareType: "horizontalPresentation",
                },
                outputs: {
                    rtmp: [
                        {
                            id: rtmpId,
                            serverUrl: broadcastDetails.rtmpServerUrl,
                            streamName: broadcastDetails.rtmpStreamName,
                        },
                    ],
                },
                resolution: "1280x720",
            });
            console.log("Started Vonage RTMP broadcast", broadcast.id, broadcastDetails.vonageSessionId, eventId);
        } catch (e) {
            console.error("Failed to start broadcast", broadcastDetails.vonageSessionId, eventId, e);
            return;
        }
    } else {
        console.log(
            "There is already an existing RTMP broadcast from the session to the ongoing event.",
            broadcastDetails.vonageSessionId,
            eventId
        );
    }
}

export async function stopEventBroadcasts(eventId: string): Promise<void> {
    let broadcastDetails: EventBroadcastDetails;
    try {
        broadcastDetails = await callWithRetry(async () => await getEventBroadcastDetails(eventId));
    } catch (e) {
        console.error("Error retrieving Vonage broadcast details for event", e);
        return;
    }

    const existingSessionBroadcasts = await callWithRetry(
        async () =>
            await Vonage.listBroadcasts({
                sessionId: broadcastDetails.vonageSessionId,
            })
    );

    if (!existingSessionBroadcasts) {
        console.error("Could not retrieve existing session broadcasts.", broadcastDetails.vonageSessionId);
        return;
    }

    for (const existingBroadcast of existingSessionBroadcasts) {
        try {
            if (existingBroadcast.status === "started") {
                await callWithRetry(async () => await Vonage.stopBroadcast(existingBroadcast.id));
            }
        } catch (e) {
            console.error("Could not stop existing session broadcast", eventId, existingBroadcast.id, e);
        }
    }
}

export async function kickAttendeeFromRoom(roomId: string, attendeeId: string): Promise<void> {
    const roomParticipants = await getRoomParticipantDetails(roomId, attendeeId);

    if (roomParticipants.length !== 1) {
        console.error("Could not find a room participant to kick", roomId, attendeeId);
        throw new Error("Could not find a room participant to kick");
    }

    const roomParticipant = roomParticipants[0];

    if (roomParticipant.vonageConnectionId) {
        if (!roomParticipant.room.publicVonageSessionId) {
            console.warn("Could not find Vonage session to kick participant from", { roomId, attendeeId });
        } else {
            console.log("Forcing Vonage disconnection of attendee", { roomId, attendeeId });
            try {
                await Vonage.forceDisconnect(
                    roomParticipant.room.publicVonageSessionId,
                    roomParticipant.vonageConnectionId
                );
            } catch (err) {
                console.error("Failed to force Vonage disconnection of attendee", { roomId, attendeeId, err });
                throw new Error("Failed to force Vonage disconnection of attendee");
            }
        }

        await removeRoomParticipant(roomId, roomParticipant.room.conferenceId, attendeeId);
    } else if (roomParticipant.chimeAttendeeId) {
        if (!roomParticipant.room.roomChimeMeeting) {
            console.warn("Could not find Chime session to kick participant from", { roomId, attendeeId });
        } else {
            console.log("Forcing Chime disconnection of attendee", { roomId, attendeeId });
            try {
                await Chime.send(
                    new DeleteAttendeeCommand({
                        AttendeeId: roomParticipant.chimeAttendeeId,
                        MeetingId: roomParticipant.room.roomChimeMeeting.chimeMeetingId,
                    })
                );
            } catch (err) {
                console.error("Failed to force Chime disconnection of attendee", { roomId, attendeeId, err });
                throw new Error("Failed to force Chime disconnection of attendee");
            }
        }

        await removeRoomParticipant(roomId, roomParticipant.room.conferenceId, attendeeId);
    }
}

gql`
    query GetEventByVonageSessionId($sessionId: String!) {
        Event(where: { eventVonageSession: { sessionId: { _eq: $sessionId } } }) {
            id
            conferenceId
        }
    }

    mutation CreateEventParticipantStream(
        $attendeeId: uuid!
        $conferenceId: uuid!
        $eventId: uuid!
        $vonageConnectionId: String!
        $vonageStreamId: String!
        $vonageStreamType: String!
    ) {
        insert_EventParticipantStream_one(
            object: {
                attendeeId: $attendeeId
                conferenceId: $conferenceId
                eventId: $eventId
                vonageConnectionId: $vonageConnectionId
                vonageStreamId: $vonageStreamId
                vonageStreamType: $vonageStreamType
            }
        ) {
            id
        }
    }
`;

export async function addEventParticipantStream(
    sessionId: string,
    attendeeId: string,
    stream: StreamData
): Promise<void> {
    const eventResult = await apolloClient.query({
        query: GetEventByVonageSessionIdDocument,
        variables: {
            sessionId,
        },
    });

    if (eventResult.error || eventResult.errors) {
        console.error("Error while retrieving event from Vonage session ID", sessionId, attendeeId);
        throw new Error("Error while retrieving event from Vonage session ID");
    }

    if (eventResult.data.Event.length !== 1) {
        console.log("No event matching this session, skipping participant addition.", sessionId, attendeeId);
        return;
    }

    try {
        await apolloClient.mutate({
            mutation: CreateEventParticipantStreamDocument,
            variables: {
                attendeeId,
                conferenceId: eventResult.data.Event[0].conferenceId,
                eventId: eventResult.data.Event[0].id,
                vonageConnectionId: stream.connection.id,
                vonageStreamId: stream.id,
                vonageStreamType: stream.videoType ?? "camera",
            },
        });
    } catch (e) {
        // If there is already a row for this event, kick the previous connection before recording the new one
        console.error(
            "Error while adding event participant stream",
            eventResult.data.Event[0].id,
            attendeeId,
            stream.id,
            e
        );
        throw new Error("Error while adding event participant stream");
    }
}

gql`
    mutation RemoveEventParticipantStream(
        $attendeeId: uuid!
        $conferenceId: uuid!
        $eventId: uuid!
        $vonageConnectionId: String!
        $vonageStreamId: String!
    ) {
        delete_EventParticipantStream(
            where: {
                attendeeId: { _eq: $attendeeId }
                conferenceId: { _eq: $conferenceId }
                eventId: { _eq: $eventId }
                vonageConnectionId: { _eq: $vonageConnectionId }
                vonageStreamId: { _eq: $vonageStreamId }
            }
        ) {
            affected_rows
        }
    }
`;

export async function removeEventParticipantStream(
    sessionId: string,
    attendeeId: string,
    stream: StreamData
): Promise<void> {
    const eventResult = await apolloClient.query({
        query: GetEventByVonageSessionIdDocument,
        variables: {
            sessionId,
        },
    });

    if (eventResult.error || eventResult.errors) {
        console.log("Could not retrieve event from Vonage session ID", sessionId, attendeeId);
        throw new Error("Could not retrieve event from Vonage session ID");
    }

    if (eventResult.data.Event.length !== 1) {
        console.log("No event matching this session, skipping participant stream removal.", sessionId, attendeeId);
        return;
    }

    const removeResult = await apolloClient.mutate({
        mutation: RemoveEventParticipantStreamDocument,
        variables: {
            attendeeId,
            conferenceId: eventResult.data.Event[0].conferenceId,
            eventId: eventResult.data.Event[0].id,
            vonageConnectionId: stream.connection.id,
            vonageStreamId: stream.id,
        },
    });

    if (
        !removeResult.data?.delete_EventParticipantStream?.affected_rows ||
        removeResult.data.delete_EventParticipantStream.affected_rows === 0
    ) {
        console.warn("Could not find participant stream to remove for event", sessionId, attendeeId, stream.id);
    }
}
