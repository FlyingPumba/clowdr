import { gql } from "@apollo/client/core";
import type { EventPayload } from "@midspace/hasura/event";
import type { ShuffleQueueEntryData } from "@midspace/hasura/event-data";
import type { P } from "pino";
import type {
    ActiveShufflePeriodFragment,
    ActiveShuffleRoomFragment,
    UnallocatedShuffleQueueEntryFragment,
} from "../generated/graphql";
import {
    AddPeopleToExistingShuffleRoomDocument,
    ExpireShuffleQueueEntriesDocument,
    InsertManagedRoomDocument,
    InsertShuffleRoomDocument,
    Room_PersonRole_Enum,
    Room_ShuffleAlgorithm_Enum,
    SelectActiveShufflePeriodsDocument,
    SelectShufflePeriodDocument,
    SetAutoPinOnManagedRoomDocument,
    SetShuffleRoomsEndedDocument,
} from "../generated/graphql";
import { apolloClient } from "../graphqlClient";
import { kickAllRegistrantsFromVonageRoom } from "../lib/vonage/vonageTools";

gql`
    fragment UnallocatedShuffleQueueEntry on room_ShuffleQueueEntry {
        registrantId
        id
        created_at
    }

    fragment ActiveShuffleRoom on room_ShuffleRoom {
        id
        startedAt
        durationMinutes
        room {
            id
            people: roomMemberships {
                id
                registrantId
            }
            publicVonageSessionId
        }
    }

    fragment ActiveShufflePeriod on room_ShufflePeriod {
        conferenceId
        subconferenceId
        endAt
        id
        maxRegistrantsPerRoom
        name
        organiserId
        roomDurationMinutes
        startAt
        targetRegistrantsPerRoom
        waitRoomMaxDurationSeconds
        algorithm
        unallocatedQueueEntries: queueEntries(
            where: { allocatedShuffleRoomId: { _is_null: true }, isExpired: { _eq: false } }
            order_by: { id: asc }
        ) {
            ...UnallocatedShuffleQueueEntry
        }
        activeRooms: shuffleRooms(where: { isEnded: { _eq: false } }) {
            ...ActiveShuffleRoom
        }
        events(where: { scheduledStartTime: { _lte: $now }, scheduledEndTime: { _gte: $now } }) {
            id
            scheduledEndTime
        }
    }

    query SelectShufflePeriod($id: uuid!, $now: timestamptz!) {
        room_ShufflePeriod_by_pk(id: $id) {
            ...ActiveShufflePeriod
        }
    }

    query SelectActiveShufflePeriods($from: timestamptz!, $until: timestamptz!, $now: timestamptz!) {
        room_ShufflePeriod(where: { startAt: { _lte: $until }, endAt: { _gte: $from } }) {
            ...ActiveShufflePeriod
        }
    }

    mutation AddPeopleToExistingShuffleRoom(
        $shuffleRoomId: Int!
        $roomMemberships: [room_RoomMembership_insert_input!]!
        $queueEntryIds: [bigint!]!
    ) {
        insert_room_RoomMembership(objects: $roomMemberships) {
            affected_rows
        }
        update_room_ShuffleQueueEntry(
            where: { id: { _in: $queueEntryIds }, allocatedShuffleRoomId: { _is_null: true } }
            _set: { allocatedShuffleRoomId: $shuffleRoomId }
        ) {
            affected_rows
            returning {
                id
            }
        }
    }

    mutation ExpireShuffleQueueEntries($queueEntryIds: [bigint!]!) {
        update_room_ShuffleQueueEntry(
            where: { id: { _in: $queueEntryIds }, allocatedShuffleRoomId: { _is_null: true } }
            _set: { isExpired: true }
        ) {
            affected_rows
            returning {
                id
            }
        }
    }

    mutation InsertShuffleRoom(
        $durationMinutes: Int!
        $reshuffleUponEnd: Boolean!
        $roomId: uuid!
        $shufflePeriodId: uuid!
        $startedAt: timestamptz!
    ) {
        insert_room_ShuffleRoom_one(
            object: {
                durationMinutes: $durationMinutes
                isEnded: false
                reshuffleUponEnd: $reshuffleUponEnd
                roomId: $roomId
                shufflePeriodId: $shufflePeriodId
                startedAt: $startedAt
            }
        ) {
            id
        }
    }

    mutation InsertManagedRoom($conferenceId: uuid!, $subconferenceId: uuid, $capacity: Int!, $name: String!) {
        insert_room_Room_one(
            object: {
                capacity: $capacity
                conferenceId: $conferenceId
                subconferenceId: $subconferenceId
                name: $name
                managementModeName: MANAGED
            }
        ) {
            id
        }
    }

    mutation SetAutoPinOnManagedRoom($roomId: uuid!) {
        update_chat_Chat(where: { room: { id: { _eq: $roomId } } }, _set: { enableAutoPin: true }) {
            affected_rows
        }
    }

    mutation SetShuffleRoomsEnded($ids: [bigint!]!) {
        update_room_ShuffleRoom(where: { id: { _in: $ids } }, _set: { isEnded: true }) {
            affected_rows
            returning {
                id
            }
        }
    }
`;

