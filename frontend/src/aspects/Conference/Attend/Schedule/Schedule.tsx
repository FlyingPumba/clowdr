import { gql } from "@apollo/client";
import { Box, Flex, Heading, useColorModeValue } from "@chakra-ui/react";
import assert from "assert";
import * as R from "ramda";
import React, { useCallback, useMemo } from "react";
import ScrollContainer from "react-indiana-drag-scroll";
import {
    Permission_Enum,
    Schedule_ContentGroupSummaryFragment,
    Schedule_EventSummaryFragment,
    Schedule_RoomSummaryFragment,
    Schedule_SelectSummariesQuery,
    useSchedule_SelectSummariesQuery,
} from "../../../../generated/graphql";
import ApolloQueryWrapper from "../../../GQL/ApolloQueryWrapper";
import { useTitle } from "../../../Utils/useTitle";
import RequireAtLeastOnePermissionWrapper from "../../RequireAtLeastOnePermissionWrapper";
import { useConference } from "../../useConference";
import DayList from "./DayList";
import NowMarker from "./NowMarker";
import RoomNameBox from "./RoomNameBox";
import RoomTimeline from "./RoomTimeline";
import { ScalingProvider, useScalingParams } from "./Scaling";
import TimeBar from "./TimeBar";
import useTimelineParameters, { TimelineParameters } from "./useTimelineParameters";

gql`
    fragment Schedule_ContentItem on ContentItem {
        id
        contentTypeName
        name
        layoutData
        data
    }

    fragment Schedule_ContentPerson on ContentPerson {
        id
        name
        affiliation
        attendeeId
    }

    fragment Schedule_ContentGroupPerson on ContentGroupPerson {
        id
        priority
        roleName
        person {
            ...Schedule_ContentPerson
        }
    }

    fragment Schedule_ContentGroupSummary on ContentGroup {
        id
        title
        shortTitle
        contentGroupTypeName
    }

    fragment Schedule_ContentGroup on ContentGroup {
        ...Schedule_ContentGroupSummary
        abstractContentItems: contentItems(where: { contentTypeName: { _eq: ABSTRACT }, isHidden: { _eq: false } }) {
            ...Schedule_ContentItem
        }
        people {
            ...Schedule_ContentGroupPerson
        }
    }

    query Schedule_SelectContentGroup($id: uuid!) {
        ContentGroup_by_pk(id: $id) {
            ...Schedule_ContentGroup
        }
    }

    fragment Schedule_EventSummary on Event {
        id
        roomId
        intendedRoomModeName
        name
        startTime
        durationSeconds
        contentGroupId
    }

    fragment Schedule_RoomSummary on Room {
        id
        name
        currentModeName
        priority
        roomPrivacyName
    }

    query Schedule_SelectSummaries($conferenceId: uuid!) {
        Room(where: { conferenceId: { _eq: $conferenceId }, roomPrivacyName: { _in: [PUBLIC, PRIVATE] }, events: {} }) {
            ...Schedule_RoomSummary
        }
        Event(where: { conferenceId: { _eq: $conferenceId } }) {
            ...Schedule_EventSummary
        }
        ContentGroup(where: { conferenceId: { _eq: $conferenceId } }) {
            ...Schedule_ContentGroupSummary
        }
    }
`;

type GroupableByTime<T> = T & {
    startTimeMs: number;
    endTimeMs: number;
    durationMs: number;
};

type Schedule_EventSummaryExt = GroupableByTime<Schedule_EventSummaryFragment>;

type Session = GroupableByTime<{
    room: Schedule_RoomSummaryFragment;
    events: Schedule_EventSummaryExt[];
}>;

type ColumnAssignedSession = { session: Session; column: number };

type Frame = GroupableByTime<{
    items: ColumnAssignedSession[];
}>;

function recombineSessions(
    frames: GroupableByTime<{
        items: Session[];
    }>[]
): Frame[] {
    return frames.map<Frame>((frame) => {
        const groups = R.groupBy((x) => x.room.id, frame.items);
        const roomIds = R.keys(groups);
        return {
            startTimeMs: frame.startTimeMs,
            endTimeMs: frame.endTimeMs,
            durationMs: frame.durationMs,
            items: roomIds.reduce((sessionsAcc, roomId) => {
                const group = groups[roomId];
                const { startTimeMs, endTimeMs } = group.reduce(
                    (acc, session) => ({
                        startTimeMs: Math.min(acc.startTimeMs, session.startTimeMs),
                        endTimeMs: Math.max(acc.endTimeMs, session.endTimeMs),
                    }),
                    { startTimeMs: Number.POSITIVE_INFINITY, endTimeMs: Number.NEGATIVE_INFINITY }
                );

                const session: ColumnAssignedSession = {
                    column: -1,
                    session: {
                        startTimeMs,
                        endTimeMs,
                        durationMs: endTimeMs - startTimeMs,
                        room: group[0].room,
                        events: R.sortBy(
                            (x) => x.startTimeMs,
                            group.reduce<Schedule_EventSummaryExt[]>((acc, session) => [...acc, ...session.events], [])
                        ),
                    },
                };

                return [...sessionsAcc, session];
            }, []),
        };
    });
}

