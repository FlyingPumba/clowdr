import { gql } from "@apollo/client/core";
import type { Meeting } from "@aws-sdk/client-chime";
import assert from "assert";
import type { P } from "pino";
import { is } from "typescript-is";
import {
    CreateItemRoom_GetItemDocument,
    CreateRoomChimeMeetingDocument,
    GetRoomByChimeMeetingIdDocument,
    GetRoomBySessionIdDocument,
    GetRoomChimeMeetingDocument,
    GetRoomConferenceIdDocument,
    GetRoomThatRegistrantCanJoinDocument,
    GetRoomVonageMeetingDocument,
    Item_CreateRoomDocument,
} from "../generated/graphql";
import { apolloClient } from "../graphqlClient";
import { callWithRetry } from "../utils";
import { createChimeMeeting, doesChimeMeetingExist } from "./aws/chime";
import { deleteRoomChimeMeeting } from "./roomChimeMeeting";

export async function createItemVideoChatRoom(
    logger: P.Logger,
    itemId: string,
    conferenceId: string,
    subconferenceId: string | null | undefined
): Promise<string> {
    gql`
        query CreateItemRoom_GetItem($id: uuid!) {
            content_Item_by_pk(id: $id) {
                id
                chatId
                conferenceId
                subconferenceId
                room {
                    id
                }
                title
            }
        }
    `;

    const itemResult = await apolloClient.query({
        query: CreateItemRoom_GetItemDocument,
        variables: {
            id: itemId,
        },
    });

    if (itemResult.data.content_Item_by_pk?.conferenceId !== conferenceId) {
        throw new Error("Could not find specified content item in the conference");
    }

    if (itemResult.data.content_Item_by_pk?.subconferenceId !== subconferenceId) {
        throw new Error("Could not find specified content item in the subconference");
    }

    if (itemResult.data.content_Item_by_pk.room) {
        return itemResult.data.content_Item_by_pk.room.id;
    }

    gql`
        mutation Item_CreateRoom(
            $chatId: uuid = null
            $conferenceId: uuid!
            $name: String!
            $itemId: uuid!
            $subconferenceId: uuid = null
        ) {
            insert_room_Room_one(
                object: {
                    capacity: 50
                    chatId: $chatId
                    conferenceId: $conferenceId
                    name: $name
                    itemId: $itemId
                    managementModeName: PUBLIC
                    subconferenceId: $subconferenceId
                }
            ) {
                id
            }
        }
    `;

    logger.info({ itemId, conferenceId, subconferenceId }, "Creating new breakout room for content item");

    const createResult = await apolloClient.mutate({
        mutation: Item_CreateRoomDocument,
        variables: {
            conferenceId,
            subconferenceId,
            name: `${itemResult.data.content_Item_by_pk.title}`,
            itemId,
            chatId: itemResult.data.content_Item_by_pk.chatId,
        },
    });
    return createResult.data?.insert_room_Room_one?.id;
}

export async function getRoomConferenceId(
    roomId: string
): Promise<{ conferenceId: string; subconferenceId: string | null }> {
    gql`
        query GetRoomConferenceId($roomId: uuid!) {
            room_Room_by_pk(id: $roomId) {
                id
                conferenceId
                subconferenceId
            }
        }
    `;

    const room = await apolloClient.query({
        query: GetRoomConferenceIdDocument,
        variables: {
            roomId,
        },
    });

    if (!room.data.room_Room_by_pk) {
        throw new Error("Could not find room");
    }

    return {
        conferenceId: room.data.room_Room_by_pk.conferenceId,
        subconferenceId: room.data.room_Room_by_pk.subconferenceId ?? null,
    };
}

