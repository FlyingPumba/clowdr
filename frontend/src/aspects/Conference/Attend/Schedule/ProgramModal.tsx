import { useDisclosure } from "@chakra-ui/react";
import type { FocusableElement } from "@chakra-ui/utils";
import { gql } from "@urql/core";
import React, { Suspense, useCallback, useMemo, useRef } from "react";
import { useRestorableState } from "../../../Hooks/useRestorableState";
import { useConference } from "../../useConference";

const ScheduleModal = React.lazy(() => import("./ScheduleModal"));

gql`
    query Schedule_HappeningSoon($conferenceId: uuid!, $startBefore: timestamptz!, $endAfter: timestamptz!) {
        schedule_Event(
            where: {
                conferenceId: { _eq: $conferenceId }
                scheduledStartTime: { _lte: $startBefore }
                scheduledEndTime: { _gte: $endAfter }
                sessionEventId: { _is_null: true }
            }
        ) {
            ...Schedule_EventSummary
            item {
                ...Schedule_ItemFields
            }
            room {
                ...Schedule_RoomSummary
            }
        }
        collection_ProgramPerson(where: { conferenceId: { _eq: $conferenceId } }) {
            ...Schedule_ProgramPerson
        }
        collection_Tag(where: { conferenceId: { _eq: $conferenceId } }) {
            ...Schedule_Tag
        }
    }
`;

export enum ProgramModalTab {
    Tags = "Tags",
    HappeningSoon = "HappeningSoon",
    Exhibitions = "Exhibitions",
    Sponsors = "Sponsors",
    Schedule = "Schedule",
    SchedulePreview = "ScheduleV2",
}

interface ScheduleModalContext {
    isOpen: boolean;
    onOpen: (tagId?: string, tab?: ProgramModalTab) => void;
    onClose: () => void;
    finalFocusRef: React.RefObject<FocusableElement>;
}

const ScheduleModalContext = React.createContext<ScheduleModalContext | undefined>(undefined);

export function useScheduleModal(): ScheduleModalContext {
    const ctx = React.useContext(ScheduleModalContext);
    if (!ctx) {
        throw new Error("Context not available - are you outside the provider?");
    }
    return ctx;
}

export function ScheduleModalProvider({ children }: React.PropsWithChildren<any>): JSX.Element {
    const conference = useConference();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const scheduleButtonRef = useRef<FocusableElement>(null);
    const [selectedTab, setSelectedTab] = useRestorableState<ProgramModalTab>(
        "ProgramModal_SelectedTab" + conference.id,
        ProgramModalTab.HappeningSoon,
        (x) => x,
        (x) => x as ProgramModalTab
    );
    const [selectedTagId, setSelectedTag] = useRestorableState<string | null>(
        "ProgramModal_ItemList_OpenPanelId" + conference.id,
        null,
        (s) => (s === null ? "null" : s),
        (s) => (s === "null" ? null : s)
    );

    const doOnOpen = useCallback(
        (tagId?: string, tab?: ProgramModalTab) => {
            onOpen();
            if (tab) {
                setSelectedTab(tab);
            }
            if (tagId) {
                setSelectedTag(tagId);
                if (!tab) {
                    setSelectedTab(ProgramModalTab.Tags);
                }
            }
        },
        [onOpen, setSelectedTab, setSelectedTag]
    );

    const ctx: ScheduleModalContext = useMemo(
        () => ({
            finalFocusRef: scheduleButtonRef,
            isOpen,
            onOpen: doOnOpen,
            onClose,
        }),
        [doOnOpen, isOpen, onClose]
    );

    return (
        <ScheduleModalContext.Provider value={ctx}>
            {children}
            <Suspense fallback={null}>
                <ScheduleModal
                    isOpen={isOpen}
                    onClose={onClose}
                    finalFocusRef={scheduleButtonRef}
                    selectedTab={selectedTab}
                    setSelectedTab={setSelectedTab}
                    selectedTagId={selectedTagId}
                    setSelectedTag={setSelectedTag}
                />
            </Suspense>
        </ScheduleModalContext.Provider>
    );
}
