import { gql } from "@apollo/client";
import {
    Accordion,
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Box,
    Code,
    Heading,
    ListItem,
    Text,
    UnorderedList,
} from "@chakra-ui/react";
import assert from "assert";
import React, { useMemo } from "react";
import {
    Maybe,
    Permission_Enum,
    RoomMode_Enum,
    RoomParticipantWithAttendeeInfoFragment,
    RoomWithParticipantInfoFragment,
    useCreateRoomMutation,
    useDeleteRoomsMutation,
    useSelectAllRoomsWithParticipantsQuery,
    useUpdateRoomMutation,
} from "../../../generated/graphql";
import CRUDTable, {
    CRUDTableProps,
    defaultIntegerFilter,
    defaultStringFilter,
    FieldType,
    UpdateResult,
} from "../../CRUDTable/CRUDTable";
import PageNotFound from "../../Errors/PageNotFound";
import ApolloQueryWrapper from "../../GQL/ApolloQueryWrapper";
import isValidUUID from "../../Utils/isValidUUID";
import RequireAtLeastOnePermissionWrapper from "../RequireAtLeastOnePermissionWrapper";
import { useConference } from "../useConference";
import useDashboardPrimaryMenuButtons from "./useDashboardPrimaryMenuButtons";

gql`
    fragment RoomParticipantWithAttendeeInfo on RoomParticipant {
        id
        conferenceId
        attendeeId
        roomId

        attendee {
            displayName
        }
    }

    fragment RoomWithParticipantInfo on Room {
        id
        conferenceId
        name
        currentModeName
        capacity
        participants {
            ...RoomParticipantWithAttendeeInfo
        }
        originatingData {
            ...OriginatingDataInfo
        }
    }

    query SelectAllRoomsWithParticipants($conferenceId: uuid!) {
        Room(where: { conferenceId: { _eq: $conferenceId } }) {
            ...RoomWithParticipantInfo
        }
    }

    mutation CreateRoom($room: Room_insert_input!) {
        insert_Room(objects: [$room]) {
            returning {
                ...RoomWithParticipantInfo
            }
        }
    }

    mutation UpdateRoomsWithParticipants($id: uuid!, $name: String!, $capacity: Int!) {
        update_Room_by_pk(pk_columns: { id: $id }, _set: { name: $name, capacity: $capacity }) {
            ...RoomWithParticipantInfo
        }
    }
`;

interface RoomWithParticipantInfo {
    id: string;
    conferenceId: string;
    name: string;
    currentModeName: RoomMode_Enum;
    capacity?: Maybe<number>;
    participants: ReadonlyArray<RoomParticipantWithAttendeeInfoFragment>;
}

const RoomsCRUDTable = (props: Readonly<CRUDTableProps<RoomWithParticipantInfo, "id">>) => CRUDTable(props);

function RoomSecondaryEditor({ room }: { room: RoomWithParticipantInfoFragment }): JSX.Element {
    return (
        <Accordion>
            <AccordionItem>
                <AccordionButton>
                    <Box flex="1" textAlign="left">
                        Participants
                    </Box>
                    <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pt={4} pb={4}>
                    {room.participants.length === 0 ? (
                        "Room is currently empty."
                    ) : (
                        <UnorderedList>
                            {room.participants.map((participant) => (
                                <ListItem key={participant.id}>{participant.attendee.displayName}</ListItem>
                            ))}
                        </UnorderedList>
                    )}
                </AccordionPanel>
            </AccordionItem>

            {room.originatingData ? (
                <AccordionItem>
                    <AccordionButton>
                        <Box flex="1" textAlign="left">
                            Section 2 title
                        </Box>
                        <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pt={4} pb={4}>
                        <>
                            <Text>The following shows the raw data received when this room was imported.</Text>
                            <Text as="pre" w="100%" overflowWrap="break-word" whiteSpace="pre-wrap" mt={2}>
                                <Code w="100%" p={2}>
                                    Source Ids: {JSON.stringify(room.originatingData.sourceId.split("¬"), null, 2)}
                                </Code>
                            </Text>
                            <Text as="pre" w="100%" overflowWrap="break-word" whiteSpace="pre-wrap" mt={2}>
                                <Code w="100%" p={2}>
                                    {JSON.stringify(room.originatingData.data, null, 2)}
                                </Code>
                            </Text>
                        </>
                    </AccordionPanel>
                </AccordionItem>
            ) : undefined}
        </Accordion>
    );
}

