import { useToast } from "@chakra-ui/react";
import type { ContinuationDefaultFor, ExtendedContinuationTo } from "@midspace/shared-types/continuation";
import { ContinuationType, NavigationView } from "@midspace/shared-types/continuation";
import { gql } from "@urql/core";
import * as R from "ramda";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import type { ContinuationChoices_ContinuationFragment } from "../../../../generated/graphql";
import {
    useContinuationChoices_ContinuationsQuery,
    useContinuationChoices_RoomsQuery,
} from "../../../../generated/graphql";
import { useAuthParameters } from "../../../GQL/AuthParameters";
import { useRealTime } from "../../../Hooks/useRealTime";
import ContinuationActiveChoice from "./ContinuationActiveChoice";
import ContinuationPassiveChoice from "./ContinuationPassiveChoice";

gql`
    fragment ContinuationChoices_Continuation on schedule_Continuation {
        id
        to
        defaultFor
        isActiveChoice
        priority
        colour
        description
        fromEvent
        fromShuffleQueue
    }

    query ContinuationChoices_Continuations($fromId: uuid!, $nowStart: timestamptz, $nowEnd: timestamptz) {
        schedule_Continuation(
            where: { _or: [{ fromEvent: { _eq: $fromId } }, { fromShuffleQueue: { _eq: $fromId } }] }
        ) {
            ...ContinuationChoices_Continuation
        }
        room_ShufflePeriod(where: { id: { _eq: $fromId } }) {
            id
            endAt
            roomDurationMinutes
        }
        schedule_Event(
            where: {
                _or: [
                    { id: { _eq: $fromId } }
                    {
                        scheduledStartTime: { _lte: $nowStart }
                        scheduledEndTime: { _gte: $nowEnd }
                        sessionEventId: { _is_null: true }
                        shufflePeriodId: { _eq: $fromId }
                    }
                ]
            }
        ) {
            id
            roomId
            shufflePeriodId
            scheduledStartTime
            scheduledEndTime
        }
    }

    query ContinuationChoices_Rooms($ids: [uuid!]!) @cached {
        content_Item(where: { id: { _in: $ids } }) {
            id
            room {
                id
                created_at
            }
        }
        schedule_Event(where: { id: { _in: $ids } }) {
            id
            roomId
        }
    }
`;

export default function ContinuationChoices({
    from,
    isBackstage,
    noBackstage,
    currentRole,
    currentRoomId,
    extraChoices,
}: {
    from: { eventId: string; itemId: string | null } | { shufflePeriodId: string; shuffleRoomEndsAt: number };
    isBackstage: boolean;
    noBackstage: boolean;
    currentRole: ContinuationDefaultFor;
    currentRoomId: string;
    extraChoices: readonly ContinuationChoices_ContinuationFragment[];
}): JSX.Element {
    // We do not want this to change on every render...
    const nowStatic_StartStr = useMemo(() => new Date(Date.now() + 60000).toISOString(), []);
    const nowStatic_EndStr = useMemo(() => new Date(Date.now() - 60000).toISOString(), []);
    // ...else this query would change on every render!
    const [response] = useContinuationChoices_ContinuationsQuery({
        variables: {
            fromId: "eventId" in from ? from.eventId : from.shufflePeriodId,
            nowStart: nowStatic_StartStr,
            nowEnd: nowStatic_EndStr,
        },
    });

    // Delay rendering choices (and thus fetching of events/items/rooms) to
    // allow time for automatic discussion rooms to be generated
    const renderedAt = useMemo(() => Date.now(), []);
    const now = useRealTime(10000);

    const allChoices = useMemo(
        () =>
            response.data?.schedule_Continuation
                ? [...extraChoices, ...response.data.schedule_Continuation]
                : extraChoices,
        [response.data?.schedule_Continuation, extraChoices]
    );

    const fromInternal = useMemo(
        () =>
            response.data && (allChoices.length > 0 || "shufflePeriodId" in from)
                ? "eventId" in from
                    ? {
                          eventId: from.eventId,
                          itemId: from.itemId,
                          scheduledEndTime:
                              response.data.schedule_Event.length > 0
                                  ? Date.parse(response.data.schedule_Event[0].scheduledEndTime)
                                  : 0,
                      }
                    : {
                          shufflePeriodId: from.shufflePeriodId,
                          periodEndTime:
                              response.data.room_ShufflePeriod.length > 0
                                  ? Date.parse(response.data.room_ShufflePeriod[0].endAt)
                                  : 0,
                          roomEndTime: from.shuffleRoomEndsAt,
                          roomDuration:
                              response.data.room_ShufflePeriod.length > 0
                                  ? response.data.room_ShufflePeriod[0].roomDurationMinutes * 60 * 1000
                                  : 0,
                          eventRoomId: response.data.schedule_Event[0]?.roomId,
                      }
                : undefined,
        [allChoices.length, from, response.data]
    );

    return fromInternal && now - renderedAt > 15000 ? (
        <ContinuationChoices_Inner
            from={fromInternal}
            choices={allChoices}
            isBackstage={isBackstage}
            noBackstage={noBackstage}
            currentRole={currentRole}
            currentRoomId={currentRoomId}
        />
    ) : (
        <></>
    );
}