type ShuffleRoomAllocationInfo = {
    id: number;
    roomId: string;
    peopleRegistrantIds: string[];
    durationMinutes: number;
    startedAt: string;
};

async function allocateToExistingRoom(
    entries: UnallocatedShuffleQueueEntryFragment[],
    room: ShuffleRoomAllocationInfo,
    unallocatedQueueEntries: Map<number, UnallocatedShuffleQueueEntryFragment>
): Promise<void> {
    await apolloClient.mutate({
        mutation: AddPeopleToExistingShuffleRoomDocument,
        variables: {
            queueEntryIds: entries.map((x) => x.id),
            shuffleRoomId: room.id,
            roomMemberships: entries.map((entry) => ({
                registrantId: entry.registrantId,
                roomId: room.roomId,
                personRoleName: Room_PersonRole_Enum.Participant,
            })),
        },
    });

    // Bwweerrr mutable state bwweerrr
    for (const entry of entries) {
        unallocatedQueueEntries.delete(entry.id);
        room.peopleRegistrantIds.push(entry.registrantId);
    }
}

async function allocateToNewRoom(
    periodId: string,
    capacity: number,
    name: string,
    conferenceId: string,
    subconferenceId: string | null,
    durationMinutes: number,
    reshuffleUponEnd: boolean,
    entries: UnallocatedShuffleQueueEntryFragment[],
    unallocatedQueueEntries: Map<number, UnallocatedShuffleQueueEntryFragment>
): Promise<ShuffleRoomAllocationInfo> {
    const managedRoom = await apolloClient.mutate({
        mutation: InsertManagedRoomDocument,
        variables: {
            capacity,
            name,
            conferenceId,
            subconferenceId,
        },
    });

    if (!managedRoom.data?.insert_room_Room_one) {
        throw new Error("Could not insert a new managed room for shuffle space! Room came back null.");
    }

    await apolloClient.mutate({
        mutation: SetAutoPinOnManagedRoomDocument,
        variables: {
            roomId: managedRoom.data.insert_room_Room_one.id,
        },
    });

    const startedAt = new Date().toISOString();
    const shuffleRoom = await apolloClient.mutate({
        mutation: InsertShuffleRoomDocument,
        variables: {
            durationMinutes,
            reshuffleUponEnd,
            roomId: managedRoom.data.insert_room_Room_one.id,
            shufflePeriodId: periodId,
            startedAt,
        },
    });

    if (!shuffleRoom.data?.insert_room_ShuffleRoom_one?.id) {
        throw new Error("Could not insert a new shuffle room! ShuffleRoom came back null.");
    }

    const newRoom: ShuffleRoomAllocationInfo = {
        durationMinutes,
        id: shuffleRoom.data.insert_room_ShuffleRoom_one.id,
        roomId: managedRoom.data.insert_room_Room_one.id,
        startedAt,
        peopleRegistrantIds: [],
    };

    await allocateToExistingRoom(entries, newRoom, unallocatedQueueEntries);

    return newRoom;
}

/**
 * First-come, first-serve algorithm with optional auto-creation of rooms
 */
