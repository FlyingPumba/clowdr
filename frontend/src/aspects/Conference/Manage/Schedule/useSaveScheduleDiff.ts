import { assert } from "@midspace/assert";
import type { CombinedError } from "@urql/core";
import { gql } from "@urql/core";
import { useEffect, useMemo, useState } from "react";
import type {
    Collection_Tag_Insert_Input,
    Conference_OriginatingData_Insert_Input,
    Room_Room_Insert_Input,
} from "../../../../generated/graphql";
import {
    Room_Mode_Enum,
    useDeleteEventsMutation,
    useDeleteOriginatingDatasMutation,
    useDeleteRoomsMutation,
    useDeleteTagsMutation,
    useInsertEventMutation,
    useInsertOriginatingDatasMutation,
    useInsertRoomsMutation,
    useInsertTagsMutation,
    useSelectWholeScheduleQuery,
    useUpdateEventMutation,
    useUpdateRoomMutation,
    useUpdateTagMutation,
} from "../../../../generated/graphql";
import { makeContext } from "../../../GQL/make-context";
import useQueryErrorToast from "../../../GQL/useQueryErrorToast";
import { useConference } from "../../useConference";
import type { ExhibitionDescriptor, ItemDescriptor, ProgramPersonDescriptor } from "../Content/Types";
import type { OriginatingDataDescriptor, TagDescriptor } from "../Shared/Types";
import { convertScheduleToDescriptors } from "./Functions";
import type { EventDescriptor, RoomDescriptor } from "./Types";

gql`
    fragment RoomInfo on room_Room {
        capacity
        conferenceId
        currentModeName
        id
        name
        priority
        originatingDataId
        originatingEventId
        originatingItemId
        managementModeName
        isProgramRoom
        originatingData {
            ...OriginatingDataInfo
        }
    }

    fragment EventInfo on schedule_Event {
        conferenceId
        id
        durationSeconds
        eventPeople {
            ...EventProgramPersonInfo
        }
        id
        intendedRoomModeName
        name
        originatingDataId
        roomId
        startTime
        endTime
        itemId
        exhibitionId
        shufflePeriodId
        enableRecording
    }

    fragment EventProgramPersonInfo on schedule_EventProgramPerson {
        id
        eventId
        roleName
        personId
    }

    query SelectWholeSchedule($conferenceId: uuid!) {
        room_Room(where: { conferenceId: { _eq: $conferenceId }, managementModeName: { _in: [PUBLIC, PRIVATE] } }) {
            ...RoomInfo
        }
        schedule_Event(
            where: { conferenceId: { _eq: $conferenceId } }
            order_by: [{ startTime: asc }, { endTime: asc }]
        ) {
            ...EventInfo
        }
        conference_OriginatingData(where: { conferenceId: { _eq: $conferenceId } }) {
            ...OriginatingDataInfo
        }
        collection_Tag(where: { conferenceId: { _eq: $conferenceId } }) {
            ...TagInfo
        }
        collection_Exhibition(where: { conferenceId: { _eq: $conferenceId } }) {
            ...ExhibitionInfo
        }
        content_Item(where: { conferenceId: { _eq: $conferenceId } }) {
            ...ItemFullNestedInfo
        }
        collection_ProgramPerson(where: { conferenceId: { _eq: $conferenceId } }) {
            ...ProgramPersonInfo
        }
    }

    mutation InsertRooms($newRooms: [room_Room_insert_input!]!) {
        insert_room_Room(objects: $newRooms) {
            returning {
                ...RoomInfo
            }
        }
    }

    mutation DeleteRooms($deleteRoomIds: [uuid!]!) {
        delete_room_Room(where: { id: { _in: $deleteRoomIds } }) {
            returning {
                id
            }
        }
    }

    mutation UpdateRoom(
        $id: uuid!
        $name: String!
        $capacity: Int = null
        $originatingDataId: uuid = null
        $priority: Int!
    ) {
        update_room_Room_by_pk(
            pk_columns: { id: $id }
            _set: { name: $name, capacity: $capacity, originatingDataId: $originatingDataId, priority: $priority }
        ) {
            ...RoomInfo
        }
    }

    mutation DeleteEvents($deleteEventIds: [uuid!]!) {
        delete_schedule_Event(where: { id: { _in: $deleteEventIds } }) {
            returning {
                id
            }
        }
    }

    mutation InsertEvent($newEvent: schedule_Event_insert_input!, $newEventId: uuid!, $insertContinuation: Boolean!) {
        insert_schedule_Event_one(object: $newEvent) {
            ...EventInfo
        }
        insert_schedule_Continuation_one(
            object: {
                colour: "#4471de"
                defaultFor: "Presenters"
                description: "Join the discussion room"
                fromEvent: $newEventId
                isActiveChoice: false
                priority: 0
                to: { type: "AutoDiscussionRoom", id: null }
            }
        ) @include(if: $insertContinuation) {
            id
        }
    }

    mutation UpdateEvent(
        $eventId: uuid!
        $roomId: uuid!
        $intendedRoomModeName: room_Mode_enum!
        $originatingDataId: uuid = null
        $name: String!
        $startTime: timestamptz!
        $durationSeconds: Int!
        $itemId: uuid = null
        $exhibitionId: uuid = null
    ) {
        update_schedule_Event_by_pk(
            pk_columns: { id: $eventId }
            _set: {
                roomId: $roomId
                intendedRoomModeName: $intendedRoomModeName
                originatingDataId: $originatingDataId
                name: $name
                startTime: $startTime
                durationSeconds: $durationSeconds
                itemId: $itemId
                exhibitionId: $exhibitionId
            }
        ) {
            ...EventInfo
        }
    }
`;