/**
 * Groups events into sessions, sessions into frames.
 */
function groupByTime<S, T extends GroupableByTime<S>>(
    items: T[],
    lookaheadMs: number
): GroupableByTime<{ items: T[] }>[] {
    // Sort by earliest first
    items = R.sortBy((x) => x.startTimeMs, items);

    const result: GroupableByTime<{ items: GroupableByTime<T>[] }>[] = [];

    let session: GroupableByTime<T>[] = [];
    let sessionEndTime: number = Number.NEGATIVE_INFINITY;
    for (let idx = 0; idx < items.length; idx++) {
        const event = items[idx];
        // Found a sufficiently wide gap between items?
        if (event.startTimeMs >= sessionEndTime + lookaheadMs) {
            // Save previous session
            if (session.length > 0) {
                const startTimeMs = session[0].startTimeMs;
                const endTimeMs = session.reduce(
                    (acc, session) => Math.max(acc, session.endTimeMs),
                    Number.NEGATIVE_INFINITY
                );
                result.push({
                    items: session,
                    startTimeMs,
                    endTimeMs,
                    durationMs: endTimeMs - startTimeMs,
                });
            }

            // New session
            session = [event];
            sessionEndTime = event.endTimeMs;
        } else {
            // Add to current session
            session.push(event);
            sessionEndTime = Math.max(sessionEndTime, event.endTimeMs);
        }
    }
    // Save last session
    if (session.length > 0) {
        const startTimeMs = session[0].startTimeMs;
        const endTimeMs = session[session.length - 1].endTimeMs;
        result.push({
            items: session,
            startTimeMs,
            endTimeMs,
            durationMs: endTimeMs - startTimeMs,
        });
    }

    return result;
}

/**
 * Sorts the rooms of each frame into columns, attempting to keep stable
 * assignments between frames
 */
function assignColumns(frames: Frame[]): Frame[] {
    if (frames.length > 0) {
        const frame0 = frames[0];
        frame0.items = R.sortBy((x) => x.session.room.priority, frame0.items);
        for (let idx = 0; idx < frame0.items.length; idx++) {
            frame0.items[idx].column = idx;
        }

        const maxParallelRooms = frames.reduce((acc, frame) => Math.max(acc, frame.items.length), 0);

        for (let frameIdx = 1; frameIdx < frames.length; frameIdx++) {
            const previousFrame = frames[frameIdx - 1];
            const currentFrame = frames[frameIdx];
            // Assign same columns as previous frame
            for (const item of currentFrame.items) {
                item.column =
                    previousFrame.items.find((itemY) => itemY.session.room.id === item.session.room.id)?.column ?? -1;
            }
            const usedColumns = new Set(currentFrame.items.map((x) => x.column));
            const availableColumns = Array.from({ length: maxParallelRooms }, (_x, i) => i).filter(
                (y) => !usedColumns.has(y)
            );
            // Assign remaining columns in priority order
            const currentFrameUnassignedItems = R.sortBy(
                (x) => x.session.room.priority,
                currentFrame.items.filter((x) => x.column === -1)
            );
            assert(currentFrameUnassignedItems.length <= availableColumns.length, "Hmm, something weird happened!");
            let nextColIdx = 0;
            for (const item of currentFrameUnassignedItems) {
                item.column = availableColumns[nextColIdx++];
            }
            currentFrame.items = R.sortBy((x) => x.column, currentFrame.items);
        }
    }
    return frames;
}