function EditableRoomsCRUDTable({ originalData }: { originalData: ReadonlyArray<RoomWithParticipantInfoFragment> }) {
    const data = useMemo(() => {
        return new Map<string, RoomWithParticipantInfo>(
            originalData.map((room): [string, RoomWithParticipantInfo] => {
                return [room.id, { ...room }];
            })
        );
    }, [originalData]);

    const conference = useConference();
    const [createRoom] = useCreateRoomMutation();
    const [deleteRooms] = useDeleteRoomsMutation();
    const [updateRoom] = useUpdateRoomMutation();

    return (
        <RoomsCRUDTable
            data={data}
            primaryFields={{
                keyField: {
                    heading: "Id",
                    ariaLabel: "Unique identifier",
                    description: "Unique identifier",
                    isHidden: true,
                    insert: (item, v) => {
                        return {
                            ...item,
                            id: v,
                        };
                    },
                    extract: (v) => v.id,
                    spec: {
                        fieldType: FieldType.string,
                        convertToUI: (x) => x,
                        disallowSpaces: true,
                    },
                    validate: (v) => isValidUUID(v) || ["Invalid UUID"],
                    getRowTitle: (v) => v.name,
                },
                otherFields: {
                    name: {
                        heading: "Name",
                        ariaLabel: "Name",
                        description: "Name of the room",
                        isHidden: false,
                        isEditable: true,
                        defaultValue: "New room name",
                        insert: (room, v) => {
                            return {
                                ...room,
                                name: v,
                            };
                        },
                        extract: (v) => v.name,
                        spec: {
                            fieldType: FieldType.string,
                            convertFromUI: (x) => x,
                            convertToUI: (x) => x,
                            filter: defaultStringFilter,
                        },
                        validate: (v) => v.length >= 3 || ["Name must be at least 3 characters"],
                    },
                    capacity: {
                        heading: "Capacity",
                        ariaLabel: "Capacity",
                        description: "The maximum number of attendees that can participate in the room at once.",
                        isHidden: false,
                        isEditable: true,
                        defaultValue: null,
                        insert: (item, v) => {
                            return {
                                ...item,
                                capacity: v,
                            };
                        },
                        extract: (v) => v.capacity,
                        spec: {
                            fieldType: FieldType.integer,
                            convertToUI: (x) => (x === -1 || x === null ? 3000 : x),
                            convertFromUI: (x) => (x === -1 || x === 3000 ? null : x),
                            filter: defaultIntegerFilter,
                            max: 3000,
                            min: -1,
                        },
                    },
                    currentModeName: {
                        heading: "Current Mode",
                        ariaLabel: "Current Mode",
                        description: "Current mode of the room",
                        isHidden: false,
                        extract: (v) => v.currentModeName,
                        spec: {
                            fieldType: FieldType.string,
                            convertToUI: (x) => x[0] + x.substr(1).toLowerCase(),
                            filter: defaultStringFilter,
                        },
                    },
                },
            }}
            csud={{
                cudCallbacks: {
                    create: async (value: Partial<RoomWithParticipantInfo>): Promise<string | null> => {
                        assert(value.name);
                        const newRoom = await createRoom({
                            variables: {
                                room: {
                                    conferenceId: conference.id,
                                    capacity: value.capacity,
                                    name: value.name,
                                },
                            },
                        });
                        if (newRoom.data?.insert_Room?.returning && newRoom.data.insert_Room.returning.length > 0) {
                            return newRoom.data.insert_Room.returning[0].id;
                        }
                        return null;
                    },
                    update: async (
                        values: Map<string, RoomWithParticipantInfo>
                    ): Promise<Map<string, UpdateResult>> => {
                        const results = new Map<string, UpdateResult>();

                        for (const [key, value] of values) {
                            results.set(key, ["Not attempted"]);
                            try {
                                await updateRoom({
                                    variables: {
                                        id: value.id,
                                        name: value.name,
                                        capacity: value.capacity,
                                    },
                                });
                                results.set(key, true);
                            } catch (e) {
                                results.set(key, [e.toString()]);
                            }
                        }

                        return results;
                    },
                    delete: async (values: Set<string>): Promise<Map<string, boolean>> => {
                        const ids = Array.from(values.values());
                        await deleteRooms({
                            variables: {
                                deleteRoomIds: ids,
                            },
                        });
                        return new Map(ids.map((id) => [id, true]));
                    },
                },
            }}
            secondaryFields={{
                editSingle: (key, onClose, isDirty, markDirty) => {
                    const room = data.get(key);
                    assert(room);
                    return {
                        editorElement: <RoomSecondaryEditor room={room} />,
                        footerButtons: [],
                        includeCloseButton: true,
                    };
                },
            }}
        />
    );
}

export default function ManageConferenceRoomsPage(): JSX.Element {
    const conference = useConference();

    useDashboardPrimaryMenuButtons();

    const selectAllRoomsResult = useSelectAllRoomsWithParticipantsQuery({
        variables: {
            conferenceId: conference.id,
        },
    });

    return (
        <RequireAtLeastOnePermissionWrapper
            permissions={[Permission_Enum.ConferenceManageSchedule]}
            componentIfDenied={<PageNotFound />}
        >
            <Heading as="h1" fontSize="2.3rem" lineHeight="3rem">
                Manage {conference.shortName}
            </Heading>
            <Heading as="h2" fontSize="1.7rem" lineHeight="2.4rem" fontStyle="italic">
                Rooms
            </Heading>
            <ApolloQueryWrapper queryResult={selectAllRoomsResult}>
                {(data) => {
                    return <EditableRoomsCRUDTable originalData={data.Room} />;
                }}
            </ApolloQueryWrapper>
        </RequireAtLeastOnePermissionWrapper>
    );
}