async function attemptToMatchEntry_FCFS(
    logger: P.Logger,
    activePeriod: ActiveShufflePeriodFragment,
    entry: UnallocatedShuffleQueueEntryFragment,
    unallocatedQueueEntries: Map<number, UnallocatedShuffleQueueEntryFragment>,
    activeRooms: ShuffleRoomAllocationInfo[],
    allocateNewRooms: boolean
): Promise<boolean> {
    const now = Date.now();

    // 1. Attempt to find an existing room to allocate them to
    for (const room of activeRooms) {
        const duration = room.durationMinutes * 60 * 1000;
        const startedAt = Date.parse(room.startedAt);
        const endsAt = startedAt + duration;
        const timeRemaining = endsAt - now;
        if (timeRemaining > 0.5 * duration) {
            if (
                room.peopleRegistrantIds.length < activePeriod.targetRegistrantsPerRoom &&
                !room.peopleRegistrantIds.some((x) => x === entry.registrantId)
            ) {
                await allocateToExistingRoom([entry], room, unallocatedQueueEntries);
                return true;
            }
        }
    }

    // 2. Attempt to find other unallocated entries to match with
    if (allocateNewRooms) {
        // Take as many as possible to group them all together right away
        // (minus one to allow space for the entry we are processing!)
        //    * Sorted by id so oldest entries come first
        const entriesToAllocate = Array.from(unallocatedQueueEntries.values())
            .sort((x, y) => x.id - y.id)
            .filter((x) => x.id !== entry.id)
            .splice(0, activePeriod.targetRegistrantsPerRoom - 1);
        if (entriesToAllocate.length > 0) {
            const roomDuration = activePeriod.roomDurationMinutes * 60 * 1000;
            const periodEndsAt = Date.parse(activePeriod.endAt);
            const timeRemaining = periodEndsAt - (now + roomDuration);
            const reshuffleUponEnd = timeRemaining > 60 * 1000;
            const nowDate = new Date();
            const timeStr = `${nowDate.getUTCFullYear()}/${nowDate.getUTCMonth().toString().padStart(2, "0")}/${nowDate
                .getUTCDate()
                .toString()
                .padStart(2, "0")} ${nowDate.getUTCHours().toString().padStart(2, "0")}:${nowDate
                .getUTCMinutes()
                .toString()
                .padStart(2, "0")}`;

            let roomDurationMinutes = activePeriod.roomDurationMinutes;
            if (activePeriod.events.length > 0) {
                for (const event of activePeriod.events) {
                    const endTimeMs = Date.parse(event.scheduledEndTime);
                    const msToEnd = endTimeMs - now;
                    roomDurationMinutes = Math.min(roomDurationMinutes, Math.max(1, Math.floor(msToEnd / (60 * 1000))));
                }
            }
            activeRooms.push(
                await allocateToNewRoom(
                    activePeriod.id,
                    activePeriod.maxRegistrantsPerRoom + 1,
                    activePeriod.name + " room: " + timeStr,
                    activePeriod.conferenceId,
                    activePeriod.subconferenceId,
                    roomDurationMinutes,
                    reshuffleUponEnd,
                    [...entriesToAllocate, entry],
                    unallocatedQueueEntries
                )
            );
            return true;
        }
    }

    // 3. If waiting longer than max period, attempt to find overflow space
    const enteredAt = Date.parse(entry.created_at);
    const expiresAt = enteredAt + activePeriod.waitRoomMaxDurationSeconds * 1000;
    if (expiresAt < now) {
        for (const room of activeRooms) {
            const duration = room.durationMinutes * 60 * 1000;
            const startedAt = Date.parse(room.startedAt);
            const endsAt = startedAt + duration;
            const timeRemaining = endsAt - now;
            if (timeRemaining > 0.3 * duration) {
                if (
                    room.peopleRegistrantIds.length < activePeriod.maxRegistrantsPerRoom &&
                    !room.peopleRegistrantIds.some((x) => x === entry.registrantId)
                ) {
                    await allocateToExistingRoom([entry], room, unallocatedQueueEntries);
                    return true;
                }
            }
        }
    }

    // We failed to match :(
    logger.info(
        `[This is not an error]: Unable to match shuffle queue entry: ${entry.id} (Probably not enough people online!)`
    );
    return false;
}

/**
 * First-come, first-serve algorithm with optional auto-creation of rooms
 */
async function attemptToMatchEntries(
    logger: P.Logger,
    activePeriod: ActiveShufflePeriodFragment,
    entryIds: number[],
    activeRooms: ActiveShuffleRoomFragment[],
    allocateNewRooms: boolean
): Promise<void> {
    const unallocatedQueueEntries = new Map(activePeriod.unallocatedQueueEntries.map((x) => [x.id, x]));
    let rooms = activeRooms.map((room) => ({
        id: room.id,
        roomId: room.room.id,
        durationMinutes: room.durationMinutes,
        startedAt: room.startedAt,
        peopleRegistrantIds: room.room.people.map((x) => x.registrantId),
    }));
    for (const entryId of entryIds) {
        const entry = unallocatedQueueEntries.get(entryId);
        if (entry) {
            try {
                rooms = rooms.sort((x, y) => x.peopleRegistrantIds.length - y.peopleRegistrantIds.length);
                await attemptToMatchEntry_FCFS(
                    logger,
                    activePeriod,
                    entry,
                    unallocatedQueueEntries,
                    rooms,
                    allocateNewRooms
                );
            } catch (e: any) {
                logger.error({ entryId: entry.id, err: e }, "Error processing queue entry");
            }
        }
    }

    // Expire unallocated entries that have been waiting too long
    const now = Date.now();
    const expiredIds: string[] = [];
    unallocatedQueueEntries.forEach((entry) => {
        const enteredAt = Date.parse(entry.created_at);
        const expiresAt = enteredAt + activePeriod.waitRoomMaxDurationSeconds * 1000;
        if (expiresAt < now) {
            // Unmatched and past the time limit.
            expiredIds.push(entry.id);
        }
    });
    await apolloClient.mutate({
        mutation: ExpireShuffleQueueEntriesDocument,
        variables: {
            queueEntryIds: expiredIds,
        },
    });
}

