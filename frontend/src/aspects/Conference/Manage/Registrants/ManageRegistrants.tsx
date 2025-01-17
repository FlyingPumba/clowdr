import { ChevronDownIcon } from "@chakra-ui/icons";
import {
    Box,
    Button,
    Center,
    Flex,
    FormLabel,
    Input,
    Menu,
    MenuButton,
    MenuGroup,
    MenuItem,
    MenuItemOption,
    MenuList,
    Select,
    Text,
    Tooltip,
    useClipboard,
    useDisclosure,
    useToast,
} from "@chakra-ui/react";
import { assert } from "@midspace/assert";
import { AuthHeader, HasuraRoleName } from "@midspace/shared-types/auth";
import { gql } from "@urql/core";
import Papa from "papaparse";
import * as R from "ramda";
import type { LegacyRef } from "react";
import React, { useMemo, useState } from "react";
import { useClient } from "urql";
import { v4 as uuidv4 } from "uuid";
import type {
    ManageRegistrants_SelectProfilesQuery,
    ManageRegistrants_SelectProfilesQueryVariables,
    RegistrantPartsFragment,
} from "../../../../generated/graphql";
import {
    ManageRegistrants_SelectProfilesDocument,
    Registrant_RegistrantRole_Enum,
    useDeleteRegistrantsMutation,
    useInsertInvitationEmailJobsMutation,
    useInsertRegistrantMutation,
    useInsertRegistrantWithoutInviteMutation,
    useManagePeople_InsertCustomEmailJobMutation,
    useSelectAllGroupsQuery,
    useSelectAllRegistrantsQuery,
    useUpdateRegistrantMutation,
} from "../../../../generated/graphql";
import type { BadgeData } from "../../../Badges/ProfileBadge";
import FAIcon from "../../../Chakra/FAIcon";
import { LinkButton } from "../../../Chakra/LinkButton";
import MultiSelect from "../../../Chakra/MultiSelect";
import {
    CheckBoxColumnFilter,
    formatEnumValue,
    MultiSelectColumnFilter,
    SelectColumnFilter,
    TextColumnFilter,
} from "../../../CRUDTable2/CRUDComponents";
import type {
    CellProps,
    ColumnHeaderProps,
    ColumnSpecification,
    Delete,
    ExtraButton,
    Insert,
    RowSpecification,
    Update,
} from "../../../CRUDTable2/CRUDTable2";
import CRUDTable, { SortDirection } from "../../../CRUDTable2/CRUDTable2";
import { useAuthParameters } from "../../../GQL/AuthParameters";
import extractActualError from "../../../GQL/ExtractActualError";
import { makeContext } from "../../../GQL/make-context";
import useQueryErrorToast from "../../../GQL/useQueryErrorToast";
import { maybeCompare } from "../../../Utils/maybeCompare";
import { useConference } from "../../useConference";
import { DashboardPage } from "../DashboardPage";
import { SendEmailModal } from "./SendEmailModal";

gql`
    fragment InvitationParts on registrant_Invitation {
        registrantId
        id
        inviteCode
        invitedEmailAddress
        linkToUserId
        createdAt
        updatedAt
        hash
    }

    fragment RegistrantParts on registrant_Registrant {
        conferenceId
        id
        conferenceRole
        invitation {
            ...InvitationParts
        }
        groupRegistrants {
            registrantId
            id
            groupId
        }
        subconferenceMemberships {
            id
            subconferenceId
            registrantId
            role
        }
        userId
        updatedAt
        createdAt
        displayName
        invitationStatus
        isProgramPerson
    }

    fragment ManageRegistrants_Profile on registrant_Profile {
        registrantId
        badges
        affiliation
        country
        timezoneUTCOffset
        bio
        website
        github
        twitter
        affiliationURL
        pronouns
        photoURL_50x50
        photoURL_350x350
        hasBeenEdited
    }

    fragment SubconferenceParts on conference_Subconference {
        id
        conferenceId
        name
        shortName
        slug
    }

    query SelectAllRegistrants($conferenceId: uuid!) {
        registrant_Registrant(where: { conferenceId: { _eq: $conferenceId } }) {
            ...RegistrantParts
        }
        conference_Subconference(where: { conferenceId: { _eq: $conferenceId } }) {
            ...SubconferenceParts
        }
    }

    query ManageRegistrants_SelectProfiles($registrantIds: [uuid!]!) {
        registrant_Profile(where: { registrantId: { _in: $registrantIds } }) {
            ...ManageRegistrants_Profile
        }
    }

    mutation InsertRegistrant(
        $registrant: registrant_Registrant_insert_input!
        $invitation: registrant_Invitation_insert_input!
    ) {
        insert_registrant_Registrant_one(object: $registrant) {
            ...RegistrantParts
        }
        insert_registrant_Invitation_one(object: $invitation) {
            ...InvitationParts
        }
    }

    mutation InsertRegistrantWithoutInvite($registrant: registrant_Registrant_insert_input!) {
        insert_registrant_Registrant_one(object: $registrant) {
            ...RegistrantParts
        }
    }

    mutation DeleteRegistrants($deleteRegistrantIds: [uuid!] = []) {
        delete_registrant_Registrant(where: { id: { _in: $deleteRegistrantIds } }) {
            returning {
                id
            }
        }
    }

    mutation UpdateRegistrant(
        $registrantId: uuid!
        $registrantUpdates: registrant_Registrant_set_input!
        $upsertGroups: [registrant_GroupRegistrant_insert_input!]!
        $remainingGroupIds: [uuid!]
        $upsertSubconferences: [registrant_SubconferenceMembership_insert_input!]!
        $remainingSubconferenceIds: [uuid!]
    ) {
        update_registrant_Registrant_by_pk(pk_columns: { id: $registrantId }, _set: $registrantUpdates) {
            ...RegistrantParts
        }
        insert_registrant_GroupRegistrant(
            objects: $upsertGroups
            on_conflict: { constraint: GroupRegistrant_groupId_registrantId_key, update_columns: [] }
        ) {
            returning {
                id
                registrantId
                groupId
            }
        }
        delete_registrant_GroupRegistrant(
            where: { registrantId: { _eq: $registrantId }, groupId: { _nin: $remainingGroupIds } }
        ) {
            returning {
                id
            }
        }
        insert_registrant_SubconferenceMembership(
            objects: $upsertSubconferences
            on_conflict: {
                constraint: SubconferenceMembership_subconferenceId_registrantId_key
                update_columns: [role]
            }
        ) {
            returning {
                id
                registrantId
                subconferenceId
                role
            }
        }
        delete_registrant_SubconferenceMembership(
            where: { registrantId: { _eq: $registrantId }, subconferenceId: { _nin: $remainingSubconferenceIds } }
        ) {
            returning {
                id
            }
        }
    }

    mutation InsertInvitationEmailJobs($registrantIds: jsonb!, $conferenceId: uuid!, $sendRepeat: Boolean!) {
        insert_job_queues_InvitationEmailJob(
            objects: [{ registrantIds: $registrantIds, conferenceId: $conferenceId, sendRepeat: $sendRepeat }]
        ) {
            affected_rows
        }
    }

    mutation ManagePeople_InsertCustomEmailJob(
        $markdownBody: String!
        $subject: String!
        $conferenceId: uuid!
        $subconferenceId: uuid
        $registrantIds: jsonb!
    ) {
        insert_job_queues_CustomEmailJob(
            objects: {
                markdownBody: $markdownBody
                subject: $subject
                conferenceId: $conferenceId
                subconferenceId: $subconferenceId
                registrantIds: $registrantIds
            }
        ) {
            affected_rows
        }
    }
`;

// TODO: Email validation

type InvitationStatus =
    | undefined
    | {
          sentAt?: string | null;
          status?: "processing" | "processed" | "dropped" | "delivered" | "deferred" | "bounce" | "blocked" | null;
          errorMessage?: string | null;
      };

type RegistrantDescriptor = RegistrantPartsFragment & {
    id?: string;
    groupRegistrants?: ReadonlyArray<
        RegistrantPartsFragment["groupRegistrants"][0] & {
            id?: string;
        }
    >;
    subconferenceMemberships?: ReadonlyArray<
        RegistrantPartsFragment["subconferenceMemberships"][0] & {
            id?: string;
        }
    >;
};