export async function canUserJoinRoom(
    registrantId: string,
    roomId: string,
    conferenceId: string,
    subconferenceId: string | null | undefined
): Promise<boolean> {
    gql`
        query GetRoomThatRegistrantCanJoin(
            $roomId: uuid
            $registrantId: uuid
            $conferenceId: uuid
            $subconferenceCond: uuid_comparison_exp!
            $registrantCond: registrant_Registrant_bool_exp!
        ) {
            room_Room(
                where: {
                    id: { _eq: $roomId }
                    conference: { id: { _eq: $conferenceId }, registrants: $registrantCond }
                    subconferenceId: $subconferenceCond
                    _or: [
                        { roomMemberships: { registrant: { id: { _eq: $registrantId } } } }
                        { managementModeName: { _eq: PUBLIC } }
                    ]
                }
            ) {
                id
                publicVonageSessionId
                conference {
                    registrants(where: { id: { _eq: $registrantId } }) {
                        id
                    }
                }
            }
        }
    `;
    const result = await callWithRetry(() =>
        apolloClient.query({
            query: GetRoomThatRegistrantCanJoinDocument,
            variables: {
                roomId,
                registrantId,
                conferenceId,
                registrantCond: subconferenceId
                    ? {
                          id: { _eq: registrantId },
                          subconferenceMemberships: {
                              subconferenceId: {
                                  _eq: subconferenceId,
                              },
                          },
                      }
                    : {
                          id: { _eq: registrantId },
                      },
                subconferenceCond: subconferenceId
                    ? {
                          _eq: subconferenceId,
                      }
                    : {
                          _is_null: true,
                      },
            },
        })
    );
    return result.data.room_Room.length > 0;
}

export async function createRoomChimeMeeting(
    logger: P.Logger,
    roomId: string,
    conferenceId: string,
    subconferenceId: string | null | undefined
): Promise<Meeting> {
    const chimeMeetingData = await createChimeMeeting(roomId);

    gql`
        mutation CreateRoomChimeMeeting(
            $conferenceId: uuid!
            $subconferenceId: uuid
            $chimeMeetingData: jsonb!
            $chimeMeetingId: String!
            $roomId: uuid!
        ) {
            insert_room_ChimeMeeting_one(
                object: {
                    conferenceId: $conferenceId
                    subconferenceId: $subconferenceId
                    chimeMeetingData: $chimeMeetingData
                    chimeMeetingId: $chimeMeetingId
                    roomId: $roomId
                }
            ) {
                id
            }
        }
    `;

    try {
        assert(chimeMeetingData.MeetingId);
        await apolloClient.mutate({
            mutation: CreateRoomChimeMeetingDocument,
            variables: {
                conferenceId,
                subconferenceId,
                roomId,
                chimeMeetingData,
                chimeMeetingId: chimeMeetingData.MeetingId,
            },
        });
    } catch (e: any) {
        logger.error({ err: e, roomId, conferenceId, subconferenceId }, "Failed to create a room Chime meeting");
        throw e;
    }

    return chimeMeetingData;
}

export async function getExistingRoomChimeMeeting(
    logger: P.Logger,
    roomId: string
): Promise<(Meeting & { conferenceId: string }) | null> {
    gql`
        query GetRoomChimeMeeting($roomId: uuid!) {
            room_ChimeMeeting(where: { roomId: { _eq: $roomId } }) {
                id
                chimeMeetingData
                conferenceId
            }
        }
    `;

    const result = await apolloClient.query({
        query: GetRoomChimeMeetingDocument,
        variables: {
            roomId,
        },
    });

    if (result.data.room_ChimeMeeting.length === 1) {
        const chimeMeetingId = result.data.room_ChimeMeeting[0].id;
        const conferenceId = result.data.room_ChimeMeeting[0].conferenceId;
        const chimeMeetingData: Meeting = result.data.room_ChimeMeeting[0].chimeMeetingData;
        if (!is<Meeting>(chimeMeetingData)) {
            logger.warn(
                {
                    chimeMeetingData,
                    roomId,
                },
                "Retrieved Chime meeting data could not be validated, deleting record"
            );
            await deleteRoomChimeMeeting(chimeMeetingId);
            return null;
        }

        if (!chimeMeetingData.MeetingId || typeof chimeMeetingData.MeetingId !== "string") {
            logger.warn(
                {
                    chimeMeetingData,
                    roomId,
                },
                "Retrieved Chime meeting data could not be validated, deleting record"
            );
            await deleteRoomChimeMeeting(chimeMeetingId);
            return null;
        }

        const exists = await doesChimeMeetingExist(chimeMeetingData.MeetingId);

        if (!exists) {
            logger.warn(
                {
                    chimeMeetingData,
                    roomId,
                },
                "Chime meeting no longer exists, deleting record"
            );
            await deleteRoomChimeMeeting(chimeMeetingId);
            return null;
        }

        return { ...chimeMeetingData, conferenceId };
    }

    return null;
}