async function processShufflePeriod(logger: P.Logger, period: ActiveShufflePeriodFragment, entryIds: number[]) {
    const now = Date.now();
    const activeRooms = period.activeRooms.filter((shuffleRoom) => {
        const startedAt = Date.parse(shuffleRoom.startedAt);
        const duration = shuffleRoom.durationMinutes * 60 * 1000;
        return startedAt + duration >= now - 5000;
    });
    switch (period.algorithm) {
        case Room_ShuffleAlgorithm_Enum.Fcfs:
            await attemptToMatchEntries(logger, period, entryIds, activeRooms, true);
            break;
        case Room_ShuffleAlgorithm_Enum.FcfsFixedRooms:
            await attemptToMatchEntries(logger, period, entryIds, activeRooms, false);
            break;
        case Room_ShuffleAlgorithm_Enum.None:
            // Do nothing
            break;
        default:
            logger.warn({ period }, "Unable to process shuffle period: Unrecognised algorithm");
            break;
    }
}

export async function handleShuffleQueueEntered(
    logger: P.Logger,
    payload: EventPayload<ShuffleQueueEntryData>
): Promise<void> {
    if (!payload.event.data.new) {
        throw new Error("Shuffled queue entered: 'new' data is null?!");
    }
    const entry = payload.event.data.new;

    const result = await apolloClient.query({
        query: SelectShufflePeriodDocument,
        variables: {
            id: entry.shufflePeriodId,
            now: new Date().toISOString(),
        },
    });
    if (!result.data.room_ShufflePeriod_by_pk) {
        throw new Error(
            `Shuffle period of the queue entry not found! Entry: ${entry.id}, Period: ${entry.shufflePeriodId}, Registrant: ${entry.registrantId}`
        );
    }
    const startAt = Date.parse(result.data.room_ShufflePeriod_by_pk.startAt);
    if (startAt < Date.now()) {
        await processShufflePeriod(logger, result.data.room_ShufflePeriod_by_pk, [entry.id]);
    }
}

async function endRooms(logger: P.Logger, period: ActiveShufflePeriodFragment): Promise<void> {
    try {
        const now = Date.now();
        const endedRooms = period.activeRooms.filter((shuffleRoom) => {
            const startedAt = Date.parse(shuffleRoom.startedAt);
            const duration = shuffleRoom.durationMinutes * 60 * 1000;
            return startedAt + duration < now - 5000;
        });
        await Promise.all(
            endedRooms.map(async (shuffleRoom) => {
                logger.info({ shuffleRoomId: shuffleRoom.id }, "Ending shuffle room");
                if (shuffleRoom.room.publicVonageSessionId) {
                    await kickAllRegistrantsFromVonageRoom(
                        logger,
                        shuffleRoom.room.id,
                        shuffleRoom.room.publicVonageSessionId
                    );
                }
            })
        );

        await apolloClient.mutate({
            mutation: SetShuffleRoomsEndedDocument,
            variables: {
                ids: endedRooms.map((x) => x.id),
            },
        });
    } catch (e: any) {
        logger.error({ periodId: period.id, err: e }, "Failed to terminate shuffle rooms");
    }
}

export async function processShuffleQueues(logger: P.Logger): Promise<void> {
    const now = Date.now();

    logger.info("Shuffle rooms: Fetching");

    const result = await apolloClient.query({
        query: SelectActiveShufflePeriodsDocument,
        variables: {
            from: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
            until: new Date(now + 60 * 1000).toISOString(),
            now: new Date().toISOString(),
        },
    });

    logger.info("Shuffle rooms: Matching entries and ending rooms");
    await Promise.all([
        ...result.data.room_ShufflePeriod.map(async (period) => {
            await endRooms(logger, period);
            if (Date.parse(period.startAt) <= now && Date.parse(period.endAt) >= now + 30000) {
                await processShufflePeriod(
                    logger,
                    period,
                    period.unallocatedQueueEntries.map((x) => x.id)
                );
            }
        }),
    ]);

    logger.info("Shuffle rooms: Done.");
}