export default function ManageRegistrants(): JSX.Element {
    const conference = useConference();
    const { conferencePath, subconferenceId } = useAuthParameters();

    const context = useMemo(
        () =>
            makeContext(
                {
                    [AuthHeader.Role]: subconferenceId
                        ? HasuraRoleName.SubconferenceOrganizer
                        : HasuraRoleName.ConferenceOrganizer,
                },
                ["registrant_Group", "conference_Subconference"]
            ),
        [subconferenceId]
    );
    const [{ fetching: loadingAllGroups, error: errorAllGroups, data: allGroups }] = useSelectAllGroupsQuery({
        requestPolicy: "network-only",
        variables: {
            conferenceId: conference.id,
            subconferenceCond: subconferenceId ? { _eq: subconferenceId } : { _is_null: true },
        },
        context,
    });
    useQueryErrorToast(errorAllGroups, false);

    const selectAllRegistrantsContext = useMemo(
        () =>
            makeContext(
                {
                    [AuthHeader.Role]: subconferenceId
                        ? HasuraRoleName.SubconferenceOrganizer
                        : HasuraRoleName.ConferenceOrganizer,
                },
                ["registrant_Invitation", "registrant_GroupRegistrant", "registrant_SubconferenceMembership"]
            ),
        [subconferenceId]
    );
    const [
        { fetching: loadingAllRegistrants, error: errorAllRegistrants, data: allRegistrants },
        refetchAllRegistrants,
    ] = useSelectAllRegistrantsQuery({
        requestPolicy: "network-only",
        variables: {
            conferenceId: conference.id,
        },
        context: selectAllRegistrantsContext,
    });
    useQueryErrorToast(errorAllRegistrants, false);
    const data = useMemo(
        () => [...(allRegistrants?.registrant_Registrant ?? [])],
        [allRegistrants?.registrant_Registrant]
    );

    const [insertRegistrantResponse, insertRegistrant] = useInsertRegistrantMutation();
    const [insertRegistrantWithoutInviteResponse, insertRegistrantWithoutInvite] =
        useInsertRegistrantWithoutInviteMutation();
    const [deleteRegistrantsResponse, deleteRegistrants] = useDeleteRegistrantsMutation();
    const [updateRegistrantResponse, updateRegistrant] = useUpdateRegistrantMutation();

    const row: RowSpecification<RegistrantDescriptor> = useMemo(
        () => ({
            getKey: (record) => record.id,
            canSelect: (_record) => true,
            pages: {
                defaultToLast: false,
            },
            invalid: (record) =>
                !record.displayName?.length
                    ? {
                          columnId: "name",
                          reason: "Display name required",
                      }
                    : false,
        }),
        []
    );

    const inviteStatusFilterOptions = useMemo(
        () => [
            {
                label: "Unsent",
                value: "unsent",
            },
            {
                label: "Sending",
                value: "processed",
            },
            {
                label: "Sent",
                value: "delivered",
            },
            {
                label: "Error",
                value: "error",
            },
        ],
        []
    );

    const roleOptions = useMemo(
        () =>
            Object.keys(Registrant_RegistrantRole_Enum)
                .map((x) => {
                    const v = (Registrant_RegistrantRole_Enum as any)[x];
                    return { value: v, label: formatEnumValue(v) };
                })
                .sort((x, y) => x.label.localeCompare(y.label)),
        []
    );

    const columns: ColumnSpecification<RegistrantDescriptor>[] = useMemo(() => {
        const groupOptions: { value: string; label: string }[] =
            allGroups?.registrant_Group.map((group) => ({
                value: group.id,
                label: group.name,
            })) ?? [];

        const subconferenceOptions: { value: string; label: string }[] =
            allRegistrants?.conference_Subconference.flatMap((group) => [
                {
                    value: group.id + "¬" + Registrant_RegistrantRole_Enum.Organizer,
                    label: `${group.shortName} (Organizer)`,
                },
                {
                    value: group.id + "¬" + Registrant_RegistrantRole_Enum.Attendee,
                    label: `${group.shortName} (Attendee)`,
                },
            ]) ?? [];

        const result: ColumnSpecification<RegistrantDescriptor>[] = [
            {
                id: "name",
                defaultSortDirection: SortDirection.Asc,
                header: function NameHeader({ isInCreate, onClick, sortDir }: ColumnHeaderProps<RegistrantDescriptor>) {
                    return isInCreate ? (
                        <FormLabel>Name</FormLabel>
                    ) : (
                        <Button size="xs" onClick={onClick}>
                            Name{sortDir !== null ? ` ${sortDir}` : undefined}
                        </Button>
                    );
                },
                get: (data) => data.displayName,
                set: (record, value: string) => {
                    record.displayName = value;
                },
                sort: (x: string, y: string) => x.localeCompare(y),
                filterFn: (rows: Array<RegistrantDescriptor>, filterValue: string) => {
                    if (filterValue === "") {
                        return rows.filter((row) => (row.displayName ?? "") === "");
                    } else {
                        return rows.filter((row) => row.displayName.toLowerCase().includes(filterValue.toLowerCase()));
                    }
                },
                filterEl: TextColumnFilter,
                cell: function NameCell({ value, onChange, onBlur, ref }: CellProps<Partial<RegistrantDescriptor>>) {
                    const { onCopy, hasCopied } = useClipboard(value ?? "");
                    return (
                        <Flex alignItems="center">
                            <Input
                                type="text"
                                value={value ?? ""}
                                onChange={(ev) => onChange?.(ev.target.value)}
                                onBlur={onBlur}
                                border="1px solid"
                                borderColor="rgba(255, 255, 255, 0.16)"
                                ref={ref as LegacyRef<HTMLInputElement>}
                                mr={2}
                            />
                            <Button onClick={onCopy} size="xs" ml="auto">
                                <FAIcon iconStyle="s" icon={hasCopied ? "check-circle" : "clipboard"} />
                            </Button>
                        </Flex>
                    );
                },
            },
            {
                id: "invitationStatus",
                header: function NameHeader({ isInCreate, onClick, sortDir }: ColumnHeaderProps<RegistrantDescriptor>) {
                    if (isInCreate) {
                        return undefined;
                    } else {
                        return (
                            <Button size="xs" onClick={onClick}>
                                Invite status{sortDir !== null ? ` ${sortDir}` : undefined}
                            </Button>
                        );
                    }
                },
                get: (data) => (data.invitationStatus ? data.invitationStatus : undefined) as InvitationStatus,
                sort: (x: InvitationStatus, y: InvitationStatus) =>
                    maybeCompare(x?.status, y?.status, (a, b) => a.localeCompare(b)),
                filterFn: (rows: Array<RegistrantDescriptor>, filterValue: string) => {
                    return rows.filter((row) => {
                        let status = row.invitationStatus?.status;
                        status =
                            status === undefined
                                ? "unsent"
                                : status === "processing" || status === "processed"
                                ? "processed"
                                : status === "delivered"
                                ? "delivered"
                                : "error";
                        return status === filterValue;
                    });
                },
                filterEl: SelectColumnFilter(inviteStatusFilterOptions),
                cell: function InvitationStatusCell({
                    isInCreate,
                    value,
                }: CellProps<Partial<RegistrantDescriptor>, InvitationStatus>) {
                    if (isInCreate) {
                        return undefined;
                    } else if (value) {
                        if (value.status === "processing" || value.status === "processed") {
                            return (
                                <Center>
                                    <Tooltip label="Sending in progress">
                                        <FAIcon iconStyle="s" icon="paper-plane" />
                                    </Tooltip>
                                </Center>
                            );
                        } else if (
                            value.status === "blocked" ||
                            value.status === "bounce" ||
                            value.status === "deferred" ||
                            value.status === "dropped"
                        ) {
                            return (
                                <Center>
                                    <Tooltip
                                        label={`Error sending invitation email! Reason: ${value.status}.${
                                            value.errorMessage ? ` Message from server: ${value.errorMessage}` : ""
                                        }`}
                                    >
                                        <FAIcon iconStyle="s" icon="exclamation-circle" />
                                    </Tooltip>
                                </Center>
                            );
                        } else if (value.status === "delivered") {
                            return (
                                <Center>
                                    <Tooltip label="Sent">
                                        <FAIcon iconStyle="s" icon="check" />
                                    </Tooltip>
                                </Center>
                            );
                        } else {
                            return (
                                <Center>
                                    <Tooltip label="Unrecognised status">
                                        <FAIcon iconStyle="s" icon="bug" />
                                    </Tooltip>
                                </Center>
                            );
                        }
                    } else {
                        return (
                            <Center>
                                <Tooltip label="Unsent">
                                    <FAIcon iconStyle="s" icon="times" />
                                </Tooltip>
                            </Center>
                        );
                    }
                },
            },
            {
                id: "inviteAccepted",
                header: function NameHeader({ isInCreate, onClick, sortDir }: ColumnHeaderProps<RegistrantDescriptor>) {
                    if (isInCreate) {
                        return undefined;
                    } else {
                        return (
                            <Button size="xs" onClick={onClick}>
                                Invite accepted?{sortDir !== null ? ` ${sortDir}` : undefined}
                            </Button>
                        );
                    }
                },
                get: (data) => !!data.userId,
                sort: (x: boolean, y: boolean) => (x && y ? 0 : x ? -1 : y ? 1 : 0),
                filterFn: (rows: Array<RegistrantDescriptor>, filterValue: boolean) => {
                    return rows.filter((row) => !!row.userId === filterValue);
                },
                filterEl: CheckBoxColumnFilter,
                cell: function InvitationAcceptedCell({
                    isInCreate,
                    value,
                }: CellProps<Partial<RegistrantDescriptor>, boolean>) {
                    if (isInCreate) {
                        return undefined;
                    } else {
                        return (
                            <Center>
                                <FAIcon iconStyle="s" icon={value ? "check" : "times"} />
                            </Center>
                        );
                    }
                },
            },
            {
                id: "invitedEmailAddress",
                header: function NameHeader({ isInCreate, onClick, sortDir }: ColumnHeaderProps<RegistrantDescriptor>) {
                    return isInCreate ? (
                        <FormLabel>Invitation address</FormLabel>
                    ) : (
                        <Button size="xs" onClick={onClick}>
                            Invitation address{sortDir !== null ? ` ${sortDir}` : undefined}
                        </Button>
                    );
                },
                get: (data) => data.invitation?.invitedEmailAddress ?? "",
                set: (record, value: string) => {
                    if (!record.invitation) {
                        assert.truthy(record.id);
                        record.invitation = {
                            registrantId: record.id,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            invitedEmailAddress: value,
                            inviteCode: "",
                            id: "",
                        };
                    } else {
                        record.invitation.invitedEmailAddress = value;
                    }
                },
                sort: (x: string, y: string) => x.localeCompare(y),
                filterFn: (rows: Array<RegistrantDescriptor>, filterValue: string) => {
                    if (filterValue === "") {
                        return rows.filter((row) => (row.invitation?.invitedEmailAddress ?? "") === "");
                    } else {
                        return rows.filter((row) =>
                            row.invitation?.invitedEmailAddress?.toLowerCase().includes(filterValue.toLowerCase())
                        );
                    }
                },
                filterEl: TextColumnFilter,
                cell: function InvitedEmailAddressCell({
                    isInCreate,
                    value,
                    onChange,
                    onBlur,
                    ref,
                }: CellProps<Partial<RegistrantDescriptor>>) {
                    const { onCopy, hasCopied } = useClipboard(value ?? "");
                    if (isInCreate) {
                        return (
                            <Input
                                type="email"
                                value={value ?? ""}
                                onChange={(ev) => onChange?.(ev.target.value)}
                                onBlur={onBlur}
                                border="1px solid"
                                borderColor="rgba(255, 255, 255, 0.16)"
                                ref={ref as LegacyRef<HTMLInputElement>}
                            />
                        );
                    } else {
                        return (
                            <Flex alignItems="center">
                                <Text px={2}>{value}</Text>
                                {value ? (
                                    <Button onClick={onCopy} size="xs" ml="auto">
                                        <FAIcon iconStyle="s" icon={hasCopied ? "check-circle" : "clipboard"} />
                                    </Button>
                                ) : undefined}
                            </Flex>
                        );
                    }
                },
            },
            {
                id: "inviteCode",
                header: function NameHeader({ isInCreate }: ColumnHeaderProps<RegistrantDescriptor>) {
                    if (isInCreate) {
                        return undefined;
                    } else {
                        return (
                            <Text fontSize="xs" p={1} textAlign="center" textTransform="none" fontWeight="normal">
                                Invite code
                            </Text>
                        );
                    }
                },
                get: (data) => data.invitation?.inviteCode ?? "",
                filterFn: (rows: Array<RegistrantDescriptor>, filterValue: string) => {
                    if (filterValue === "") {
                        return rows.filter((row) => (row.invitation?.inviteCode ?? "") === "");
                    } else {
                        return rows.filter(
                            (row) =>
                                !!row.invitation?.inviteCode &&
                                row.invitation?.inviteCode.toLowerCase().includes(filterValue.toLowerCase())
                        );
                    }
                },
                filterEl: TextColumnFilter,
                cell: function InviteCodeCell({ isInCreate, value }: CellProps<Partial<RegistrantDescriptor>>) {
                    const { onCopy, hasCopied } = useClipboard(value ?? "");
                    if (isInCreate) {
                        return undefined;
                    } else {
                        return (
                            <Flex alignItems="center">
                                <Text fontFamily="monospace" px={2}>
                                    {value}
                                </Text>
                                {value ? (
                                    <Button onClick={onCopy} size="xs" ml="auto">
                                        <FAIcon iconStyle="s" icon={hasCopied ? "check-circle" : "clipboard"} />
                                    </Button>
                                ) : undefined}
                            </Flex>
                        );
                    }
                },
            },
            {
                id: "isProgramPerson",
                header: function IsProgramPersonHeader({
                    isInCreate,
                    onClick,
                    sortDir,
                }: ColumnHeaderProps<RegistrantDescriptor>) {
                    if (isInCreate) {
                        return undefined;
                    } else {
                        return (
                            <Button size="xs" onClick={onClick}>
                                Is program person?{sortDir !== null ? ` ${sortDir}` : undefined}
                            </Button>
                        );
                    }
                },
                get: (data) => data.isProgramPerson,
                sort: (x: boolean, y: boolean) => (x && y ? 0 : x ? -1 : y ? 1 : 0),
                filterFn: (rows: Array<RegistrantDescriptor>, filterValue: boolean) => {
                    return rows.filter((row) => row.isProgramPerson === filterValue);
                },
                filterEl: CheckBoxColumnFilter,
                cell: function InviteSentCell({
                    isInCreate,
                    value,
                }: CellProps<Partial<RegistrantDescriptor>, boolean>) {
                    if (isInCreate) {
                        return undefined;
                    } else {
                        return (
                            <Center>
                                <FAIcon iconStyle="s" icon={value ? "check" : "times"} />
                            </Center>
                        );
                    }
                },
            },
            {
                id: "role",
                header: function RoleHeader({ isInCreate, onClick, sortDir }: ColumnHeaderProps<RegistrantDescriptor>) {
                    return isInCreate ? (
                        <FormLabel>Role</FormLabel>
                    ) : (
                        <Button size="xs" onClick={onClick}>
                            Role{sortDir !== null ? ` ${sortDir}` : undefined}
                        </Button>
                    );
                },
                get: (data) => data.conferenceRole,
                set: (record, v: Registrant_RegistrantRole_Enum) => {
                    record.conferenceRole = v;
                },
                filterFn: (rows, v: Registrant_RegistrantRole_Enum) => rows.filter((r) => r.conferenceRole === v),
                filterEl: SelectColumnFilter(Object.values(Registrant_RegistrantRole_Enum)),
                sort: (x: Registrant_RegistrantRole_Enum, y: Registrant_RegistrantRole_Enum) => x.localeCompare(y),
                cell: function RoomModeCell({
                    value,
                    onChange,
                    onBlur,
                    ref,
                }: CellProps<Partial<RegistrantDescriptor>, Registrant_RegistrantRole_Enum | undefined>) {
                    return (
                        <Select
                            value={value ?? ""}
                            onChange={(ev) => onChange?.(ev.target.value as Registrant_RegistrantRole_Enum)}
                            onBlur={onBlur}
                            ref={ref as LegacyRef<HTMLSelectElement>}
                            maxW={400}
                        >
                            {roleOptions.map((option) => {
                                return (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                );
                            })}
                        </Select>
                    );
                },
            },
            {
                id: "groups",
                header: function ContentHeader({ isInCreate }: ColumnHeaderProps<RegistrantDescriptor>) {
                    return isInCreate ? (
                        <FormLabel>Groups</FormLabel>
                    ) : (
                        <Text fontSize="xs" p={1} textAlign="center" textTransform="none" fontWeight="normal">
                            Groups
                        </Text>
                    );
                },
                get: (data) =>
                    data.groupRegistrants?.map(
                        (ga) =>
                            groupOptions.find((group) => group.value === ga.groupId) ?? {
                                label: "<Unknown>",
                                value: ga.groupId,
                            }
                    ) ?? [],
                set: (record, value: { label: string; value: string }[]) => {
                    record.groupRegistrants = value.map((x) => ({
                        registrantId: record.id,
                        groupId: x.value,
                        id: undefined,
                    }));
                },
                filterFn: (
                    rows: Array<RegistrantDescriptor>,
                    filterValue: ReadonlyArray<{ label: string; value: string }>
                ) => {
                    return filterValue.length === 0
                        ? rows
                        : rows.filter((row) => {
                              return row.groupRegistrants.some((x) => filterValue.some((y) => y.value === x.groupId));
                          });
                },
                filterEl: MultiSelectColumnFilter(groupOptions),
                cell: function ContentCell({
                    value,
                    onChange,
                    onBlur,
                }: CellProps<
                    Partial<RegistrantDescriptor>,
                    ReadonlyArray<{ label: string; value: string }> | undefined
                >) {
                    return (
                        <MultiSelect
                            name="groups"
                            options={groupOptions}
                            value={value ?? []}
                            placeholder="Select one or more groups"
                            onChange={(ev) => onChange?.(ev)}
                            onBlur={onBlur}
                            styles={{ container: (base) => ({ ...base, maxWidth: 450 }) }}
                        />
                    );
                },
            },
            {
                id: "subconferences",
                header: function ContentHeader({ isInCreate }: ColumnHeaderProps<RegistrantDescriptor>) {
                    return isInCreate ? (
                        <FormLabel>Subconferences</FormLabel>
                    ) : (
                        <Text fontSize="xs" p={1} textAlign="center" textTransform="none" fontWeight="normal">
                            Subconferences
                        </Text>
                    );
                },
                get: (data) =>
                    data.subconferenceMemberships?.map(
                        (ga) =>
                            subconferenceOptions.find(
                                (subconference) =>
                                    subconference.value.startsWith(ga.subconferenceId) &&
                                    subconference.value.endsWith(ga.role)
                            ) ?? {
                                label: "<Unknown>",
                                value: ga.subconferenceId,
                            }
                    ) ?? [],
                set: (record, value: { label: string; value: string }[]) => {
                    record.subconferenceMemberships = R.uniqBy<
                        {
                            label: string;
                            value: string;
                        },
                        string
                    >(
                        (a) => a.value.split("¬")[0],
                        R.sortWith(
                            [
                                (a, b) => a.value.split("¬")[0].localeCompare(b.value.split("¬")[0]),
                                (a, b) => -a.value.split("¬")[1].localeCompare(b.value.split("¬")[1]),
                            ],
                            value
                        )
                    ).map((x) => ({
                        registrantId: record.id,
                        subconferenceId: x.value.split("¬")[0],
                        id: undefined,
                        role: x.value.split("¬")[1] as Registrant_RegistrantRole_Enum,
                    }));
                },
                filterFn: (
                    rows: Array<RegistrantDescriptor>,
                    filterValue: ReadonlyArray<{ label: string; value: string }>
                ) => {
                    return filterValue.length === 0
                        ? rows
                        : rows.filter((row) => {
                              return row.subconferenceMemberships.some(
                                  (x) =>
                                      filterValue.some((y) => y.value.startsWith(x.subconferenceId)) &&
                                      filterValue.some((y) => y.value.endsWith(x.role))
                              );
                          });
                },
                filterEl: MultiSelectColumnFilter(subconferenceOptions),
                cell: function ContentCell({
                    value,
                    onChange,
                    onBlur,
                }: CellProps<
                    Partial<RegistrantDescriptor>,
                    ReadonlyArray<{ label: string; value: string }> | undefined
                >) {
                    return (
                        <MultiSelect
                            name="subconferences"
                            options={subconferenceOptions}
                            value={value ?? []}
                            placeholder="Select one or more subconferences"
                            onChange={(ev) => onChange?.(ev)}
                            onBlur={onBlur}
                            styles={{ container: (base) => ({ ...base, maxWidth: 450 }) }}
                        />
                    );
                },
            },
        ];
        return result;
    }, [allGroups?.registrant_Group, allRegistrants?.conference_Subconference, inviteStatusFilterOptions, roleOptions]);

    const [{ fetching: insertInvitationEmailJobsLoading }, insertInvitationEmailJobsMutation] =
        useInsertInvitationEmailJobsMutation();
    const [, insertCustomEmailJobMutation] = useManagePeople_InsertCustomEmailJobMutation();
    const [sendCustomEmailRegistrants, setSendCustomEmailRegistrants] = useState<RegistrantDescriptor[]>([]);
    const sendCustomEmailModal = useDisclosure();

    const toast = useToast();

    const insert: Insert<RegistrantDescriptor> = useMemo(
        () => ({
            ongoing: insertRegistrantResponse.fetching,
            generateDefaults: () => {
                const registrantId = uuidv4();
                return {
                    id: registrantId,
                    conferenceId: conference.id,
                    conferenceRole: Registrant_RegistrantRole_Enum.Attendee,
                    groupRegistrants: [],
                    subconferenceMemberships: [],
                };
            },
            makeWhole: (d) => (d.displayName?.length ? (d as RegistrantDescriptor) : undefined),
            start: (record) => {
                if (record.invitation?.invitedEmailAddress) {
                    insertRegistrant(
                        {
                            registrant: {
                                id: record.id,
                                conferenceId: conference.id,
                                displayName: record.displayName,
                                conferenceRole: record.conferenceRole,
                                groupRegistrants: {
                                    data: record.groupRegistrants.map((x) => ({ groupId: x.groupId })),
                                },
                                subconferenceMemberships: {
                                    data: record.subconferenceMemberships.map((x) => ({
                                        subconferenceId: x.subconferenceId,
                                        role: x.role,
                                    })),
                                },
                            },
                            invitation: {
                                registrantId: record.id,
                                invitedEmailAddress: record.invitation?.invitedEmailAddress,
                            },
                        },
                        {
                            fetchOptions: {
                                headers: {
                                    [AuthHeader.Role]: subconferenceId
                                        ? HasuraRoleName.SubconferenceOrganizer
                                        : HasuraRoleName.ConferenceOrganizer,
                                },
                            },
                        }
                    );
                } else {
                    insertRegistrantWithoutInvite(
                        {
                            registrant: {
                                id: record.id,
                                conferenceId: conference.id,
                                displayName: record.displayName,
                                conferenceRole: record.conferenceRole,
                                groupRegistrants: {
                                    data: record.groupRegistrants.map((x) => ({ groupId: x.groupId })),
                                },
                                subconferenceMemberships: {
                                    data: record.subconferenceMemberships.map((x) => ({
                                        subconferenceId: x.subconferenceId,
                                        role: x.role,
                                    })),
                                },
                            },
                        },
                        {
                            fetchOptions: {
                                headers: {
                                    [AuthHeader.Role]: subconferenceId
                                        ? HasuraRoleName.SubconferenceOrganizer
                                        : HasuraRoleName.ConferenceOrganizer,
                                },
                            },
                        }
                    );
                }
            },
        }),
        [
            conference.id,
            insertRegistrant,
            insertRegistrantResponse.fetching,
            insertRegistrantWithoutInvite,
            subconferenceId,
        ]
    );

    const update: Update<RegistrantDescriptor> = useMemo(
        () => ({
            ongoing: updateRegistrantResponse.fetching,
            start: (record) => {
                updateRegistrant(
                    {
                        registrantId: record.id,
                        registrantUpdates: {
                            displayName: record.displayName,
                            conferenceRole: record.conferenceRole,
                        },
                        upsertGroups: record.groupRegistrants.map((x) => ({
                            groupId: x.groupId,
                            registrantId: x.registrantId,
                        })),
                        remainingGroupIds: record.groupRegistrants.map((x) => x.groupId),
                        upsertSubconferences: record.subconferenceMemberships.map((x) => ({
                            subconferenceId: x.subconferenceId,
                            registrantId: x.registrantId,
                            role: x.role,
                        })),
                        remainingSubconferenceIds: record.subconferenceMemberships.map((x) => x.subconferenceId),
                    },
                    {
                        fetchOptions: {
                            headers: {
                                [AuthHeader.Role]: subconferenceId
                                    ? HasuraRoleName.SubconferenceOrganizer
                                    : HasuraRoleName.ConferenceOrganizer,
                            },
                        },
                    }
                );
            },
        }),
        [subconferenceId, updateRegistrant, updateRegistrantResponse.fetching]
    );

    const deleteP: Delete<RegistrantDescriptor> = useMemo(
        () => ({
            ongoing: deleteRegistrantsResponse.fetching,
            start: (keys) => {
                deleteRegistrants(
                    {
                        deleteRegistrantIds: keys,
                    },
                    {
                        fetchOptions: {
                            headers: {
                                [AuthHeader.Role]: subconferenceId
                                    ? HasuraRoleName.SubconferenceOrganizer
                                    : HasuraRoleName.ConferenceOrganizer,
                            },
                        },
                    }
                );
            },
        }),
        [deleteRegistrants, deleteRegistrantsResponse.fetching, subconferenceId]
    );

    const [exportWithProfileData, setExportWithProfileData] = useState<boolean>(false);
    const client = useClient();
    const buttons: ExtraButton<RegistrantDescriptor>[] = useMemo(
        () => [
            {
                render: function ImportButton(_selectedData) {
                    return (
                        <LinkButton colorScheme="purple" to={`${conferencePath}/manage/import/registrants`}>
                            Import
                        </LinkButton>
                    );
                },
            },
            {
                render: ({ selectedData }: { selectedData: RegistrantDescriptor[] }) => {
                    async function doExport(dataToExport: RegistrantDescriptor[]) {
                        const profiles = exportWithProfileData
                            ? (
                                  await client
                                      .query<
                                          ManageRegistrants_SelectProfilesQuery,
                                          ManageRegistrants_SelectProfilesQueryVariables
                                      >(
                                          ManageRegistrants_SelectProfilesDocument,
                                          {
                                              registrantIds: dataToExport.map((x) => x.id),
                                          },
                                          {
                                              fetchOptions: {
                                                  headers: {
                                                      [AuthHeader.Role]: subconferenceId
                                                          ? HasuraRoleName.SubconferenceOrganizer
                                                          : HasuraRoleName.ConferenceOrganizer,
                                                  },
                                              },
                                          }
                                      )
                                      .toPromise()
                              ).data?.registrant_Profile ?? []
                            : [];

                        const csvText = Papa.unparse(
                            dataToExport.map((registrant) => {
                                const result: any = {
                                    "Conference Id": registrant.conferenceId,
                                    "Registrant Id": registrant.id,
                                    "User Id": registrant.userId,
                                    Name: registrant.displayName,
                                    Email: registrant.invitation?.invitedEmailAddress ?? "",
                                    "Invite code": registrant.invitation?.inviteCode ?? "",
                                    "Invitation status": JSON.stringify(registrant.invitationStatus),
                                    "Invite accepted": registrant.userId ? "Yes" : "No",
                                    "Group Ids": registrant.groupRegistrants.map((x) => x.groupId),
                                    "Group Names": registrant.groupRegistrants.map(
                                        (x) =>
                                            allGroups?.registrant_Group.find((g) => g.id === x.groupId)?.name ??
                                            "<Hidden>"
                                    ),
                                    "Subconference Ids": registrant.subconferenceMemberships.map(
                                        (x) => x.subconferenceId
                                    ),
                                    "Subconference Names": registrant.subconferenceMemberships.map(
                                        (x) =>
                                            allRegistrants?.conference_Subconference.find(
                                                (g) => g.id === x.subconferenceId
                                            )?.name ?? "<Hidden>"
                                    ),
                                    "Subconference Roles": registrant.subconferenceMemberships.map((x) => x.role),
                                    "Created At": registrant.createdAt,
                                    "Updated At": registrant.updatedAt,
                                };

                                if (exportWithProfileData) {
                                    const profile = profiles.find((x) => x.registrantId === registrant.id);
                                    result["Profile Data Exportable"] = profile ? "Yes" : "No";
                                    result["Has Been Edited"] = profile ? (profile.hasBeenEdited ? "Yes" : "No") : "";
                                    result.Badges =
                                        profile?.badges?.map((badge: BadgeData) => `${badge.name} [${badge.colour}]`) ??
                                        "";
                                    result.Affiliation = profile?.affiliation ?? "";
                                    result.Country = profile?.country ?? "";
                                    result["Timezone UTC Offset"] = profile?.timezoneUTCOffset ?? "";
                                    result["Bio (Markdown)"] = profile?.bio ?? "";
                                    result.Website = profile?.website ?? "";
                                    result.GitHub = profile?.github ?? "";
                                    result.Twitter = profile?.twitter ?? "";
                                    result["Affiliation URL"] = profile?.affiliationURL ?? "";
                                    result.Pronouns = profile?.pronouns ?? "";
                                    result["Photo URL - 50px by 50px"] = profile?.photoURL_50x50 ?? "";
                                    result["Photo URL - 350px by 350px"] = profile?.photoURL_350x350 ?? "";
                                }

                                return result;
                            }),
                            {
                                columns: [
                                    "Conference Id",
                                    "Registrant Id",
                                    "User Id",
                                    "Name",
                                    "Email",
                                    "Invite code",
                                    "Invite sent",
                                    "Invite accepted",
                                    "Group Ids",
                                    "Group Names",
                                    "Subconference Ids",
                                    "Subconference Names",
                                    "Subconference Roles",
                                    "Created At",
                                    "Updated At",
                                    "Profile Data Exportable",
                                    "Has Been Edited",
                                    "Badges",
                                    "Affiliation",
                                    "Country",
                                    "Timezone UTC Offset",
                                    "Bio (Markdown)",
                                    "Website",
                                    "GitHub",
                                    "Twitter",
                                    "Affiliation URL",
                                    "Pronouns",
                                    "Photo URL - 50px by 50px",
                                    "Photo URL - 350px by 350px",
                                ],
                            }
                        );

                        const csvData = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
                        let csvURL: string | null = null;
                        const now = new Date();
                        const fileName = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now
                            .getDate()
                            .toString()
                            .padStart(2, "0")}T${now.getHours().toString().padStart(2, "0")}-${now
                            .getMinutes()
                            .toString()
                            .padStart(2, "0")} - Midspace Registrants.csv`;

                        csvURL = window.URL.createObjectURL(csvData);

                        const tempLink = document.createElement("a");
                        tempLink.href = csvURL ?? "";
                        tempLink.setAttribute("download", fileName);
                        tempLink.click();
                    }

                    const tooltip = (filler: string) =>
                        `Exports the name, email, groups and subconferences of ${filler}.`;
                    if (selectedData.length === 0) {
                        return (
                            <Menu>
                                <Tooltip label={tooltip("all registrants (from a chosen group or subconference)")}>
                                    <MenuButton as={Button} colorScheme="purple" rightIcon={<ChevronDownIcon />}>
                                        Export
                                    </MenuButton>
                                </Tooltip>
                                <MenuList>
                                    <MenuItemOption
                                        closeOnSelect={false}
                                        isChecked={exportWithProfileData}
                                        onClick={() => {
                                            setExportWithProfileData(!exportWithProfileData);
                                        }}
                                    >
                                        With profile data?
                                    </MenuItemOption>
                                    <MenuItem
                                        onClick={() => {
                                            doExport(data);
                                        }}
                                    >
                                        All registrants
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => {
                                            doExport(data.filter((a) => !!a.isProgramPerson));
                                        }}
                                    >
                                        Only program people
                                    </MenuItem>
                                    {allGroups?.registrant_Group.length ? (
                                        <MenuGroup title="Groups">
                                            {allGroups.registrant_Group.map((group) => (
                                                <MenuItem
                                                    key={group.id}
                                                    onClick={() => {
                                                        doExport(
                                                            data.filter((a) =>
                                                                a.groupRegistrants.some((ga) => ga.groupId === group.id)
                                                            )
                                                        );
                                                    }}
                                                >
                                                    {group.name}
                                                </MenuItem>
                                            ))}
                                        </MenuGroup>
                                    ) : undefined}
                                    {allRegistrants?.conference_Subconference.length ? (
                                        <MenuGroup title="Subconferences">
                                            {allRegistrants.conference_Subconference.map((subconference) => (
                                                <MenuItem
                                                    key={subconference.id}
                                                    onClick={() => {
                                                        doExport(
                                                            data.filter((a) =>
                                                                a.subconferenceMemberships.some(
                                                                    (ga) => ga.subconferenceId === subconference.id
                                                                )
                                                            )
                                                        );
                                                    }}
                                                >
                                                    {subconference.shortName}
                                                </MenuItem>
                                            ))}
                                        </MenuGroup>
                                    ) : undefined}
                                </MenuList>
                            </Menu>
                        );
                    } else {
                        return (
                            <Tooltip label={tooltip("selected registrants")}>
                                <Box>
                                    <Button
                                        colorScheme="purple"
                                        isDisabled={selectedData.length === 0}
                                        onClick={() => doExport(selectedData)}
                                    >
                                        Export
                                    </Button>
                                </Box>
                            </Tooltip>
                        );
                    }
                },
            },
            {
                render: function SendInitialInvitesButton({ selectedData }: { selectedData: RegistrantDescriptor[] }) {
                    const tooltip = (filler: string) =>
                        `Sends invitations to ${filler} who have not already been sent an invite.`;
                    if (selectedData.length === 0) {
                        return (
                            <Menu>
                                <Tooltip label={tooltip("all registrants (from a group or subconference)")}>
                                    <MenuButton as={Button} colorScheme="purple" rightIcon={<ChevronDownIcon />}>
                                        Send initial invitations
                                    </MenuButton>
                                </Tooltip>
                                <MenuList>
                                    <MenuItem
                                        onClick={async () => {
                                            const registrantIds = data.map((a) => a.id);
                                            if (
                                                confirm(
                                                    `Are you sure? This will send up to ${registrantIds.length} invitations`
                                                )
                                            ) {
                                                const result = await insertInvitationEmailJobsMutation(
                                                    {
                                                        registrantIds,
                                                        conferenceId: conference.id,
                                                        sendRepeat: false,
                                                    },
                                                    {
                                                        fetchOptions: {
                                                            headers: {
                                                                [AuthHeader.Role]: subconferenceId
                                                                    ? HasuraRoleName.SubconferenceOrganizer
                                                                    : HasuraRoleName.ConferenceOrganizer,
                                                            },
                                                        },
                                                    }
                                                );
                                                if (result.error) {
                                                    toast({
                                                        title: "Failed to send invitation emails",
                                                        description: result.error.message,
                                                        isClosable: true,
                                                        status: "error",
                                                    });
                                                } else {
                                                    toast({
                                                        title: "Invitation emails sent",
                                                        duration: 8000,
                                                        status: "success",
                                                    });
                                                }

                                                refetchAllRegistrants();
                                            }
                                        }}
                                    >
                                        All registrants
                                    </MenuItem>
                                    <MenuItem
                                        onClick={async () => {
                                            const registrantIds = data
                                                .filter((a) => a.isProgramPerson)
                                                .map((a) => a.id);
                                            if (
                                                confirm(
                                                    `Are you sure? This will send up to ${registrantIds.length} invitations`
                                                )
                                            ) {
                                                const result = await insertInvitationEmailJobsMutation(
                                                    {
                                                        registrantIds,
                                                        conferenceId: conference.id,
                                                        sendRepeat: false,
                                                    },
                                                    {
                                                        fetchOptions: {
                                                            headers: {
                                                                [AuthHeader.Role]: subconferenceId
                                                                    ? HasuraRoleName.SubconferenceOrganizer
                                                                    : HasuraRoleName.ConferenceOrganizer,
                                                            },
                                                        },
                                                    }
                                                );
                                                if (result.error) {
                                                    toast({
                                                        title: "Failed to send invitation emails",
                                                        description: result.error.message,
                                                        isClosable: true,
                                                        status: "error",
                                                    });
                                                } else {
                                                    toast({
                                                        title: "Invitation emails sent",
                                                        duration: 8000,
                                                        status: "success",
                                                    });
                                                }

                                                refetchAllRegistrants();
                                            }
                                        }}
                                    >
                                        Only program people
                                    </MenuItem>
                                    {allGroups?.registrant_Group.length ? (
                                        <MenuGroup title="Groups">
                                            {allGroups?.registrant_Group.map((group) => (
                                                <MenuItem
                                                    key={group.id}
                                                    onClick={async () => {
                                                        const registrantIds = data
                                                            .filter((a) =>
                                                                a.groupRegistrants.some((ga) => ga.groupId === group.id)
                                                            )
                                                            .map((a) => a.id);
                                                        if (
                                                            confirm(
                                                                `Are you sure? This will send up to ${registrantIds.length} invitations`
                                                            )
                                                        ) {
                                                            const result = await insertInvitationEmailJobsMutation(
                                                                {
                                                                    registrantIds,
                                                                    conferenceId: conference.id,
                                                                    sendRepeat: false,
                                                                },
                                                                {
                                                                    fetchOptions: {
                                                                        headers: {
                                                                            [AuthHeader.Role]: subconferenceId
                                                                                ? HasuraRoleName.SubconferenceOrganizer
                                                                                : HasuraRoleName.ConferenceOrganizer,
                                                                        },
                                                                    },
                                                                }
                                                            );
                                                            if (result.error) {
                                                                toast({
                                                                    title: "Failed to send invitation emails",
                                                                    description: result.error.message,
                                                                    isClosable: true,
                                                                    status: "error",
                                                                });
                                                            } else {
                                                                toast({
                                                                    title: "Invitation emails sent",
                                                                    duration: 8000,
                                                                    status: "success",
                                                                });
                                                            }

                                                            refetchAllRegistrants();
                                                        }
                                                    }}
                                                >
                                                    {group.name}
                                                </MenuItem>
                                            ))}
                                        </MenuGroup>
                                    ) : undefined}
                                    {allRegistrants?.conference_Subconference.length ? (
                                        <MenuGroup title="Subconferences">
                                            {allRegistrants.conference_Subconference.map((subconference) => (
                                                <MenuItem
                                                    key={subconference.id}
                                                    onClick={async () => {
                                                        const registrantIds = data
                                                            .filter((a) =>
                                                                a.subconferenceMemberships.some(
                                                                    (ga) => ga.subconferenceId === subconference.id
                                                                )
                                                            )
                                                            .map((a) => a.id);
                                                        if (
                                                            confirm(
                                                                `Are you sure? This will send up to ${registrantIds.length} invitations`
                                                            )
                                                        ) {
                                                            const result = await insertInvitationEmailJobsMutation(
                                                                {
                                                                    registrantIds,
                                                                    conferenceId: conference.id,
                                                                    sendRepeat: false,
                                                                },
                                                                {
                                                                    fetchOptions: {
                                                                        headers: {
                                                                            [AuthHeader.Role]: subconferenceId
                                                                                ? HasuraRoleName.SubconferenceOrganizer
                                                                                : HasuraRoleName.ConferenceOrganizer,
                                                                        },
                                                                    },
                                                                }
                                                            );
                                                            if (result.error) {
                                                                toast({
                                                                    title: "Failed to send invitation emails",
                                                                    description: result.error.message,
                                                                    isClosable: true,
                                                                    status: "error",
                                                                });
                                                            } else {
                                                                toast({
                                                                    title: "Invitation emails sent",
                                                                    duration: 8000,
                                                                    status: "success",
                                                                });
                                                            }

                                                            refetchAllRegistrants();
                                                        }
                                                    }}
                                                >
                                                    {subconference.shortName}
                                                </MenuItem>
                                            ))}
                                        </MenuGroup>
                                    ) : undefined}
                                </MenuList>
                            </Menu>
                        );
                    } else {
                        return (
                            <Tooltip label={tooltip("selected registrants")}>
                                <Box>
                                    <Button
                                        colorScheme="purple"
                                        isDisabled={selectedData.length === 0}
                                        isLoading={insertInvitationEmailJobsLoading}
                                        onClick={async () => {
                                            const registrantIds = selectedData.map((x) => x.id);
                                            if (
                                                confirm(
                                                    `Are you sure? This will send up to ${registrantIds.length} invitations`
                                                )
                                            ) {
                                                const result = await insertInvitationEmailJobsMutation(
                                                    {
                                                        registrantIds,
                                                        conferenceId: conference.id,
                                                        sendRepeat: false,
                                                    },
                                                    {
                                                        fetchOptions: {
                                                            headers: {
                                                                [AuthHeader.Role]: subconferenceId
                                                                    ? HasuraRoleName.SubconferenceOrganizer
                                                                    : HasuraRoleName.ConferenceOrganizer,
                                                            },
                                                        },
                                                    }
                                                );
                                                if (result.error) {
                                                    toast({
                                                        title: "Failed to send invitation emails",
                                                        description: result.error.message,
                                                        isClosable: true,
                                                        status: "error",
                                                    });
                                                } else {
                                                    toast({
                                                        title: "Invitation emails sent",
                                                        duration: 8000,
                                                        status: "success",
                                                    });
                                                }

                                                refetchAllRegistrants();
                                            }
                                        }}
                                    >
                                        Send initial invitations
                                    </Button>
                                </Box>
                            </Tooltip>
                        );
                    }
                },
            },
            {
                render: function SendRepeatInvitesButton({ selectedData }: { selectedData: RegistrantDescriptor[] }) {
                    const tooltip = (filler: string) => `Sends repeat invitations to ${filler}.`;
                    if (selectedData.length === 0) {
                        return (
                            <Menu>
                                <Tooltip label={tooltip("all registrants (from a group or subconference)")}>
                                    <MenuButton as={Button} colorScheme="purple" rightIcon={<ChevronDownIcon />}>
                                        Send repeat invitations
                                    </MenuButton>
                                </Tooltip>
                                <MenuList>
                                    <MenuItem
                                        onClick={async () => {
                                            const registrantIds = data.map((a) => a.id);
                                            if (
                                                confirm(
                                                    `Are you sure? This will send up to ${registrantIds.length} repeat invitations`
                                                )
                                            ) {
                                                const result = await insertInvitationEmailJobsMutation(
                                                    {
                                                        registrantIds,
                                                        conferenceId: conference.id,
                                                        sendRepeat: true,
                                                    },
                                                    {
                                                        fetchOptions: {
                                                            headers: {
                                                                [AuthHeader.Role]: subconferenceId
                                                                    ? HasuraRoleName.SubconferenceOrganizer
                                                                    : HasuraRoleName.ConferenceOrganizer,
                                                            },
                                                        },
                                                    }
                                                );
                                                if (result.error) {
                                                    toast({
                                                        title: "Failed to send invitation emails",
                                                        description: result.error.message,
                                                        isClosable: true,
                                                        status: "error",
                                                    });
                                                } else {
                                                    toast({
                                                        title: "Invitation emails sent",
                                                        duration: 8000,
                                                        status: "success",
                                                    });
                                                }

                                                refetchAllRegistrants();
                                            }
                                        }}
                                    >
                                        All registrants
                                    </MenuItem>
                                    <MenuItem
                                        onClick={async () => {
                                            const registrantIds = data
                                                .filter((a) => a.isProgramPerson)
                                                .map((a) => a.id);
                                            if (
                                                confirm(
                                                    `Are you sure? This will send up to ${registrantIds.length} repeat invitations`
                                                )
                                            ) {
                                                const result = await insertInvitationEmailJobsMutation(
                                                    {
                                                        registrantIds,
                                                        conferenceId: conference.id,
                                                        sendRepeat: true,
                                                    },
                                                    {
                                                        fetchOptions: {
                                                            headers: {
                                                                [AuthHeader.Role]: subconferenceId
                                                                    ? HasuraRoleName.SubconferenceOrganizer
                                                                    : HasuraRoleName.ConferenceOrganizer,
                                                            },
                                                        },
                                                    }
                                                );
                                                if (result.error) {
                                                    toast({
                                                        title: "Failed to send invitation emails",
                                                        description: result.error.message,
                                                        isClosable: true,
                                                        status: "error",
                                                    });
                                                } else {
                                                    toast({
                                                        title: "Invitation emails sent",
                                                        duration: 8000,
                                                        status: "success",
                                                    });
                                                }

                                                refetchAllRegistrants();
                                            }
                                        }}
                                    >
                                        Only program people
                                    </MenuItem>
                                    {allGroups?.registrant_Group.length ? (
                                        <MenuGroup title="Groups">
                                            {allGroups.registrant_Group.map((group) => (
                                                <MenuItem
                                                    key={group.id}
                                                    onClick={async () => {
                                                        const registrantIds = data
                                                            .filter((a) =>
                                                                a.groupRegistrants.some((ga) => ga.groupId === group.id)
                                                            )
                                                            .map((a) => a.id);
                                                        if (
                                                            confirm(
                                                                `Are you sure? This will send up to ${registrantIds.length} repeat invitations`
                                                            )
                                                        ) {
                                                            const result = await insertInvitationEmailJobsMutation(
                                                                {
                                                                    registrantIds,
                                                                    conferenceId: conference.id,
                                                                    sendRepeat: true,
                                                                },
                                                                {
                                                                    fetchOptions: {
                                                                        headers: {
                                                                            [AuthHeader.Role]: subconferenceId
                                                                                ? HasuraRoleName.SubconferenceOrganizer
                                                                                : HasuraRoleName.ConferenceOrganizer,
                                                                        },
                                                                    },
                                                                }
                                                            );
                                                            if (result.error) {
                                                                toast({
                                                                    title: "Failed to send invitation emails",
                                                                    description: result.error.message,
                                                                    isClosable: true,
                                                                    status: "error",
                                                                });
                                                            } else {
                                                                toast({
                                                                    title: "Invitation emails sent",
                                                                    duration: 8000,
                                                                    status: "success",
                                                                });
                                                            }

                                                            refetchAllRegistrants();
                                                        }
                                                    }}
                                                >
                                                    {group.name}
                                                </MenuItem>
                                            ))}
                                        </MenuGroup>
                                    ) : undefined}
                                    {allRegistrants?.conference_Subconference.length ? (
                                        <MenuGroup title="Subconferences">
                                            {allRegistrants.conference_Subconference.map((subconference) => (
                                                <MenuItem
                                                    key={subconference.id}
                                                    onClick={async () => {
                                                        const registrantIds = data
                                                            .filter((a) =>
                                                                a.subconferenceMemberships.some(
                                                                    (ga) => ga.subconferenceId === subconference.id
                                                                )
                                                            )
                                                            .map((a) => a.id);
                                                        if (
                                                            confirm(
                                                                `Are you sure? This will send up to ${registrantIds.length} repeat invitations`
                                                            )
                                                        ) {
                                                            const result = await insertInvitationEmailJobsMutation(
                                                                {
                                                                    registrantIds,
                                                                    conferenceId: conference.id,
                                                                    sendRepeat: true,
                                                                },
                                                                {
                                                                    fetchOptions: {
                                                                        headers: {
                                                                            [AuthHeader.Role]: subconferenceId
                                                                                ? HasuraRoleName.SubconferenceOrganizer
                                                                                : HasuraRoleName.ConferenceOrganizer,
                                                                        },
                                                                    },
                                                                }
                                                            );
                                                            if (result.error) {
                                                                toast({
                                                                    title: "Failed to send invitation emails",
                                                                    description: result.error.message,
                                                                    isClosable: true,
                                                                    status: "error",
                                                                });
                                                            } else {
                                                                toast({
                                                                    title: "Invitation emails sent",
                                                                    duration: 8000,
                                                                    status: "success",
                                                                });
                                                            }

                                                            refetchAllRegistrants();
                                                        }
                                                    }}
                                                >
                                                    {subconference.shortName}
                                                </MenuItem>
                                            ))}
                                        </MenuGroup>
                                    ) : undefined}
                                </MenuList>
                            </Menu>
                        );
                    } else {
                        return (
                            <Tooltip label={tooltip("selected registrants")}>
                                <Box>
                                    <Button
                                        colorScheme="purple"
                                        isDisabled={selectedData.length === 0}
                                        isLoading={insertInvitationEmailJobsLoading}
                                        onClick={async () => {
                                            const registrantIds = selectedData.map((x) => x.id);
                                            if (
                                                confirm(
                                                    `Are you sure? This will send up to ${registrantIds.length} repeat invitations`
                                                )
                                            ) {
                                                const result = await insertInvitationEmailJobsMutation(
                                                    {
                                                        registrantIds,
                                                        conferenceId: conference.id,
                                                        sendRepeat: true,
                                                    },
                                                    {
                                                        fetchOptions: {
                                                            headers: {
                                                                [AuthHeader.Role]: subconferenceId
                                                                    ? HasuraRoleName.SubconferenceOrganizer
                                                                    : HasuraRoleName.ConferenceOrganizer,
                                                            },
                                                        },
                                                    }
                                                );
                                                if (result.error) {
                                                    toast({
                                                        title: "Failed to send invitation emails",
                                                        description: result.error.message,
                                                        isClosable: true,
                                                        status: "error",
                                                    });
                                                } else {
                                                    toast({
                                                        title: "Invitation emails sent",
                                                        duration: 8000,
                                                        status: "success",
                                                    });
                                                }

                                                refetchAllRegistrants();
                                            }
                                        }}
                                    >
                                        Send repeat invitations
                                    </Button>
                                </Box>
                            </Tooltip>
                        );
                    }
                },
            },
            {
                render: function SendCustomEmailButton({ selectedData }: { selectedData: RegistrantDescriptor[] }) {
                    const tooltip = (filler: string) => `Sends a custom email to ${filler}.`;
                    if (selectedData.length === 0) {
                        return (
                            <Menu>
                                {/*<Tooltip label={tooltip("all registrants (from a group or subconference)")}>*/}
                                <MenuButton as={Button} colorScheme="purple" rightIcon={<ChevronDownIcon />}>
                                    Send custom email
                                </MenuButton>
                                {/*</Tooltip>*/}
                                <MenuList>
                                    <MenuItem
                                        onClick={() => {
                                            setSendCustomEmailRegistrants(data);
                                            sendCustomEmailModal.onOpen();
                                        }}
                                    >
                                        All registrants
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => {
                                            setSendCustomEmailRegistrants(data.filter((x) => x.isProgramPerson));
                                            sendCustomEmailModal.onOpen();
                                        }}
                                    >
                                        Only program people
                                    </MenuItem>
                                    {allGroups?.registrant_Group.length ? (
                                        <MenuGroup title="Groups">
                                            {allGroups.registrant_Group.map((group) => (
                                                <MenuItem
                                                    key={group.id}
                                                    onClick={() => {
                                                        setSendCustomEmailRegistrants(
                                                            data.filter((a) =>
                                                                a.groupRegistrants.some((ga) => ga.groupId === group.id)
                                                            )
                                                        );
                                                        sendCustomEmailModal.onOpen();
                                                    }}
                                                >
                                                    {group.name}
                                                </MenuItem>
                                            ))}
                                        </MenuGroup>
                                    ) : undefined}
                                    {allRegistrants?.conference_Subconference.length ? (
                                        <MenuGroup title="Subconferences">
                                            {allRegistrants.conference_Subconference.map((subconference) => (
                                                <MenuItem
                                                    key={subconference.id}
                                                    onClick={() => {
                                                        setSendCustomEmailRegistrants(
                                                            data.filter((a) =>
                                                                a.subconferenceMemberships.some(
                                                                    (ga) => ga.subconferenceId === subconference.id
                                                                )
                                                            )
                                                        );
                                                        sendCustomEmailModal.onOpen();
                                                    }}
                                                >
                                                    {subconference.shortName}
                                                </MenuItem>
                                            ))}
                                        </MenuGroup>
                                    ) : undefined}
                                </MenuList>
                            </Menu>
                        );
                    } else {
                        return (
                            <Tooltip label={tooltip("selected registrants")}>
                                <Box>
                                    <Button
                                        colorScheme="purple"
                                        isDisabled={selectedData.length === 0}
                                        onClick={async () => {
                                            setSendCustomEmailRegistrants(selectedData);
                                            sendCustomEmailModal.onOpen();
                                        }}
                                    >
                                        Send custom email
                                    </Button>
                                </Box>
                            </Tooltip>
                        );
                    }
                },
            },
        ],
        [
            conferencePath,
            exportWithProfileData,
            client,
            subconferenceId,
            allGroups?.registrant_Group,
            allRegistrants?.conference_Subconference,
            data,
            insertInvitationEmailJobsMutation,
            conference.id,
            refetchAllRegistrants,
            toast,
            insertInvitationEmailJobsLoading,
            sendCustomEmailModal,
        ]
    );

    return (
        <DashboardPage title="Registrants">
            <Box>
                {(loadingAllGroups && !allGroups) ||
                (loadingAllRegistrants && !allRegistrants?.registrant_Registrant) ? (
                    <></>
                ) : errorAllRegistrants || errorAllGroups ? (
                    <>An error occurred loading in data - please see further information in notifications.</>
                ) : (
                    <></>
                )}
                <CRUDTable<RegistrantDescriptor>
                    columns={columns}
                    row={row}
                    data={
                        !loadingAllGroups &&
                        !loadingAllRegistrants &&
                        (allGroups?.registrant_Group && allRegistrants?.registrant_Registrant ? data : null)
                    }
                    tableUniqueName="ManageConferenceRegistrants"
                    alert={
                        insertRegistrantResponse.error ||
                        insertRegistrantWithoutInviteResponse.error ||
                        updateRegistrantResponse.error ||
                        deleteRegistrantsResponse.error
                            ? {
                                  status: "error",
                                  title: "Error saving changes",
                                  description:
                                      extractActualError(
                                          insertRegistrantResponse.error ??
                                              insertRegistrantWithoutInviteResponse.error ??
                                              updateRegistrantResponse.error ??
                                              deleteRegistrantsResponse.error
                                      ) ?? "Unknown error",
                              }
                            : undefined
                    }
                    insert={insert}
                    update={update}
                    delete={deleteP}
                    buttons={buttons}
                />
                <SendEmailModal
                    isOpen={sendCustomEmailModal.isOpen}
                    onClose={sendCustomEmailModal.onClose}
                    registrants={sendCustomEmailRegistrants}
                    send={async (registrantIds: string[], markdownBody: string, subject: string) => {
                        const result = await insertCustomEmailJobMutation(
                            {
                                registrantIds,
                                conferenceId: conference.id,
                                markdownBody,
                                subject,
                            },
                            {
                                fetchOptions: {
                                    headers: {
                                        [AuthHeader.Role]: subconferenceId
                                            ? HasuraRoleName.SubconferenceOrganizer
                                            : HasuraRoleName.ConferenceOrganizer,
                                    },
                                },
                            }
                        );
                        if (result?.error) {
                            console.error("Failed to insert CustomEmailJob", result.error);
                            throw new Error("Error submitting query");
                        }
                    }}
                />
            </Box>
        </DashboardPage>
    );
}