const passiveChoice_RevealThreshholdMs = 2 * 60 * 1000;
const passiveChoice_HideThreshholdMs = 1 * 60 * 1000;
const activeChoice_RevealThreshholdMs = 20 * 1000;
const activeChoice_HideThreshholdMs = 1 * 60 * 1000;

function ContinuationChoices_Inner({
    from,
    choices,
    isBackstage,
    noBackstage,
    currentRole,
    currentRoomId,
}: {
    from:
        | { eventId: string; itemId: string | null; scheduledEndTime: number }
        | {
              shufflePeriodId: string;
              periodEndTime: number;
              roomEndTime: number;
              roomDuration: number;
              eventRoomId?: string;
          };
    choices: readonly ContinuationChoices_ContinuationFragment[];
    isBackstage: boolean;
    noBackstage: boolean;
    currentRole: ContinuationDefaultFor;
    currentRoomId: string;
}): JSX.Element {
    const { conferencePath } = useAuthParameters();
    const [roomsResponse] = useContinuationChoices_RoomsQuery({
        variables: {
            ids: choices.reduce((acc, option) => {
                const to: ExtendedContinuationTo = option.to;
                if (to.type === ContinuationType.AutoDiscussionRoom) {
                    const itemId = to.id ?? ("eventId" in from ? from.itemId : null);
                    if (itemId) {
                        acc.push(itemId);
                    }
                } else if (to.type === ContinuationType.Event) {
                    acc.push(to.id);
                }
                return acc;
            }, [] as string[]),
        },
    });

    const isActiveChoice = useMemo(() => R.any((x) => x.isActiveChoice, choices), [choices]);

    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

    const now = useRealTime(1000);
    const initialTimeRemaining = useMemo(() => {
        let scheduledEndTime: number;
        if ("eventId" in from) {
            scheduledEndTime = from.scheduledEndTime;
        } else {
            if (from.roomEndTime < from.periodEndTime - from.roomDuration) {
                // Time for another room, never display the choice
                scheduledEndTime = from.roomEndTime;
            } else {
                // No time for another room, display choice when this room ends
                scheduledEndTime = from.roomEndTime;
            }
        }
        return scheduledEndTime - Date.now();
    }, [from]);
    const { displayChoice, timeRemaining } = useMemo(() => {
        let scheduledEndTime: number;
        if ("eventId" in from) {
            scheduledEndTime = from.scheduledEndTime;
        } else {
            if (from.roomEndTime < from.periodEndTime - from.roomDuration) {
                // Time for another room, never display the choice
                return { displayChoice: false, timeRemaining: from.roomEndTime - now };
            } else {
                // No time for another room, display choice when this room ends
                scheduledEndTime = from.roomEndTime;
            }
        }
        return {
            displayChoice:
                choices.length > 0 &&
                ((!isActiveChoice &&
                    (now < scheduledEndTime || selectedOptionId === null) &&
                    now > scheduledEndTime - passiveChoice_RevealThreshholdMs &&
                    now < scheduledEndTime + passiveChoice_HideThreshholdMs) ||
                    (isActiveChoice &&
                        now > scheduledEndTime - activeChoice_RevealThreshholdMs &&
                        now < scheduledEndTime + activeChoice_HideThreshholdMs)),
            timeRemaining: scheduledEndTime - now,
        };
    }, [from, isActiveChoice, now, selectedOptionId, choices.length]);

    const [activateChoice, setActivateChoice] = useState<boolean>(false);
    const [activatedChoice, setActivatedChoice] = useState<boolean | string>(false);
    useEffect(() => {
        if (initialTimeRemaining > 0 && timeRemaining < 0) {
            console.log("Time remaining < 0, Setting activate choice", { timeRemaining, initialTimeRemaining });
            setActivateChoice(true);
        }
    }, [initialTimeRemaining, timeRemaining]);
    const activate = useCallback(() => {
        console.log("Activate called, Setting activate choice and clearing activated choice");
        setActivateChoice(true);
        setActivatedChoice(false);
    }, []);

    const toast = useToast();
    const history = useHistory();

    useEffect(() => {
        if (activateChoice && !activatedChoice) {
            const activateChosenOption = () => {
                if (selectedOptionId !== null) {
                    const selectedOption = choices.find((x) => x.id === selectedOptionId);
                    let error: string | null = null;

                    if (selectedOption) {
                        const to: ExtendedContinuationTo = selectedOption.to;
                        switch (to.type) {
                            case "function":
                                console.log("Activate function", {
                                    choices,
                                    selectedOptionId,
                                    activateChoice,
                                    activatedChoice,
                                });
                                to.f();
                                break;
                            case ContinuationType.URL:
                                window.location.assign(to.url);
                                break;
                            case ContinuationType.Room:
                                if (currentRoomId !== to.id) {
                                    console.log("Activate room", {
                                        choices,
                                        selectedOptionId,
                                        activateChoice,
                                        activatedChoice,
                                    });
                                    history.push(`${conferencePath}/room/${to.id}`);
                                }
                                break;
                            case ContinuationType.Event:
                                if (!roomsResponse.fetching) {
                                    const event = roomsResponse.data?.schedule_Event.find(
                                        (event) => event.id === to.id
                                    );
                                    if (event && event?.roomId) {
                                        if (currentRoomId !== event.roomId) {
                                            history.push(`${conferencePath}/room/${event.roomId}`);
                                        }
                                    } else {
                                        if (roomsResponse.error) {
                                            error = roomsResponse.error.message;
                                        } else {
                                            error = "Sorry, the room for the chosen event could not be found.";
                                        }
                                    }
                                }
                                break;
                            case ContinuationType.AutoDiscussionRoom:
                                if (!roomsResponse.fetching) {
                                    console.log("Activate auto room", {
                                        choices,
                                        selectedOptionId,
                                        activateChoice,
                                        activatedChoice,
                                    });
                                    const toItemId = to.id ?? ("eventId" in from ? from.itemId : null);
                                    const item = roomsResponse.data?.content_Item.find((item) => item.id === toItemId);
                                    if (item && item.room) {
                                        if (currentRoomId !== item.room.id) {
                                            history.push(`${conferencePath}/room/${item.room.id}`);
                                        }
                                    } else {
                                        if (roomsResponse.error) {
                                            error = roomsResponse.error.message;
                                        } else {
                                            error = "Sorry, the chosen discussion room could not be found.";
                                        }
                                    }
                                }
                                break;
                            case ContinuationType.Item:
                                history.push(`${conferencePath}/item/${to.id}`);
                                break;
                            case ContinuationType.Exhibition:
                                history.push(`${conferencePath}/exhibition/${to.id}`);
                                break;
                            case ContinuationType.ShufflePeriod:
                                history.push(`${conferencePath}/shuffle`);
                                break;
                            case ContinuationType.Profile:
                                history.push(`${conferencePath}/profile/view/${to.id}`);
                                break;
                            case ContinuationType.OwnProfile:
                                history.push(`${conferencePath}/profile`);
                                break;
                            case ContinuationType.NavigationView:
                                switch (to.view) {
                                    case NavigationView.LiveProgramRooms:
                                        history.push(`${conferencePath}/live`);
                                        break;
                                    case NavigationView.HappeningSoon:
                                        history.push(`${conferencePath}/schedule`);
                                        break;
                                    case NavigationView.Tags:
                                        history.push(
                                            `${conferencePath}/content${to.tagId?.length ? "/" + to.tagId : ""}`
                                        );
                                        break;
                                    case NavigationView.Exhibitions:
                                        history.push(`${conferencePath}/exhibitions`);
                                        break;
                                    case NavigationView.Schedule:
                                        history.push(`${conferencePath}/schedule`);
                                        break;
                                    case NavigationView.SocialRooms:
                                        history.push(`${conferencePath}/socialise`);
                                        break;
                                    case NavigationView.People:
                                        history.push(`${conferencePath}/socialise`);
                                        break;
                                    case NavigationView.ShufflePeriods:
                                        history.push(`${conferencePath}/shuffle`);
                                        break;
                                    case NavigationView.MyBackstages:
                                        // Deprecated
                                        history.push(`${conferencePath}/profile/backstages`);
                                        break;
                                }
                                break;
                            case ContinuationType.ConferenceLandingPage:
                                if (conferencePath) {
                                    history.push(conferencePath);
                                }
                                break;
                        }
                    } else {
                        error = "Sorry, the selected option is no longer available.";
                    }

                    setActivatedChoice(error ?? true);
                }
            };

            if ("shufflePeriodId" in from) {
                if (from.eventRoomId) {
                    history.push(`${conferencePath}/room/${from.eventRoomId}`);
                } else {
                    history.push(`${conferencePath}/shuffle`);
                }
                setTimeout(() => activateChosenOption(), 200);
            } else {
                activateChosenOption();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedOptionId, activatedChoice, activateChoice]);

    useEffect(() => {
        if (typeof activatedChoice === "string") {
            toast({
                description: activatedChoice,
                duration: 80000,
                position: "bottom",
                isClosable: true,
                title: "Error activating continuation",
                status: "error",
            });
        }
    }, [activatedChoice, toast]);

    const activeSet = useCallback((choiceId: string | null, isDefault: boolean) => {
        setSelectedOptionId(choiceId);
        if (!isDefault) {
            console.log("Active set called, Setting activate choice and clearing activated choice");
            setActivatedChoice(false);
            setActivateChoice(true);
        }
    }, []);
    const passiveSet = useCallback((choiceId: string | null, _isDefault: boolean) => {
        console.log("Passive set called, Setting selected option id clearing activated choice");
        setSelectedOptionId(choiceId);
        setActivatedChoice(false);
    }, []);

    return displayChoice ? (
        isActiveChoice ? (
            <ContinuationActiveChoice
                selectedOptionId={selectedOptionId}
                choices={choices}
                isBackstage={isBackstage}
                noBackstage={noBackstage}
                currentRole={currentRole}
                timeRemaining={timeRemaining + activeChoice_HideThreshholdMs}
                timeMax={activeChoice_RevealThreshholdMs + activeChoice_HideThreshholdMs}
                onChoiceSelected={activeSet}
            />
        ) : (
            <ContinuationPassiveChoice
                selectedOptionId={selectedOptionId}
                choices={choices}
                isBackstage={isBackstage}
                noBackstage={noBackstage}
                currentRole={currentRole}
                timeRemaining={timeRemaining}
                timeMax={passiveChoice_RevealThreshholdMs}
                onChoiceSelected={passiveSet}
                activate={activate}
            />
        )
    ) : (
        <></>
    );
}
