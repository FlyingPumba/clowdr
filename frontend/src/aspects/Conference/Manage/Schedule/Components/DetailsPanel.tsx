import { ExternalLinkIcon } from "@chakra-ui/icons";
import {
    Button,
    chakra,
    FormControl,
    FormErrorMessage,
    FormHelperText,
    FormLabel,
    HStack,
    Input,
    InputGroup,
    InputRightAddon,
    Link,
    Select,
    Textarea,
    useDisclosure,
    VStack,
} from "@chakra-ui/react";
import { AuthHeader, HasuraRoleName } from "@midspace/shared-types/auth";
import type { ElementDataBlob } from "@midspace/shared-types/content";
import { Content_ElementType_Enum, ElementBaseType } from "@midspace/shared-types/content";
import * as R from "ramda";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { gql } from "urql";
import {
    Content_ItemType_Enum,
    Schedule_Mode_Enum,
    useManageSchedule_GetPresentationTimesQuery,
    useManageSchedule_GetTagsQuery,
} from "../../../../../generated/graphql";
import { DateTimePicker } from "../../../../Chakra/DateTimePicker";
import { CreatableMultiSelect } from "../../../../Chakra/MultiSelect";
import type { PanelProps, ValidationState } from "../../../../CRUDCards/Types";
import { useAuthParameters } from "../../../../GQL/AuthParameters";
import { makeContext } from "../../../../GQL/make-context";
import { useRestorableState } from "../../../../Hooks/useRestorableState";
import { roundUpToNearest } from "../../../../Utils/MathUtils";
import { useConference } from "../../../useConference";
import CreateTagModal from "./CreateTagModal";
import type { ScheduleEditorRecord } from "./ScheduleEditorRecord";

interface RecentlyUsedTag {
    id: string;
    lastUsedAt: number;
    count: number;
}

gql`
    query ManageSchedule_GetPresentationTimes($sessionEventId: uuid!) {
        schedule_Event(where: { sessionEventId: { _eq: $sessionEventId }, scheduledStartTime: { _is_null: false } }) {
            id
            scheduledStartTime
            scheduledEndTime
        }
    }
`;