function ScheduleFrame({
    frame,
    alternateBgColor,
    borderColour,
    roomColWidth,
    timeBarWidth,
    scrollToEventCbs,
    scrollToNow,
    contentGroups,
}: {
    frame: Frame;
    alternateBgColor: string;
    borderColour: string;
    maxParallelRooms: number;
    contentGroups: ReadonlyArray<Schedule_ContentGroupSummaryFragment>;
    roomColWidth: number;
    timeBarWidth: number;
    scrollToEventCbs: Map<string, () => void>;
    scrollToNow: { f: () => void };
}): JSX.Element {
    const roomNameBoxes = useMemo(
        () =>
            frame.items.reduce((acc, item, idx) => {
                const room = item.session.room;

                return [
                    ...acc,
                    <RoomNameBox
                        key={room.id}
                        room={room}
                        width={roomColWidth}
                        showBottomBorder={true}
                        borderColour={borderColour}
                        backgroundColor={idx % 2 === 0 ? alternateBgColor : undefined}
                    />,
                ];
            }, [] as (JSX.Element | undefined)[]),
        [alternateBgColor, borderColour, frame.items, roomColWidth]
    );

    const { visibleTimeSpanSeconds } = useScalingParams();
    const { fullTimeSpanSeconds } = useTimelineParameters();

    const innerHeightPx = ((window.innerHeight - 200) * fullTimeSpanSeconds) / visibleTimeSpanSeconds;

    // const roomMarkers = useGenerateMarkers("100%", "", true, false, false);

    const labeledNowMarker = useMemo(() => <NowMarker showLabel scrollToNow={scrollToNow} />, [scrollToNow]);

    const roomTimelines = useMemo(
        () =>
            frame.items.map((item, idx) => {
                const room = item.session.room;

                return (
                    <Box
                        key={room.id}
                        h="100%"
                        w={roomColWidth + "px"}
                        borderBottomWidth={idx !== frame.items.length - 1 ? 1 : 0}
                        borderBottomStyle="solid"
                        borderBottomColor={borderColour}
                    >
                        <RoomTimeline
                            room={room}
                            hideTimeShiftButtons={true}
                            hideTimeZoomButtons={true}
                            width={roomColWidth}
                            scrollToEventCbs={scrollToEventCbs}
                            events={item.session.events}
                            contentGroups={contentGroups}
                        />
                    </Box>
                );
            }, [] as (JSX.Element | undefined)[]),
        [borderColour, contentGroups, frame.items, roomColWidth, scrollToEventCbs]
    );

    return (
        <Box w="100%" borderBottomStyle="solid" borderBottomWidth="3px" borderBottomColor={borderColour}>
            <Box
                flex="1 0 max-content"
                role="list"
                aria-label="Rooms"
                display="flex"
                justifyContent="stretch"
                alignItems="stretch"
            >
                <RoomNameBox room="" width={timeBarWidth} showBottomBorder={true} borderColour={borderColour} />
                {roomNameBoxes}
            </Box>
            <Flex h={innerHeightPx + "px"} w="100%" role="region" aria-label="Room schedules" pos="relative">
                <TimeBar width={timeBarWidth} borderColour={borderColour} />
                {/* {roomMarkers} */}
                <NowMarker />
                {labeledNowMarker}
                {roomTimelines}
            </Flex>
        </Box>
    );
}