export async function getExistingRoomVonageMeeting(roomId: string): Promise<string | null> {
    gql`
        query GetRoomVonageMeeting($roomId: uuid!) {
            room_Room_by_pk(id: $roomId) {
                id
                publicVonageSessionId
            }
        }
    `;

    const result = await apolloClient.query({
        query: GetRoomVonageMeetingDocument,
        variables: {
            roomId,
        },
    });

    return result.data.room_Room_by_pk?.publicVonageSessionId ?? null;
}

export async function getRoomChimeMeeting(
    logger: P.Logger,
    roomId: string
): Promise<Meeting & { conferenceId: string }> {
    const existingChimeMeetingData = await getExistingRoomChimeMeeting(logger, roomId);

    if (existingChimeMeetingData) {
        return existingChimeMeetingData;
    }

    try {
        const { conferenceId, subconferenceId } = await getRoomConferenceId(roomId);
        const chimeMeetingData = await createRoomChimeMeeting(logger, roomId, conferenceId, subconferenceId);
        return { ...chimeMeetingData, conferenceId };
    } catch (e: any) {
        const existingChimeMeetingData = await getExistingRoomChimeMeeting(logger, roomId);
        if (existingChimeMeetingData) {
            return { ...existingChimeMeetingData, conferenceId: existingChimeMeetingData.conferenceId };
        }

        logger.error({ err: e, roomId }, "Could not get Chime meeting data");
        throw new Error("Could not get Chime meeting data");
    }
}

export async function getRoomVonageMeeting(roomId: string): Promise<string | null> {
    const existingVonageMeetingId = await getExistingRoomVonageMeeting(roomId);

    if (existingVonageMeetingId) {
        return existingVonageMeetingId;
    }

    // TODO: create session if appropriate

    return null;
}

export async function getRoomByVonageSessionId(
    sessionId: string
): Promise<{ roomId: string; conferenceId: string; subconferenceId: string | null | undefined } | null> {
    gql`
        query GetRoomBySessionId($sessionId: String!) {
            room_Room(where: { publicVonageSessionId: { _eq: $sessionId } }) {
                id
                conferenceId
                subconferenceId
            }
        }
    `;

    const roomResult = await apolloClient.query({
        query: GetRoomBySessionIdDocument,
        variables: {
            sessionId,
        },
    });

    return roomResult.data.room_Room.length === 1
        ? {
              roomId: roomResult.data.room_Room[0].id,
              conferenceId: roomResult.data.room_Room[0].conferenceId,
              subconferenceId: roomResult.data.room_Room[0].subconferenceId,
          }
        : null;
}

export async function getRoomByChimeMeetingId(
    meetingId: string
): Promise<{ roomId: string; conferenceId: string; subconferenceId: string | null | undefined } | null> {
    gql`
        query GetRoomByChimeMeetingId($meetingId: String!) {
            room_Room(where: { chimeMeeting: { chimeMeetingId: { _eq: $meetingId } } }) {
                id
                conferenceId
                subconferenceId
            }
        }
    `;

    const roomResult = await apolloClient.query({
        query: GetRoomByChimeMeetingIdDocument,
        variables: {
            meetingId,
        },
    });

    return roomResult.data.room_Room.length === 1
        ? {
              roomId: roomResult.data.room_Room[0].id,
              conferenceId: roomResult.data.room_Room[0].conferenceId,
              subconferenceId: roomResult.data.room_Room[0].subconferenceId,
          }
        : null;
}