export default function DetailsPanel({
    isCreate,
    isDisabled,
    clearState,
    firstInputRef,
    record,
    updateRecord,
    onValid,
    onInvalid,
    onAnyChange,
}: PanelProps<ScheduleEditorRecord>): JSX.Element {
    const isSession = !("sessionEventId" in record && record.sessionEventId);
    const conference = useConference();
    const { subconferenceId } = useAuthParameters();
    const context = useMemo(
        () =>
            makeContext({
                [AuthHeader.Role]: subconferenceId
                    ? HasuraRoleName.SubconferenceOrganizer
                    : HasuraRoleName.ConferenceOrganizer,
            }),
        [subconferenceId]
    );

    const hoursOptions = useMemo(() => {
        const result: JSX.Element[] = [];
        for (let i = 0; i <= 4; i++) {
            result.push(
                <option key={i} value={i}>
                    {i}
                </option>
            );
        }
        return result;
    }, []);
    const minutesOptions = useMemo(() => {
        const result: JSX.Element[] = [];
        for (let i = 0; i <= 59; i++) {
            result.push(
                <option key={i} value={i}>
                    {i}
                </option>
            );
        }
        return result;
    }, []);

    const startTime = useMemo(
        () =>
            record.scheduledStartTime
                ? new Date(record.scheduledStartTime)
                : isSession
                ? new Date(roundUpToNearest(Date.now(), 1000 * 60 * 5))
                : undefined,
        [isSession, record.scheduledStartTime]
    );
    const durationMinutes = useMemo(
        () =>
            startTime && record.scheduledEndTime
                ? Math.max(0, Math.round((Date.parse(record.scheduledEndTime) - startTime.getTime()) / (60 * 1000)))
                : 60,
        [record.scheduledEndTime, startTime]
    );

    const [startTimeHasChanged, setStartTimeHasChanged] = useState<boolean>(false);
    const [startTimeValidation, setStartTimeValidation] = useState<ValidationState>("no error");

    const [durationHasChanged, setDurationHasChanged] = useState<boolean>(false);
    const [durationValidation, setDurationValidation] = useState<ValidationState>("no error");

    const [nameHasChanged, setNameHasChanged] = useState<boolean>(false);
    const [nameValidation, setNameValidation] = useState<ValidationState>("no error");

    const updateValidity = useCallback(() => {
        if (isCreate) {
            if (!nameHasChanged && !record.item?.title?.length) {
                onInvalid({
                    error: "A name is required.",
                });
                return;
            } else if (record.item?.title?.length) {
                onAnyChange();
            }
        }
        if (startTimeValidation !== "no error") {
            onInvalid(startTimeValidation);
        } else if (durationValidation !== "no error") {
            onInvalid(durationValidation);
        } else if (nameValidation !== "no error") {
            onInvalid(nameValidation);
        } else {
            onValid();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [durationValidation, isCreate, nameHasChanged, nameValidation, startTimeValidation, record.item?.title?.length]);

    clearState.current = useCallback(() => {
        setStartTimeHasChanged(false);
        setDurationHasChanged(false);
        setNameHasChanged(false);

        updateValidity();
    }, [updateValidity]);

    useEffect(() => {
        if (startTimeHasChanged || durationHasChanged || nameHasChanged) {
            onAnyChange();
        }
    }, [durationHasChanged, nameHasChanged, onAnyChange, startTimeHasChanged]);

    useEffect(() => {
        if (startTimeHasChanged) {
            if (isSession) {
                if (record.scheduledStartTime) {
                    if ("modeName" in record && record.modeName === Schedule_Mode_Enum.Livestream) {
                        if (Date.parse(record.scheduledStartTime) - Date.now() < 20 * 60 * 1000) {
                            setStartTimeValidation({
                                error: "Live-stream sessions must be scheduled at least 20 minutes in advance.",
                            });
                        } else {
                            setStartTimeValidation("no error");
                        }
                    } else {
                        setStartTimeValidation("no error");
                    }
                } else {
                    setStartTimeValidation({ error: "A start date/time is required." });
                }
            } else {
                if (!record.scheduledStartTime) {
                    setStartTimeValidation("no error");
                } else {
                    if (
                        new Date(record.scheduledStartTime).getTime() <
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        new Date(record.session!.scheduledStartTime!).getTime()
                    ) {
                        setStartTimeValidation({
                            error: "Presentation must start at or after the start of the session.",
                        });
                    } else if (
                        new Date(record.scheduledStartTime).getTime() >=
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        new Date(record.session!.scheduledEndTime!).getTime()
                    ) {
                        setStartTimeValidation({
                            error: "Presentation must start before the end of the session.",
                        });
                    } else {
                        setStartTimeValidation("no error");
                    }
                }
            }
        } else {
            setStartTimeValidation("no error");
        }
    }, [isSession, record.scheduledStartTime, record, startTimeHasChanged]);

    const [presentationsResponse] = useManageSchedule_GetPresentationTimesQuery({
        variables: {
            sessionEventId: record.id,
        },
        pause: !record.id,
        context,
        requestPolicy: "network-only",
    });
    useEffect(() => {
        if (durationHasChanged) {
            const presentationsMinMax = presentationsResponse.data?.schedule_Event.reduce(
                (acc, x) => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const start = Date.parse(x.scheduledStartTime!);
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const end = Date.parse(x.scheduledEndTime!);
                    if (start < acc.min) {
                        acc.min = start;
                    }
                    if (end > acc.max) {
                        acc.max = end;
                    }
                    return acc;
                },
                { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
            );
            const presentationsFitWithin =
                !record.id ||
                Boolean(
                    presentationsResponse.data?.schedule_Event.length === 0 ||
                        (presentationsMinMax &&
                            record.scheduledStartTime &&
                            record.scheduledEndTime &&
                            Math.max(0, presentationsMinMax.max - presentationsMinMax.min) <=
                                Math.max(
                                    0,
                                    Date.parse(record.scheduledEndTime) - Date.parse(record.scheduledStartTime)
                                ))
                );
            if (!presentationsFitWithin) {
                setDurationValidation({ error: "Presentations do not fit within the new session time." });
                return;
            }

            if (isSession) {
                if (record.scheduledStartTime && record.scheduledEndTime) {
                    const duration = Math.max(
                        0,
                        Math.round(
                            (Date.parse(record.scheduledEndTime) - Date.parse(record.scheduledStartTime)) / (60 * 1000)
                        )
                    );
                    if (duration >= 3) {
                        setDurationValidation("no error");
                    } else {
                        setDurationValidation({ error: "Must be at least 3 minutes." });
                    }
                } else {
                    setDurationValidation({ error: "Duration is required." });
                }
            } else {
                if (record.scheduledStartTime) {
                    if (record.scheduledEndTime) {
                        const durationMins = Math.max(
                            0,
                            Math.round(
                                (Date.parse(record.scheduledEndTime) - Date.parse(record.scheduledStartTime)) /
                                    (60 * 1000)
                            )
                        );
                        if (durationMins >= 3) {
                            if (
                                new Date(record.scheduledEndTime).getTime() >
                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                new Date(record.session!.scheduledEndTime!).getTime()
                            ) {
                                setDurationValidation({
                                    error: "Presentation must end at or before the end of the session.",
                                });
                            } else {
                                setDurationValidation("no error");
                            }
                        } else {
                            setDurationValidation({ error: "Must be at least 3 minutes." });
                        }
                    } else {
                        setDurationValidation({ error: "Duration is required when a start time is set." });
                    }
                } else {
                    setDurationValidation("no error");
                }
            }
        } else {
            setDurationValidation("no error");
        }
    }, [
        durationHasChanged,
        record.scheduledStartTime,
        record.scheduledEndTime,
        isSession,
        record,
        presentationsResponse.data?.schedule_Event,
    ]);

    useEffect(() => {
        if (nameHasChanged) {
            if (record.item?.title?.length || record.name?.length) {
                setNameValidation("no error");
            } else {
                setNameValidation({ error: "A name is required." });
            }
        } else {
            setNameValidation("no error");
        }
    }, [nameHasChanged, record.item?.title, record.name]);

    useEffect(updateValidity, [updateValidity]);

    const [tagsResponse, refetchTags] = useManageSchedule_GetTagsQuery({
        variables: {
            conferenceId: conference.id,
            subconferenceCond: subconferenceId ? { _eq: subconferenceId } : { _is_null: true },
        },
        context,
        requestPolicy: "cache-and-network",
    });
    const tagOptions = useMemo(() => {
        const result =
            tagsResponse.data?.collection_Tag.map((x) => ({
                label: x.name,
                value: x.id,
            })) ?? [];
        result.push({
            label: "Create a tag",
            value: "¬create¬",
        });
        return result;
    }, [tagsResponse.data?.collection_Tag]);
    const tagValues = useMemo(
        () =>
            record.item?.itemTags?.map((x) => ({
                label: tagsResponse.data?.collection_Tag.find((y) => y.id === x.tagId)?.name ?? "<Loading...>",
                value: x.tagId,
            })) ?? [],
        [record.item?.itemTags, tagsResponse.data?.collection_Tag]
    );

    const [recentlyUsedTags, _setRecentlyUsedTags] = useRestorableState<RecentlyUsedTag[]>(
        "recently-used-tags:" + conference.id + ":" + (subconferenceId ?? "no-subconf"),
        [],
        (x) => JSON.stringify(x),
        (x) => JSON.parse(x)
    );
    const updateRecentlyUsedTags = useCallback(
        (value: RecentlyUsedTag[]) => {
            // Tags might have been deleted
            if (tagsResponse.data?.collection_Tag) {
                value = value.filter((x) => tagsResponse.data?.collection_Tag.some((y) => y.id === x.id));
            }

            const now = Date.now();
            const sortedTags = R.sortWith<RecentlyUsedTag>(
                [
                    (a, b) => Math.round(10 * Math.log(b.count)) / 10 - Math.round(10 * Math.log(a.count)) / 10,
                    (a, b) => b.lastUsedAt - a.lastUsedAt,
                ],
                R.filter((x) => now - x.lastUsedAt < 2 * 24 * 60 * 60 * 1000, value)
            );
            _setRecentlyUsedTags(sortedTags);
        },
        [_setRecentlyUsedTags, tagsResponse.data?.collection_Tag]
    );
    const setRecentlyUsedTags = useCallback(
        (value: RecentlyUsedTag[] | ((old: RecentlyUsedTag[]) => RecentlyUsedTag[])) => {
            updateRecentlyUsedTags(typeof value === "function" ? value(recentlyUsedTags) : value);
        },
        [recentlyUsedTags, updateRecentlyUsedTags]
    );
    useEffect(() => {
        updateRecentlyUsedTags(recentlyUsedTags);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tagsResponse.data?.collection_Tag]);
    const upsertRecentlyUsedTag = useCallback(
        (tagId: string) => {
            setRecentlyUsedTags((old) => {
                const newList = [...old];
                const existing = newList.find((x) => x.id === tagId);
                if (existing) {
                    existing.count++;
                    existing.lastUsedAt = Date.now();
                } else {
                    newList.push({
                        id: tagId,
                        count: 1,
                        lastUsedAt: Date.now(),
                    });
                }
                return newList;
            });
        },
        [setRecentlyUsedTags]
    );
    const remainingRecentlyUsedTags = useMemo(
        () => recentlyUsedTags.filter((x) => !record.item?.itemTags?.some((y) => y.tagId === x.id)).slice(0, 3),
        [recentlyUsedTags, record.item?.itemTags]
    );

    const [createTagName, setCreateTagName] = useState<string>("");
    const createTagDisclosure = useDisclosure();
    const onCreateTag = useCallback(
        (newTagId: string) => {
            refetchTags();
            onAnyChange();
            upsertRecentlyUsedTag(newTagId);
            updateRecord((old) => ({
                ...old,
                item: {
                    ...old.item,
                    itemTags: [
                        ...(old.item?.itemTags ?? []),
                        {
                            tagId: newTagId,
                        },
                    ],
                },
            }));
        },
        [onAnyChange, refetchTags, updateRecord, upsertRecentlyUsedTag]
    );

    const defaultItemTypeName = isSession ? Content_ItemType_Enum.Session : Content_ItemType_Enum.Presentation;

    useEffect(() => {
        if (isSession) {
            updateRecord((old) => ({
                ...old,
                scheduledStartTime: old.scheduledStartTime ?? startTime?.toISOString(),
                scheduledEndTime:
                    old.scheduledEndTime ??
                    (startTime ? new Date(startTime.getTime() + durationMinutes * 60 * 1000).toISOString() : undefined),
                item: old.item
                    ? { ...old.item, typeName: old.item.typeName ?? defaultItemTypeName }
                    : { typeName: defaultItemTypeName },
            }));
        } else {
            updateRecord((old) => ({
                ...old,
                item: old.item
                    ? { ...old.item, typeName: old.item.typeName ?? defaultItemTypeName }
                    : { typeName: defaultItemTypeName },
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [durationMinutes, isSession, startTime]);

    return (
        <VStack spacing={6} p={0}>
            <FormControl
                isInvalid={startTimeValidation !== "no error"}
                isDisabled={isDisabled}
                id="editor-session-start-time"
            >
                <FormLabel>Start date and time</FormLabel>
                <DateTimePicker
                    isDisabled={isDisabled}
                    ref={firstInputRef as any}
                    value={startTime}
                    allowUndefined={!isSession}
                    onChange={(value) => {
                        setStartTimeHasChanged(true);

                        updateRecord((old) => ({
                            ...old,
                            scheduledStartTime: value?.toISOString(),
                            scheduledEndTime: value
                                ? new Date(value.getTime() + durationMinutes * 60 * 1000).toISOString()
                                : startTime
                                ? new Date(startTime.getTime() + durationMinutes * 60 * 1000).toISOString()
                                : undefined,
                        }));
                    }}
                />
                <FormHelperText>
                    Enter times in your local timezone.{" "}
                    {!isSession ? "Leave blank for sessions that do not follow a preset schedule." : undefined}
                </FormHelperText>
                <FormErrorMessage>
                    {startTimeValidation !== "no error" ? startTimeValidation.error : "No error"}
                </FormErrorMessage>
            </FormControl>
            {isSession || startTime ? (
                <FormControl isInvalid={durationValidation !== "no error"} isDisabled={isDisabled}>
                    <FormLabel id="editor-session-duration-label">Duration</FormLabel>
                    <HStack w="auto">
                        <InputGroup w="auto">
                            <Select
                                aria-labelledby="editor-session-duration-label editor-session-duration-hours-label"
                                value={Math.floor(durationMinutes / 60)}
                                onChange={(ev) => {
                                    setDurationHasChanged(true);

                                    const existingMinutes = durationMinutes % 60;
                                    const newHours = parseInt(ev.target.value, 10);
                                    const value = newHours * 60 + existingMinutes;
                                    const endTime = startTime
                                        ? new Date(startTime.getTime() + value * 60 * 1000)
                                        : undefined;
                                    updateRecord((old) => ({
                                        ...old,
                                        scheduledStartTime: startTime,
                                        scheduledEndTime: endTime?.toISOString(),
                                    }));
                                }}
                            >
                                {hoursOptions}
                            </Select>
                            <InputRightAddon id="editor-session-duration-hours-label">hours</InputRightAddon>
                        </InputGroup>
                        <InputGroup w="auto">
                            <Select
                                aria-labelledby="editor-session-duration-label editor-session-duration-minutes-label"
                                value={durationMinutes % 60}
                                onChange={(ev) => {
                                    setDurationHasChanged(true);

                                    const existingHours = Math.floor(durationMinutes / 60);
                                    const newMinutes = parseInt(ev.target.value, 10);
                                    const value = existingHours * 60 + newMinutes;
                                    const endTime = startTime
                                        ? new Date(startTime.getTime() + value * 60 * 1000)
                                        : undefined;
                                    updateRecord((old) => ({
                                        ...old,
                                        scheduledStartTime: startTime,
                                        scheduledEndTime: endTime?.toISOString(),
                                    }));
                                }}
                            >
                                {minutesOptions}
                            </Select>
                            <InputRightAddon id="editor-session-duration-minutes-label">minutes</InputRightAddon>
                        </InputGroup>
                    </HStack>
                    <FormErrorMessage>
                        {durationValidation !== "no error" ? durationValidation.error : "No error"}
                    </FormErrorMessage>
                </FormControl>
            ) : undefined}
            <FormControl id="editor-session-name" isInvalid={nameValidation !== "no error"} isDisabled={isDisabled}>
                <FormLabel>Name of {isSession ? "session" : "presentation"}</FormLabel>
                <Input
                    type="text"
                    value={record.item?.title ?? record.name ?? ""}
                    onChange={(ev) => {
                        setNameHasChanged(true);

                        const value = ev.target.value;
                        updateRecord((old) => ({
                            ...old,
                            name: value,
                            item: old.item
                                ? { ...old.item, title: value }
                                : {
                                      title: value,
                                  },
                        }));
                    }}
                />
                <FormErrorMessage>{nameValidation !== "no error" ? nameValidation.error : "No error"}</FormErrorMessage>
            </FormControl>
            <FormControl id="editor-session-description" isDisabled={isDisabled}>
                <FormLabel>{isSession ? "Session" : "Presentation"} description (abstract)</FormLabel>
                <Textarea
                    value={record.item?.abstract?.[0]?.data?.[record.item.abstract[0].data.length - 1]?.data.text ?? ""}
                    onChange={(ev) => {
                        onAnyChange();

                        const value = ev.target.value;
                        updateRecord((old) => ({
                            ...old,
                            item: old.item
                                ? {
                                      ...old.item,
                                      abstract: old.item.abstract?.length
                                          ? [
                                                {
                                                    ...old.item.abstract[0],
                                                    data: old.item.abstract[0].data?.length
                                                        ? ([
                                                              {
                                                                  ...old.item.abstract[0].data[0],
                                                                  data: {
                                                                      baseType: ElementBaseType.Text,
                                                                      type: Content_ElementType_Enum.Abstract,
                                                                      text: value,
                                                                  },
                                                              },
                                                          ] as ElementDataBlob)
                                                        : ([
                                                              {
                                                                  createdAt: Date.now(),
                                                                  createdBy: "user",
                                                                  data: {
                                                                      baseType: ElementBaseType.Text,
                                                                      type: Content_ElementType_Enum.Abstract,
                                                                      text: value,
                                                                  },
                                                              },
                                                          ] as ElementDataBlob),
                                                },
                                            ]
                                          : [
                                                {
                                                    data: [
                                                        {
                                                            createdAt: Date.now(),
                                                            createdBy: "user",
                                                            data: {
                                                                baseType: ElementBaseType.Text,
                                                                type: Content_ElementType_Enum.Abstract,
                                                                text: value,
                                                            },
                                                        },
                                                    ] as ElementDataBlob,
                                                },
                                            ],
                                  }
                                : {
                                      abstract: [
                                          {
                                              data: [
                                                  {
                                                      createdAt: Date.now(),
                                                      createdBy: "user",
                                                      data: {
                                                          baseType: ElementBaseType.Text,
                                                          type: Content_ElementType_Enum.Abstract,
                                                          text: value,
                                                      },
                                                  },
                                              ] as ElementDataBlob,
                                          },
                                      ],
                                  },
                        }));
                    }}
                />
                <FormHelperText>
                    Use{" "}
                    <Link isExternal href="https://itsfoss.com/markdown-guide/">
                        Markdown syntax
                        <sup>
                            <ExternalLinkIcon />
                        </sup>
                    </Link>{" "}
                    to format your text.
                </FormHelperText>
            </FormControl>
            <FormControl>
                <FormLabel>Tags</FormLabel>
                <CreatableMultiSelect
                    options={tagOptions}
                    value={tagValues}
                    onCreateOption={(value) => {
                        setCreateTagName(value);
                        createTagDisclosure.onOpen();
                    }}
                    onChange={(options, action) => {
                        if (
                            action.action === "create-option" ||
                            (action.action === "select-option" && action.option?.value === "¬create¬")
                        ) {
                            setCreateTagName(action.action === "create-option" ? action.name ?? "" : "");
                            createTagDisclosure.onOpen();
                        } else {
                            const tagIds = R.uniq(options.filter((x) => x.value !== "¬create¬").map((x) => x.value));
                            onAnyChange();
                            if (action.action === "select-option" && action.option?.value) {
                                upsertRecentlyUsedTag(action.option.value);
                            }
                            updateRecord((old) => ({
                                ...old,
                                item: {
                                    ...old.item,
                                    itemTags: tagIds.map((tagId) => ({ tagId })),
                                },
                            }));
                        }
                    }}
                />
                {remainingRecentlyUsedTags.length > 0 ? (
                    <HStack spacing={2} mt={1}>
                        <chakra.span fontSize="sm">Recently used:</chakra.span>
                        {remainingRecentlyUsedTags.map(({ id }) => (
                            <Button
                                key={id}
                                size="xs"
                                h="auto"
                                minH={0}
                                py={1}
                                px={2}
                                minW={0}
                                borderRadius="full"
                                colorScheme="gray"
                                onClick={() => {
                                    const tagIds = record.item?.itemTags?.map((x) => x.tagId) ?? [];
                                    tagIds.push(id);
                                    onAnyChange();
                                    upsertRecentlyUsedTag(id);
                                    updateRecord((old) => ({
                                        ...old,
                                        item: {
                                            ...old.item,
                                            itemTags: tagIds.map((tagId) => ({ tagId })),
                                        },
                                    }));
                                }}
                            >
                                {tagOptions.find((x) => x.value === id)?.label ?? "<Loading...>"}
                            </Button>
                        ))}
                    </HStack>
                ) : undefined}
            </FormControl>
            <FormControl id="editor-session-type" isDisabled={isDisabled}>
                <FormLabel>Type</FormLabel>
                <Select
                    value={record.item?.typeName ?? defaultItemTypeName}
                    onChange={(ev) => {
                        onAnyChange();
                        updateRecord((old) => ({
                            ...old,
                            item: old.item
                                ? {
                                      ...old.item,
                                      typeName: ev.target.value as Content_ItemType_Enum,
                                  }
                                : {
                                      typeName: ev.target.value as Content_ItemType_Enum,
                                  },
                        }));
                    }}
                >
                    {!isSession ? (
                        <>
                            <option value={Content_ItemType_Enum.Demonstration}>Demonstration</option>
                            <option value={Content_ItemType_Enum.Keynote}>Keynote</option>
                            <option value={Content_ItemType_Enum.Other}>Other</option>
                            <option value={Content_ItemType_Enum.Paper}>Paper</option>
                            <option value={Content_ItemType_Enum.Poster}>Poster</option>
                            <option value={Content_ItemType_Enum.Presentation}>Presentation</option>
                            <option value={Content_ItemType_Enum.SessionQAndA}>Session Q&amp;A</option>
                        </>
                    ) : (
                        <>
                            <option value={Content_ItemType_Enum.Session}>Session</option>
                            <option value={Content_ItemType_Enum.Social}>Social</option>
                            <option value={Content_ItemType_Enum.Symposium}>Symposium</option>
                            <option value={Content_ItemType_Enum.Tutorial}>Tutorial</option>
                            <option value={Content_ItemType_Enum.Workshop}>Workshop</option>
                        </>
                    )}
                </Select>
                <FormHelperText>
                    This is a descriptive label only, to help your attendees understand what kind of{" "}
                    {isSession ? "session" : "presentation"} this is.
                </FormHelperText>
            </FormControl>
            <CreateTagModal
                initialName={createTagName}
                isOpen={createTagDisclosure.isOpen}
                onClose={createTagDisclosure.onClose}
                onCreate={onCreateTag}
            />
        </VStack>
    );
}