function ScheduleInner({
    rooms,
    events: rawEvents,
    contentGroups,
}: {
    rooms: ReadonlyArray<Schedule_RoomSummaryFragment>;
    events: ReadonlyArray<Schedule_EventSummaryFragment>;
    contentGroups: ReadonlyArray<Schedule_ContentGroupSummaryFragment>;
}): JSX.Element {
    const eventsByRoom = useMemo(
        () =>
            R.groupBy<Schedule_EventSummaryExt>(
                (x) => x.roomId,
                // TODO: Merge neighbouring events of same content group id
                R.map((event) => {
                    const startTimeMs = Date.parse(event.startTime);
                    const durationMs = event.durationSeconds * 1000;
                    return {
                        ...event,
                        startTimeMs,
                        durationMs,
                        endTimeMs: startTimeMs + durationMs,
                    };
                }, rawEvents)
            ),
        [rawEvents]
    );

    const frames = useMemo(() => {
        const sessions: Session[] = [];
        for (const roomId in eventsByRoom) {
            const room = rooms.find((x) => x.id === roomId);
            if (room) {
                const groupedEvents = groupByTime<Schedule_EventSummaryFragment, Schedule_EventSummaryExt>(
                    eventsByRoom[roomId],
                    5 * 60 * 1000
                );
                sessions.push(
                    ...groupedEvents.map((group) => ({
                        room,
                        events: group.items,
                        startTimeMs: group.startTimeMs,
                        endTimeMs: group.endTimeMs,
                        durationMs: group.durationMs,
                    }))
                );
            } else {
                console.warn(
                    `Schedule may be rendered with some events missing as data for room ${roomId} was not found.`
                );
            }
        }
        const result = assignColumns(recombineSessions(groupByTime(sessions, 0)));
        console.log("Schedule frames", result);
        return result;
    }, [eventsByRoom, rooms]);

    const alternateBgColor = useColorModeValue("blue.100", "blue.700");
    const borderColour = useColorModeValue("gray.400", "gray.400");

    const scrollToEventCbs = useMemo(() => new Map(), []);

    const scrollToNow: { f: () => void } = useMemo(
        () => ({
            f: () => {
                /*EMPTY*/
            },
        }),
        []
    );

    const maxParallelRooms = useMemo(() => frames.reduce((acc, frame) => Math.max(acc, frame.items.length), 0), [
        frames,
    ]);
    const timeBarWidth = 50;
    const roomColWidth = Math.min(
        500,
        Math.max(
            150,
            (window.innerWidth >= 1280 ? window.innerWidth * 0.6 : window.innerWidth) / maxParallelRooms -
                timeBarWidth -
                70
        )
    );

    const frameEls = useMemo(() => {
        return frames.map((frame) => {
            const avgEventDurationI = frame.items.reduce(
                (acc, item) => {
                    const { sum, count } = item.session.events.reduce(
                        (acc, event) => ({
                            sum: acc.sum + event.durationMs,
                            count: acc.count + 1,
                        }),
                        { sum: 0, count: 0 }
                    );
                    return { sum: acc.sum + sum, count: acc.count + count };
                },
                { sum: 0, count: 0 }
            );
            const avgEventsPerRoomI = frame.items.reduce(
                (acc, item) => ({
                    sum: acc.sum + item.session.events.length,
                    count: acc.count + 1,
                }),
                { sum: 0, count: 0 }
            );
            const avgEventDuration = avgEventDurationI.count > 0 ? avgEventDurationI.sum / avgEventDurationI.count : 1;
            const avgEventsPerRoom = avgEventsPerRoomI.count > 0 ? avgEventsPerRoomI.sum / avgEventsPerRoomI.count : 1;
            return (
                <TimelineParameters
                    earliestEventStart={frame.startTimeMs}
                    latestEventEnd={frame.endTimeMs}
                    key={`frame-${frame.startTimeMs}`}
                >
                    <ScalingProvider avgEventDuration={avgEventDuration} avgEventsPerRoom={avgEventsPerRoom}>
                        <ScheduleFrame
                            frame={frame}
                            alternateBgColor={alternateBgColor}
                            borderColour={borderColour}
                            maxParallelRooms={maxParallelRooms}
                            scrollToEventCbs={scrollToEventCbs}
                            scrollToNow={scrollToNow}
                            contentGroups={contentGroups}
                            roomColWidth={roomColWidth}
                            timeBarWidth={timeBarWidth}
                        />
                    </ScalingProvider>
                </TimelineParameters>
            );
        });
    }, [
        alternateBgColor,
        borderColour,
        contentGroups,
        frames,
        maxParallelRooms,
        roomColWidth,
        scrollToEventCbs,
        scrollToNow,
    ]);

    const conference = useConference();
    const title = useTitle(`Schedule of ${conference.shortName}`);

    const scrollToEvent = useCallback(
        (ev: Schedule_EventSummaryFragment) => {
            const cb = scrollToEventCbs.get(ev.id);
            cb?.(ev);
        },
        [scrollToEventCbs]
    );

    return (
        <>
            {title}
            {/*Plus 30 to the width to account for scrollbars!*/}
            <Flex h="100%" w="100%" maxW={timeBarWidth + maxParallelRooms * roomColWidth + 30} flexDir="column">
                <Flex w="100%" direction="row" justify="center" alignItems="center">
                    <Heading as="h1" mr={4}>
                        Schedule
                    </Heading>
                    <DayList
                        rooms={rooms}
                        events={rawEvents}
                        scrollToEvent={scrollToEvent}
                        scrollToNow={scrollToNow.f}
                    />
                </Flex>
                <Box
                    cursor="pointer"
                    as={ScrollContainer}
                    w="100%"
                    borderColor={borderColour}
                    borderWidth={1}
                    borderStyle="solid"
                    hideScrollbars={false}
                >
                    <Flex
                        direction="column"
                        w={timeBarWidth + maxParallelRooms * roomColWidth}
                        justifyContent="stretch"
                        alignItems="flex-start"
                        role="region"
                        aria-label="Conference schedule"
                    >
                        {frameEls}
                    </Flex>
                </Box>
            </Flex>
        </>
    );
}

function ScheduleFetchWrapper(): JSX.Element {
    const conference = useConference();
    const roomsResult = useSchedule_SelectSummariesQuery({
        variables: {
            conferenceId: conference.id,
        },
    });
    return (
        <ApolloQueryWrapper<
            Schedule_SelectSummariesQuery,
            unknown,
            {
                rooms: ReadonlyArray<Schedule_RoomSummaryFragment>;
                events: ReadonlyArray<Schedule_EventSummaryFragment>;
                contentGroups: ReadonlyArray<Schedule_ContentGroupSummaryFragment>;
            }
        >
            queryResult={roomsResult}
            getter={(x) => ({ rooms: x.Room, events: x.Event, contentGroups: x.ContentGroup })}
        >
            {(data) => <ScheduleInner {...data} />}
        </ApolloQueryWrapper>
    );
}

export default function Schedule(): JSX.Element {
    return (
        <RequireAtLeastOnePermissionWrapper
            permissions={[Permission_Enum.ConferenceView, Permission_Enum.ConferenceManageSchedule]}
        >
            <ScheduleFetchWrapper />
        </RequireAtLeastOnePermissionWrapper>
    );
}