export type WholeScheduleStateT =
    | {
          events: Map<string, EventDescriptor>;
          tags: Map<string, TagDescriptor>;
          exhibitions: Map<string, ExhibitionDescriptor>;
          rooms: Map<string, RoomDescriptor>;
          originatingDatas: Map<string, OriginatingDataDescriptor>;
          people: Map<string, ProgramPersonDescriptor>;
          items: ItemDescriptor[];
      }
    | undefined;

export function useSaveScheduleDiff():
    | {
          loadingContent: true;
          errorContent: CombinedError | undefined;
          originalEvents: undefined;
          originalTags: undefined;
          originalExhibitions: undefined;
          originalOriginatingDatas: undefined;
          originalRooms: undefined;
          originalPeople: undefined;
          items: undefined;
      }
    | {
          loadingContent: false;
          errorContent: CombinedError;
          originalEvents: undefined;
          originalTags: undefined;
          originalExhibitions: undefined;
          originalOriginatingDatas: undefined;
          originalRooms: undefined;
          originalPeople: undefined;
          items: undefined;
      }
    | {
          loadingContent: false;
          errorContent: undefined;
          originalEvents: undefined;
          originalTags: undefined;
          originalExhibitions: undefined;
          originalOriginatingDatas: undefined;
          originalRooms: undefined;
          originalPeople: undefined;
          items: undefined;
      }
    | {
          loadingContent: boolean;
          errorContent: undefined;
          originalEvents: Map<string, EventDescriptor>;
          originalTags: Map<string, TagDescriptor>;
          originalExhibitions: Map<string, ExhibitionDescriptor>;
          originalOriginatingDatas: Map<string, OriginatingDataDescriptor>;
          originalRooms: Map<string, RoomDescriptor>;
          originalPeople: Map<string, ProgramPersonDescriptor>;
          items: ItemDescriptor[];
          saveScheduleDiff: (
              dirtyKeys: {
                  tagKeys: Set<string>;
                  originatingDataKeys: Set<string>;
                  eventKeys: Set<string>;
                  roomKeys: Set<string>;
              },
              tags: Map<string, TagDescriptor>,
              originatingDatas: Map<string, OriginatingDataDescriptor>,
              events: Map<string, EventDescriptor>,
              rooms: Map<string, RoomDescriptor>
          ) => Promise<{
              events: Map<string, boolean>;
              tags: Map<string, boolean>;
              originatingDatas: Map<string, boolean>;
              rooms: Map<string, boolean>;
          }>;
      } {
    const conference = useConference();

    const [, insertRoomsMutation] = useInsertRoomsMutation();
    const [, deleteRoomsMutation] = useDeleteRoomsMutation();
    const [, updateRoomMutation] = useUpdateRoomMutation();
    const [, insertOriginatingDatasMutation] = useInsertOriginatingDatasMutation();
    const [, deleteOriginatingDatasMutation] = useDeleteOriginatingDatasMutation();
    const [, insertTagsMutation] = useInsertTagsMutation();
    const [, deleteTagsMutation] = useDeleteTagsMutation();
    const [, updateTagMutation] = useUpdateTagMutation();

    const [, deleteEventsMutation] = useDeleteEventsMutation();
    const [, insertEventMutation] = useInsertEventMutation();
    const [, updateEventMutation] = useUpdateEventMutation();

    const context = useMemo(
        () =>
            makeContext({
                "X-Auth-Role": "organizer",
            }),
        []
    );
    const [{ fetching: loadingContent, error: errorContent, data: wholeSchedule }] = useSelectWholeScheduleQuery({
        requestPolicy: "network-only",
        variables: {
            conferenceId: conference.id,
        },
        context,
    });
    useQueryErrorToast(errorContent, false);

    const [original, setOriginal] = useState<WholeScheduleStateT>();
    useEffect(() => {
        if (wholeSchedule) {
            setOriginal(convertScheduleToDescriptors(wholeSchedule));
        }
    }, [wholeSchedule]);

    if (loadingContent && !original) {
        return {
            loadingContent: loadingContent,
            errorContent: errorContent,
            originalEvents: undefined,
            originalTags: undefined,
            originalExhibitions: undefined,
            originalOriginatingDatas: undefined,
            originalRooms: undefined,
            originalPeople: undefined,
            items: undefined,
        };
    } else if (errorContent) {
        return {
            loadingContent: loadingContent,
            errorContent: errorContent,
            originalEvents: undefined,
            originalTags: undefined,
            originalExhibitions: undefined,
            originalOriginatingDatas: undefined,
            originalRooms: undefined,
            originalPeople: undefined,
            items: undefined,
        };
    } else if (!original) {
        return {
            loadingContent: loadingContent,
            errorContent: errorContent,
            originalEvents: undefined,
            originalTags: undefined,
            originalExhibitions: undefined,
            originalOriginatingDatas: undefined,
            originalRooms: undefined,
            originalPeople: undefined,
            items: undefined,
        };
    } else {
        return {
            loadingContent: loadingContent,
            errorContent: errorContent,
            originalEvents: original.events,
            originalOriginatingDatas: original.originatingDatas,
            originalTags: original.tags,
            originalExhibitions: original.exhibitions,
            originalRooms: original.rooms,
            originalPeople: original.people,
            items: original.items,
            saveScheduleDiff: async function saveScheduleDiff(
                { eventKeys, originatingDataKeys, tagKeys, roomKeys },
                tags,
                originatingDatas,
                events,
                rooms
            ) {
                const tagResults: Map<string, boolean> = new Map();
                tagKeys.forEach((key) => {
                    tagResults.set(key, false);
                });

                const originatingDataResults: Map<string, boolean> = new Map();
                originatingDataKeys.forEach((key) => {
                    originatingDataResults.set(key, false);
                });

                const eventResults: Map<string, boolean> = new Map();
                eventKeys.forEach((key) => {
                    eventResults.set(key, false);
                });

                const roomResults: Map<string, boolean> = new Map();
                roomKeys.forEach((key) => {
                    roomResults.set(key, false);
                });

                const newTags = new Map<string, TagDescriptor>();
                const updatedTags = new Map<string, TagDescriptor>();
                const deletedTagKeys = new Set<string>();
                for (const key of tagKeys.values()) {
                    const tag = tags.get(key);
                    if (tag) {
                        if (tag.isNew) {
                            newTags.set(key, tag);
                        } else {
                            updatedTags.set(key, tag);
                        }
                    } else {
                        deletedTagKeys.add(key);
                    }
                }

                const newOriginatingDatas = new Map<string, OriginatingDataDescriptor>();
                const updatedOriginatingDatas = new Map<string, OriginatingDataDescriptor>();
                const deletedOriginatingDataKeys = new Set<string>();
                for (const key of originatingDataKeys.values()) {
                    const originatingData = originatingDatas.get(key);
                    if (originatingData) {
                        if (originatingData.isNew) {
                            newOriginatingDatas.set(key, originatingData);
                        } else {
                            updatedOriginatingDatas.set(key, originatingData);
                        }
                    } else {
                        deletedOriginatingDataKeys.add(key);
                    }
                }

                const newEvents = new Map<string, EventDescriptor>();
                const updatedEvents = new Map<string, EventDescriptor>();
                const deletedEventKeys = new Set<string>();
                for (const key of eventKeys.values()) {
                    const event = events.get(key);
                    if (event) {
                        if (event.isNew) {
                            newEvents.set(key, event);
                        } else {
                            updatedEvents.set(key, event);
                        }
                    } else {
                        deletedEventKeys.add(key);
                    }
                }

                const newRooms = new Map<string, RoomDescriptor>();
                const updatedRooms = new Map<string, RoomDescriptor>();
                const deletedRoomKeys = new Set<string>();
                for (const key of roomKeys.values()) {
                    const room = rooms.get(key);
                    if (room) {
                        if (room.isNew) {
                            newRooms.set(key, room);
                        } else {
                            updatedRooms.set(key, room);
                        }
                    } else {
                        deletedRoomKeys.add(key);
                    }
                }

                try {
                    if (newTags.size > 0) {
                        await insertTagsMutation(
                            {
                                newTags: Array.from(newTags.values()).map(
                                    (tag): Collection_Tag_Insert_Input => ({
                                        id: tag.id,
                                        name: tag.name,
                                        colour: tag.colour,
                                        conferenceId: conference.id,
                                        originatingDataId: tag.originatingDataId,
                                    })
                                ),
                            },
                            {
                                fetchOptions: {
                                    headers: {
                                        "X-Auth-Role": "organizer",
                                    },
                                },
                            }
                        );
                        for (const key of newTags.keys()) {
                            tagResults.set(key, true);
                        }
                    }

                    const updateTagResultsArr: [string, boolean][] = await Promise.all(
                        Array.from(updatedTags.values()).map(async (tag): Promise<[string, boolean]> => {
                            let ok = false;
                            try {
                                await updateTagMutation(
                                    {
                                        id: tag.id,
                                        colour: tag.colour,
                                        name: tag.name,
                                        originatingDataId: tag.originatingDataId,
                                    },
                                    {
                                        fetchOptions: {
                                            headers: {
                                                "X-Auth-Role": "organizer",
                                            },
                                        },
                                    }
                                );
                                ok = true;
                            } catch (_e) {
                                ok = false;
                            }
                            return [tag.id, ok];
                        })
                    );
                    for (const [key, val] of updateTagResultsArr) {
                        tagResults.set(key, val);
                    }

                    if (newOriginatingDatas.size > 0) {
                        await insertOriginatingDatasMutation(
                            {
                                newDatas: Array.from(newOriginatingDatas.values()).map(
                                    (originatingData): Conference_OriginatingData_Insert_Input => ({
                                        id: originatingData.id,
                                        conferenceId: conference.id,
                                        data: originatingData.data,
                                        sourceId: originatingData.sourceId,
                                    })
                                ),
                            },
                            {
                                fetchOptions: {
                                    headers: {
                                        "X-Auth-Role": "organizer",
                                    },
                                },
                            }
                        );
                        for (const key of newOriginatingDatas.keys()) {
                            originatingDataResults.set(key, true);
                        }
                    }

                    if (newRooms.size > 0) {
                        await insertRoomsMutation(
                            {
                                newRooms: Array.from(newRooms.values()).map(
                                    (room): Room_Room_Insert_Input => ({
                                        id: room.id,
                                        conferenceId: conference.id,
                                        name: room.name,
                                        originatingDataId: room.originatingDataId,
                                        capacity: room.capacity,
                                        priority: room.priority,
                                        currentModeName: Room_Mode_Enum.VideoChat,
                                    })
                                ),
                            },
                            {
                                fetchOptions: {
                                    headers: {
                                        "X-Auth-Role": "organizer",
                                    },
                                },
                            }
                        );
                        for (const key of newRooms.keys()) {
                            roomResults.set(key, true);
                        }
                    }

                    const updateRoomResultsArr: [string, boolean][] = await Promise.all(
                        Array.from(updatedRooms.values()).map(async (room): Promise<[string, boolean]> => {
                            let ok = false;
                            try {
                                await updateRoomMutation(
                                    {
                                        id: room.id,
                                        name: room.name,
                                        capacity: room.capacity,
                                        originatingDataId: room.originatingDataId,
                                        priority: room.priority,
                                    },
                                    {
                                        fetchOptions: {
                                            headers: {
                                                "X-Auth-Role": "organizer",
                                            },
                                        },
                                    }
                                );
                                ok = true;
                            } catch (_e) {
                                ok = false;
                            }
                            return [room.id, ok];
                        })
                    );
                    for (const [key, val] of updateRoomResultsArr) {
                        roomResults.set(key, val);
                    }

                    if (deletedEventKeys.size > 0 || newEvents.size > 0) {
                        await deleteEventsMutation({
                            deleteEventIds: Array.from(deletedEventKeys.values()),
                        });
                        await Promise.all(
                            Array.from(newEvents.values()).map((event) =>
                                insertEventMutation(
                                    {
                                        newEvent: {
                                            id: event.id,
                                            conferenceId: conference.id,
                                            roomId: event.roomId,
                                            intendedRoomModeName: event.intendedRoomModeName,
                                            itemId: event.itemId,
                                            exhibitionId: event.exhibitionId,
                                            name: event.name,
                                            startTime: new Date(event.startTime).toISOString(),
                                            durationSeconds: event.durationSeconds,
                                            originatingDataId: event.originatingDataId,
                                            enableRecording: event.enableRecording,
                                        },
                                        newEventId: event.id,
                                        insertContinuation:
                                            (event.intendedRoomModeName === Room_Mode_Enum.Presentation ||
                                                event.intendedRoomModeName === Room_Mode_Enum.QAndA) &&
                                            event.itemId
                                                ? true
                                                : false,
                                    },
                                    {
                                        fetchOptions: {
                                            headers: {
                                                "X-Auth-Role": "organizer",
                                            },
                                        },
                                    }
                                )
                            )
                        );

                        for (const key of newEvents.keys()) {
                            eventResults.set(key, true);
                        }
                        for (const key of deletedEventKeys.keys()) {
                            eventResults.set(key, true);
                        }
                    }
                } catch (_e) {
                    for (const key of newEvents.keys()) {
                        eventResults.set(key, false);
                    }
                    for (const key of deletedEventKeys.keys()) {
                        eventResults.set(key, false);
                    }
                }

                const updateEventResultsArr: [string, boolean][] = await Promise.all(
                    Array.from(updatedEvents.values()).map(async (event): Promise<[string, boolean]> => {
                        let ok = false;
                        try {
                            const existingEvent = original.events.get(event.id);
                            assert.truthy(existingEvent);

                            await updateEventMutation(
                                {
                                    eventId: event.id,
                                    originatingDataId: event.originatingDataId,
                                    roomId: event.roomId,
                                    intendedRoomModeName: event.intendedRoomModeName,
                                    itemId: event.itemId,
                                    exhibitionId: event.exhibitionId,
                                    name: event.name,
                                    startTime: new Date(event.startTime).toISOString(),
                                    durationSeconds: event.durationSeconds,
                                },
                                {
                                    fetchOptions: {
                                        headers: {
                                            "X-Auth-Role": "organizer",
                                        },
                                    },
                                }
                            );

                            ok = true;
                        } catch (e) {
                            ok = false;
                        }
                        return [event.id, ok];
                    })
                );
                for (const [key, val] of updateEventResultsArr) {
                    eventResults.set(key, val);
                }

                try {
                    if (deletedTagKeys.size > 0) {
                        await deleteTagsMutation({
                            deleteTagIds: Array.from(deletedTagKeys.values()),
                        });
                        for (const key of deletedTagKeys.keys()) {
                            tagResults.set(key, true);
                        }
                    }
                } catch {
                    for (const key of deletedTagKeys.keys()) {
                        tagResults.set(key, false);
                    }
                }

                try {
                    if (deletedRoomKeys.size > 0) {
                        await deleteRoomsMutation(
                            {
                                deleteRoomIds: Array.from(deletedRoomKeys.values()),
                            },
                            {
                                fetchOptions: {
                                    headers: {
                                        "X-Auth-Role": "organizer",
                                    },
                                },
                            }
                        );
                        for (const key of deletedRoomKeys.keys()) {
                            roomResults.set(key, true);
                        }
                    }
                } catch {
                    for (const key of deletedRoomKeys.keys()) {
                        roomResults.set(key, false);
                    }
                }

                try {
                    if (deletedOriginatingDataKeys.size > 0) {
                        await deleteOriginatingDatasMutation(
                            {
                                deleteDataIds: Array.from(deletedOriginatingDataKeys.values()),
                            },
                            {
                                fetchOptions: {
                                    headers: {
                                        "X-Auth-Role": "organizer",
                                    },
                                },
                            }
                        );
                        for (const key of deletedOriginatingDataKeys.keys()) {
                            originatingDataResults.set(key, true);
                        }
                    }
                } catch {
                    for (const key of deletedOriginatingDataKeys.keys()) {
                        originatingDataResults.set(key, false);
                    }
                }

                return {
                    events: eventResults,
                    originatingDatas: originatingDataResults,
                    tags: tagResults,
                    rooms: roomResults,
                };
            },
        };
    }
}
