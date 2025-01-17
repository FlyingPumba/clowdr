import { ChevronDownIcon } from "@chakra-ui/icons";
import {
    Box,
    Button,
    FormLabel,
    HStack,
    Input,
    Menu,
    MenuButton,
    MenuGroup,
    MenuItem,
    MenuList,
    Select,
    Text,
    Tooltip,
    useDisclosure,
} from "@chakra-ui/react";
import { AuthHeader, HasuraRoleName } from "@midspace/shared-types/auth";
import { gql } from "@urql/core";
import Papa from "papaparse";
import * as R from "ramda";
import type { LegacyRef } from "react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useClient } from "urql";
import { v4 as uuidv4 } from "uuid";
import type {
    Content_Item_Set_Input,
    ManageContent_ExhibitionFragment,
    ManageContent_ItemFragment,
    ManageContent_SelectItemsForExportQuery,
    ManageContent_SelectItemsForExportQueryVariables,
    ManageContent_TagFragment,
} from "../../../../generated/graphql";
import {
    Content_ItemType_Enum,
    ManageContent_SelectItemsForExportDocument,
    useManageContent_DeleteItemsMutation,
    useManageContent_InsertItemMutation,
    useManageContent_SelectAllExhibitionsQuery,
    useManageContent_SelectAllItemsQuery,
    useManageContent_SelectAllTagsQuery,
    useManageContent_UpdateItemMutation,
} from "../../../../generated/graphql";
import { LinkButton } from "../../../Chakra/LinkButton";
import MultiSelect from "../../../Chakra/MultiSelect";
import { MultiSelectColumnFilter, TextColumnFilter } from "../../../CRUDTable2/CRUDComponents";
import type {
    CellProps,
    ColumnHeaderProps,
    ColumnSpecification,
    ExtraButton,
    RowSpecification,
} from "../../../CRUDTable2/CRUDTable2";
import CRUDTable, { SortDirection } from "../../../CRUDTable2/CRUDTable2";
import { useAuthParameters } from "../../../GQL/AuthParameters";
import extractActualError from "../../../GQL/ExtractActualError";
import { makeContext } from "../../../GQL/make-context";
import useQueryErrorToast from "../../../GQL/useQueryErrorToast";
import { maybeCompare } from "../../../Utils/maybeCompare";
import { useConference } from "../../useConference";
import { DashboardPage } from "../DashboardPage";
import { BulkOperationMenu } from "./v2/BulkOperations/BulkOperationMenu";
import ManageExhibitionsModal from "./v2/Exhibition/ManageExhibitionsModal";
import { SecondaryEditor } from "./v2/Item/SecondaryEditor";
import ManageTagsModal from "./v2/ManageTagsModal";
import { SendSubmissionRequestsModal } from "./v2/Submissions/SubmissionRequestsModal";
import { SubmissionsReviewModal } from "./v2/Submissions/SubmissionsReviewModal";

gql`
    ## Items

    fragment ManageContent_ItemTag on content_ItemTag {
        id
        itemId
        tagId
    }

    fragment ManageContent_ItemExhibition on content_ItemExhibition {
        id
        itemId
        item {
            id
            title
        }
        exhibitionId
        priority
        layout
    }

    fragment ManageContent_ItemScalars on content_Item {
        id
        conferenceId
        subconferenceId
        title
        shortTitle
        typeName
    }

    fragment ManageContent_Item on content_Item {
        ...ManageContent_ItemScalars
        itemTags {
            ...ManageContent_ItemTag
        }
    }

    fragment ManageContent_Room on room_Room {
        id
        name
        conferenceId
        subconferenceId
    }

    fragment ManageContent_Element on content_Element {
        id
        itemId
        name
        typeName
        data
        layoutData
        uploadsRemaining
        isHidden
        updatedAt
        conferenceId
        subconferenceId
    }

    fragment ManageContent_ProgramPerson on collection_ProgramPerson {
        id
        name
        affiliation
        email
        registrantId
        conferenceId
        subconferenceId
    }

    fragment ManageContent_ItemProgramPerson on content_ItemProgramPerson {
        id
        itemId
        priority
        roleName
        personId
        person {
            ...ManageContent_ProgramPerson
        }
    }

    fragment ManageContent_ItemSecondary on content_Item {
        typeName
        room {
            ...ManageContent_Room
        }
        chatId
    }

    fragment ManageContent_ItemForExport on content_Item {
        id
        conferenceId
        subconferenceId
        title
        shortTitle
        typeName
        itemTags {
            id
            tagId
            itemId
        }
        itemExhibitions {
            id
            itemId
            exhibitionId
            priority
        }
        room {
            id
            conferenceId
        }
        chatId
        itemPeople {
            ...ManageContent_ItemProgramPerson
        }
        elements {
            ...ManageContent_Element
        }
    }

    query ManageContent_SelectAllItems($conferenceId: uuid!, $subconferenceCond: uuid_comparison_exp!) {
        content_Item(where: { conferenceId: { _eq: $conferenceId }, subconferenceId: $subconferenceCond }) {
            ...ManageContent_Item
        }
    }

    query ManageContent_SelectItemsForExport($itemIds: [uuid!]!) {
        content_Item(where: { id: { _in: $itemIds } }) {
            ...ManageContent_ItemForExport
        }
    }

    query ManageContent_SelectItem($itemId: uuid!) {
        content_Item_by_pk(id: $itemId) {
            ...ManageContent_ItemSecondary
        }
        content_Element(where: { itemId: { _eq: $itemId } }) {
            ...ManageContent_Element
        }
    }

    query ManageContent_SelectItemPeople($itemId: uuid!) {
        content_ItemProgramPerson(where: { itemId: { _eq: $itemId } }) {
            ...ManageContent_ItemProgramPerson
        }
    }

    mutation ManageContent_InsertItem($item: content_Item_insert_input!, $itemTags: [content_ItemTag_insert_input!]!) {
        insert_content_Item_one(object: $item) {
            ...ManageContent_Item
        }
        insert_content_ItemTag(objects: $itemTags) {
            returning {
                id
            }
        }
    }

    mutation ManageContent_UpdateItem(
        $id: uuid!
        $item: content_Item_set_input!
        $tags: [content_ItemTag_insert_input!]!
        $tagIds: [uuid!]!
    ) {
        insert_content_ItemTag(
            objects: $tags
            on_conflict: { constraint: ItemTag_itemId_tagId_key, update_columns: [] }
        ) {
            returning {
                ...ManageContent_ItemTag
            }
        }
        delete_content_ItemTag(where: { tagId: { _nin: $tagIds }, itemId: { _eq: $id } }) {
            returning {
                id
            }
        }
        update_content_Item_by_pk(pk_columns: { id: $id }, _set: $item) {
            ...ManageContent_ItemScalars
        }
    }

    mutation ManageContent_DeleteItems($ids: [uuid!]!) {
        delete_content_Item(where: { id: { _in: $ids } }) {
            returning {
                id
            }
        }
    }

    ## Tags

    fragment ManageContent_Tag on collection_Tag {
        id
        conferenceId
        subconferenceId
        name
        colour
        priority
    }

    query ManageContent_SelectAllTags($conferenceId: uuid!, $subconferenceCond: uuid_comparison_exp!) {
        collection_Tag(where: { conferenceId: { _eq: $conferenceId }, subconferenceId: $subconferenceCond }) {
            ...ManageContent_Tag
        }
    }

    ## Exhibitions

    fragment ManageContent_Exhibition on collection_Exhibition {
        id
        conferenceId
        subconferenceId
        name
        colour
        priority
        isHidden
        descriptiveItemId
        items {
            id
            itemId
        }
    }

    query ManageContent_SelectAllExhibitions($conferenceId: uuid!, $subconferenceCond: uuid_comparison_exp!) {
        collection_Exhibition(where: { conferenceId: { _eq: $conferenceId }, subconferenceId: $subconferenceCond }) {
            ...ManageContent_Exhibition
        }
    }
`;

function formatEnumValueForLabel(value: string): string {
    const parts = value.split("_");
    return parts.reduce((acc, x) => `${acc} ${x[0]}${x.substr(1).toLowerCase()}`, "").trimStart();
}

export default function ManageContentV2(): JSX.Element {
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
                []
            ),
        [subconferenceId]
    );
    const tagsContext = useMemo(() => ({ ...context, additionalTypenames: ["content_ItemTag"] }), [context]);
    const itemsContext = useMemo(() => ({ ...context, additionalTypenames: ["content_Item"] }), [context]);
    const exhibitionsContext = useMemo(
        () => ({ ...context, additionalTypenames: ["content_ItemExhibition"] }),
        [context]
    );
    const [{ fetching: loadingAllTags, error: errorAllTags, data: allTags }, refetchAllTags] =
        useManageContent_SelectAllTagsQuery({
            requestPolicy: "network-only",
            variables: {
                conferenceId: conference.id,
                subconferenceCond: subconferenceId ? { _eq: subconferenceId } : { _is_null: true },
            },
            context: tagsContext,
        });
    useQueryErrorToast(errorAllTags, false);

    const [{ fetching: loadingAllExhibitions, error: errorAllExhibitions, data: allExhibitions }] =
        useManageContent_SelectAllExhibitionsQuery({
            requestPolicy: "network-only",
            variables: {
                conferenceId: conference.id,
                subconferenceCond: subconferenceId ? { _eq: subconferenceId } : { _is_null: true },
            },
            context: exhibitionsContext,
        });
    useQueryErrorToast(errorAllExhibitions, false);

    const [{ fetching: loadingAllItems, error: errorAllItems, data: allItems }, refetchAllItems] =
        useManageContent_SelectAllItemsQuery({
            requestPolicy: "network-only",
            variables: {
                conferenceId: conference.id,
                subconferenceCond: subconferenceId ? { _eq: subconferenceId } : { _is_null: true },
            },
            context: itemsContext,
        });
    useQueryErrorToast(errorAllItems, false);
    const data = useMemo(() => [...(allItems?.content_Item ?? [])], [allItems?.content_Item]);

    const row: RowSpecification<ManageContent_ItemFragment> = useMemo(
        () => ({
            getKey: (record) => record.id,
            canSelect: (_record) => true,
            canDelete: (record) =>
                record.typeName === Content_ItemType_Enum.LandingPage ? "Cannot delete the landing page item." : true,
            pages: {
                defaultToLast: false,
            },
            invalid: (record) =>
                !record.title?.length
                    ? {
                          columnId: "title",
                          reason: "Title required",
                      }
                    : false,
        }),
        []
    );

    const tagOptions: { value: string; label: string }[] = useMemo(
        () =>
            allTags?.collection_Tag.map((tag) => ({
                value: tag.id,
                label: tag.name,
            })) ?? [],
        [allTags?.collection_Tag]
    );

    const typeOptions = useMemo(
        () =>
            Object.keys(Content_ItemType_Enum).map((key) => {
                const value = (Content_ItemType_Enum as any)[key] as string;
                return {
                    value,
                    label: formatEnumValueForLabel(value),
                };
            }),
        []
    );

    const columns: ColumnSpecification<ManageContent_ItemFragment>[] = useMemo(() => {
        const result: ColumnSpecification<ManageContent_ItemFragment>[] = [
            {
                id: "title",
                defaultSortDirection: SortDirection.Asc,
                header: function TitleHeader({
                    isInCreate,
                    onClick,
                    sortDir,
                }: ColumnHeaderProps<ManageContent_ItemFragment>) {
                    return isInCreate ? (
                        <FormLabel>Title</FormLabel>
                    ) : (
                        <Button size="xs" onClick={onClick}>
                            Title{sortDir !== null ? ` ${sortDir}` : undefined}
                        </Button>
                    );
                },
                get: (data) => data.title,
                set: (record, value: string) => {
                    record.title = value;
                },
                sort: (x: string | null | undefined, y: string | null | undefined) =>
                    maybeCompare(x, y, (a, b) => a.localeCompare(b)),
                filterFn: (rows: Array<ManageContent_ItemFragment>, filterValue: string) => {
                    if (filterValue === "") {
                        return rows.filter((row) => row.title === "");
                    } else {
                        return rows.filter((row) => row.title.toLowerCase().includes(filterValue.toLowerCase()));
                    }
                },
                filterEl: TextColumnFilter,
                cell: function TitleCell({
                    value,
                    onChange,
                    onBlur,
                    ref,
                }: CellProps<Partial<ManageContent_ItemFragment>>) {
                    return (
                        <Input
                            type="text"
                            value={value ?? ""}
                            onChange={(ev) => onChange?.(ev.target.value)}
                            onBlur={onBlur}
                            border="1px solid"
                            borderColor="rgba(255, 255, 255, 0.16)"
                            ref={ref as LegacyRef<HTMLInputElement>}
                        />
                    );
                },
            },
            {
                id: "shortTitle",
                header: function ShortTitleHeader({
                    isInCreate,
                    onClick,
                    sortDir,
                }: ColumnHeaderProps<ManageContent_ItemFragment>) {
                    return isInCreate ? (
                        <FormLabel>Short Title</FormLabel>
                    ) : (
                        <Button size="xs" onClick={onClick}>
                            Short Title{sortDir !== null ? ` ${sortDir}` : undefined}
                        </Button>
                    );
                },
                get: (data) => data.shortTitle,
                set: (record, value: string | null | undefined) => {
                    record.shortTitle = value !== "" ? value : null;
                },
                sort: (x: string | null | undefined, y: string | null | undefined) =>
                    maybeCompare(x, y, (a, b) => a.localeCompare(b)),
                filterFn: (rows: Array<ManageContent_ItemFragment>, filterValue: string) => {
                    if (filterValue === "") {
                        return rows.filter((row) => (row.shortTitle ?? "") === "");
                    } else {
                        return rows.filter(
                            (row) => !!row.shortTitle?.toLowerCase().includes(filterValue.toLowerCase())
                        );
                    }
                },
                filterEl: TextColumnFilter,
                cell: function ShortTitleCell({
                    value,
                    onChange,
                    onBlur,
                    ref,
                }: CellProps<Partial<ManageContent_ItemFragment>>) {
                    return (
                        <Input
                            type="text"
                            value={value ?? ""}
                            onChange={(ev) => onChange?.(ev.target.value)}
                            onBlur={onBlur}
                            border="1px solid"
                            borderColor="rgba(255, 255, 255, 0.16)"
                            ref={ref as LegacyRef<HTMLInputElement>}
                        />
                    );
                },
            },
            {
                id: "typeName",
                header: function ShortTitleHeader({
                    isInCreate,
                    onClick,
                    sortDir,
                }: ColumnHeaderProps<ManageContent_ItemFragment>) {
                    return isInCreate ? (
                        <FormLabel>Label</FormLabel>
                    ) : (
                        <Button size="xs" onClick={onClick}>
                            Label{sortDir !== null ? ` ${sortDir}` : undefined}
                        </Button>
                    );
                },
                get: (data) => data.typeName,
                set: (record, value: Content_ItemType_Enum) => {
                    record.typeName = value;
                },
                sort: (x: Content_ItemType_Enum, y: Content_ItemType_Enum) =>
                    maybeCompare(x, y, (a, b) => a.localeCompare(b)),
                filterFn: (
                    rows: Array<ManageContent_ItemFragment>,
                    filterValue: { label: string; value: string }[]
                ) => {
                    const vals = filterValue.map((x) => x.value);
                    return vals.length === 0 ? rows : rows.filter((row) => vals.includes(row.typeName));
                },
                filterEl: MultiSelectColumnFilter(typeOptions),
                cell: function TypeCell({
                    value,
                    onChange,
                    onBlur,
                    ref,
                }: CellProps<Partial<ManageContent_ItemFragment>, Content_ItemType_Enum>) {
                    return (
                        <Select
                            value={value ?? ""}
                            onChange={(ev) => onChange?.(ev.target.value as Content_ItemType_Enum)}
                            onBlur={onBlur}
                            ref={ref as LegacyRef<HTMLSelectElement>}
                            maxW={400}
                        >
                            {typeOptions.map((opt) => {
                                return (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                );
                            })}
                        </Select>
                    );
                },
            },
            {
                id: "itemTags",
                header: function ItemTagsHeader({ isInCreate }: ColumnHeaderProps<ManageContent_ItemFragment>) {
                    return isInCreate ? (
                        <FormLabel>Tags</FormLabel>
                    ) : (
                        <Text fontSize="xs" p={1} textAlign="center" textTransform="none" fontWeight="normal">
                            Tags
                        </Text>
                    );
                },
                get: (data) =>
                    data.itemTags?.map(
                        (itemTag) =>
                            tagOptions.find((opt) => opt.value === itemTag.tagId) ?? {
                                label: "<Unknown tag>",
                                value: itemTag.tagId,
                            }
                    ) ?? [],
                set: (record, value: { label: string; value: string }[]) => {
                    record.itemTags = value.map((x) => ({
                        itemId: record.id,
                        tagId: x.value,
                        id: undefined,
                    }));
                },
                filterFn: (
                    rows: Array<ManageContent_ItemFragment>,
                    filterValue: ReadonlyArray<{ label: string; value: string }>
                ) => {
                    return filterValue.length === 0
                        ? rows
                        : rows.filter((row) => {
                              return row.itemTags.some((x) => filterValue.some((y) => y.value === x.tagId));
                          });
                },
                filterEl: MultiSelectColumnFilter(tagOptions),
                cell: function ContentCell({
                    value,
                    onChange,
                    onBlur,
                }: CellProps<
                    Partial<ManageContent_ItemFragment>,
                    ReadonlyArray<{ label: string; value: string }> | undefined
                >) {
                    return (
                        <MultiSelect
                            name="tags"
                            options={tagOptions}
                            value={value ?? []}
                            placeholder="Select one or more tags"
                            onChange={(ev) => onChange?.(ev)}
                            onBlur={onBlur}
                            styles={{ container: (base) => ({ ...base, maxWidth: 450 }) }}
                        />
                    );
                },
            },
        ];
        return result;
    }, [tagOptions, typeOptions]);

    const {
        isOpen: isSecondaryPanelOpen,
        onOpen: onSecondaryPanelOpen,
        onClose: onSecondaryPanelClose,
    } = useDisclosure();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState<string | null>(null);
    const [editingItemType, setEditingItemType] = useState<Content_ItemType_Enum | null>(null);
    const edit:
        | {
              open: (key: string) => void;
          }
        | undefined = useMemo(
        () => ({
            open: (key) => {
                setEditingId(key);
                if (data && key) {
                    const item = data.find((x) => x.id === key);
                    if (item) {
                        setEditingTitle(item.title);
                        setEditingItemType(item.typeName);
                    } else {
                        setEditingTitle(null);
                        setEditingItemType(null);
                    }
                } else {
                    setEditingTitle(null);
                    setEditingItemType(null);
                }
                if (key !== null) {
                    onSecondaryPanelOpen();
                } else {
                    onSecondaryPanelClose();
                }
            },
        }),
        [data, onSecondaryPanelClose, onSecondaryPanelOpen]
    );

    const [insertItemResponse, insertItem] = useManageContent_InsertItemMutation();
    const insert:
        | {
              generateDefaults: () => Partial<ManageContent_ItemFragment>;
              makeWhole: (partialRecord: Partial<ManageContent_ItemFragment>) => ManageContent_ItemFragment | undefined;
              start: (record: ManageContent_ItemFragment) => void;
              ongoing: boolean;
          }
        | undefined = useMemo(
        () => ({
            ongoing: insertItemResponse.fetching,
            generateDefaults: () =>
                ({
                    id: uuidv4(),
                    conferenceId: conference.id,
                    subconferenceId,
                    itemTags: [],
                    title: "",
                    typeName: Content_ItemType_Enum.Paper,
                } as ManageContent_ItemFragment),
            makeWhole: (d) => d as ManageContent_ItemFragment,
            start: (record) => {
                insertItem(
                    {
                        item: {
                            conferenceId: record.conferenceId,
                            subconferenceId,
                            id: record.id,
                            title: record.title,
                            shortTitle: record.shortTitle,
                            typeName: record.typeName,
                        },
                        itemTags: record.itemTags,
                    },
                    {
                        fetchOptions: {
                            headers: {
                                [AuthHeader.Role]: subconferenceId
                                    ? HasuraRoleName.SubconferenceOrganizer
                                    : HasuraRoleName.ConferenceOrganizer,
                            },
                        },
                        additionalTypenames: ["content_Item"],
                    }
                );
            },
        }),
        [conference.id, insertItem, insertItemResponse.fetching, subconferenceId]
    );

    const [updateItemResponse, updateItem] = useManageContent_UpdateItemMutation();
    const update:
        | {
              start: (record: ManageContent_ItemFragment) => void;
              ongoing: boolean;
          }
        | undefined = useMemo(
        () => ({
            ongoing: updateItemResponse.fetching,
            start: (record) => {
                const itemUpdateInput: Content_Item_Set_Input = {
                    title: record.title,
                    shortTitle: record.shortTitle,
                    typeName: record.typeName,
                };
                updateItem(
                    {
                        id: record.id,
                        item: itemUpdateInput,
                        tags: record.itemTags.map((x) => ({
                            itemId: x.itemId,
                            tagId: x.tagId,
                        })),
                        tagIds: record.itemTags.map((x) => x.tagId),
                    },
                    {
                        fetchOptions: {
                            headers: {
                                [AuthHeader.Role]: subconferenceId
                                    ? HasuraRoleName.SubconferenceOrganizer
                                    : HasuraRoleName.ConferenceOrganizer,
                            },
                        },
                        additionalTypenames: ["content_Item"],
                    }
                );
            },
        }),
        [subconferenceId, updateItem, updateItemResponse.fetching]
    );

    const [deleteItemsResponse, deleteItems] = useManageContent_DeleteItemsMutation();
    const deleteProps:
        | {
              start: (keys: string[]) => void;
              ongoing: boolean;
          }
        | undefined = useMemo(
        () => ({
            ongoing: deleteItemsResponse.fetching,
            start: (keys) => {
                deleteItems(
                    {
                        ids: keys,
                    },
                    {
                        fetchOptions: {
                            headers: {
                                [AuthHeader.Role]: subconferenceId
                                    ? HasuraRoleName.SubconferenceOrganizer
                                    : HasuraRoleName.ConferenceOrganizer,
                            },
                        },
                        additionalTypenames: ["content_Item"],
                    }
                );
            },
        }),
        [deleteItems, deleteItemsResponse.fetching, subconferenceId]
    );

    const forceReloadRef = useRef<() => void>(() => {
        /* EMPTY */
    });

    const {
        isOpen: sendSubmissionRequests_IsOpen,
        onOpen: sendSubmissionRequests_OnOpen,
        onClose: sendSubmissionRequests_OnClose,
    } = useDisclosure();
    const {
        isOpen: submissionsReview_IsOpen,
        onOpen: submissionsReview_OnOpen,
        onClose: submissionsReview_OnClose,
    } = useDisclosure();
    const [sendSubmissionRequests_ItemIds, setSendSubmissionRequests_ItemIds] = useState<string[]>([]);
    const [sendSubmissionRequests_PersonIds, setSendSubmissionRequests_PersonIds] = useState<string[] | null>(null);
    const [submissionsReview_ItemIds, setSubmissionsReview_ItemIds] = useState<string[]>([]);
    const openSendSubmissionRequests = useCallback(
        (itemId: string, personIds: string[]) => {
            setSendSubmissionRequests_ItemIds([itemId]);
            setSendSubmissionRequests_PersonIds(personIds);
            sendSubmissionRequests_OnOpen();
        },
        [setSendSubmissionRequests_ItemIds, sendSubmissionRequests_OnOpen, setSendSubmissionRequests_PersonIds]
    );
    const client = useClient();
    const buttons: ExtraButton<ManageContent_ItemFragment>[] = useMemo(
        () => [
            {
                render: function ImportButton(_selectedData) {
                    return (
                        <LinkButton
                            key="import-button"
                            colorScheme="purple"
                            to={`${conferencePath}/manage/import/program`}
                        >
                            Import
                        </LinkButton>
                    );
                },
            },
            {
                render: ({ selectedData }: { selectedData: ManageContent_ItemFragment[] }) => {
                    function doTagsExport(dataToExport: readonly ManageContent_TagFragment[]) {
                        const csvText = Papa.unparse(
                            dataToExport.map((tag) => ({
                                "Conference Id": tag.conferenceId,
                                "Subconference Id": tag.subconferenceId,
                                "Tag Id": tag.id,
                                Name: tag.name,
                                Priority: tag.priority,
                                Colour: tag.colour,
                            })),
                            {
                                columns: ["Conference Id", "Subconference Id", "Tag Id", "Name", "Priority", "Colour"],
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
                            .padStart(2, "0")} - Midspace Tags.csv`;

                        csvURL = window.URL.createObjectURL(csvData);

                        const tempLink = document.createElement("a");
                        tempLink.href = csvURL ?? "";
                        tempLink.setAttribute("download", fileName);
                        tempLink.click();
                    }

                    function doExhibitionsExport(dataToExport: readonly ManageContent_ExhibitionFragment[]) {
                        const csvText = Papa.unparse(
                            dataToExport.map((exhibition) => ({
                                "Conference Id": exhibition.conferenceId,
                                "Subconference Id": exhibition.subconferenceId,
                                "Exhibition Id": exhibition.id,
                                Name: exhibition.name,
                                Priority: exhibition.priority,
                                Colour: exhibition.colour,
                                Hidden: exhibition.isHidden ? "Yes" : "No",
                            })),
                            {
                                columns: [
                                    "Conference Id",
                                    "Subconference Id",
                                    "Exhibition Id",
                                    "Name",
                                    "Priority",
                                    "Colour",
                                    "Hidden",
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
                            .padStart(2, "0")} - Midspace Exhibitions.csv`;

                        csvURL = window.URL.createObjectURL(csvData);

                        const tempLink = document.createElement("a");
                        tempLink.href = csvURL ?? "";
                        tempLink.setAttribute("download", fileName);
                        tempLink.click();
                    }

                    async function doContentExport(dataToExport: readonly ManageContent_ItemFragment[]) {
                        const contentForExport = await client
                            .query<
                                ManageContent_SelectItemsForExportQuery,
                                ManageContent_SelectItemsForExportQueryVariables
                            >(
                                ManageContent_SelectItemsForExportDocument,
                                {
                                    itemIds: dataToExport.map((x) => x.id),
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
                            .toPromise();

                        if (contentForExport.data) {
                            const columns: Set<string> = new Set([
                                "Conference Id",
                                "Subconference Id",
                                "Content Id",
                                "Externally Sourced Data Id",
                                "Title",
                                "Short Title",
                                "Type",
                                "Tag Ids",
                                "Exhibitions",
                                "Discussion Room Ids",
                                "Chat Id",
                                "People",
                            ]);
                            const data = contentForExport.data.content_Item.map((item) => {
                                const result: any = {
                                    "Conference Id": item.conferenceId,
                                    "Subconference Id": item.subconferenceId,
                                    "Content Id": item.id,

                                    Title: item.title,
                                    "Short Title": item.shortTitle ?? "",
                                    Type: item.typeName,
                                    "Tag Ids": item.itemTags.map((itemTag) => itemTag.tagId),
                                    Exhibitions: item.itemExhibitions.map(
                                        (itemExh) => `${itemExh.priority ?? "N"}: ${itemExh.exhibitionId}`
                                    ),
                                    "Discussion Room Id": item.room?.id ?? "",
                                    "Chat Id": item.chatId ?? "",

                                    People: item.itemPeople.map(
                                        (itemPerson) =>
                                            `${itemPerson.priority ?? "N"}: ${itemPerson.person?.id} (${
                                                itemPerson.roleName
                                            }) [${itemPerson.person?.name} (${
                                                itemPerson.person?.affiliation ?? "No affiliation"
                                            }) <${itemPerson.person?.email ?? "No email"}>]`
                                    ),
                                };

                                for (let idx = 0; idx < item.elements.length; idx++) {
                                    const baseName = `Element ${idx}`;
                                    const element = item.elements[idx];
                                    result[`${baseName}: Id`] = element.id;
                                    result[`${baseName}: Name`] = element.name;
                                    result[`${baseName}: Type`] = element.typeName;
                                    result[`${baseName}: Data`] =
                                        element.data && element.data instanceof Array
                                            ? JSON.stringify(element.data[element.data.length - 1])
                                            : null;
                                    result[`${baseName}: Layout`] = element.layoutData
                                        ? JSON.stringify(element.layoutData)
                                        : null;
                                    result[`${baseName}: Uploads Remaining`] = element.uploadsRemaining ?? "Unlimited";
                                    result[`${baseName}: Hidden`] = element.isHidden ? "Yes" : "No";
                                    result[`${baseName}: Updated At`] = element.updatedAt;

                                    columns.add(`${baseName}: Id`);
                                    columns.add(`${baseName}: Name`);
                                    columns.add(`${baseName}: Type`);
                                    columns.add(`${baseName}: Data`);
                                    columns.add(`${baseName}: Layout`);
                                    columns.add(`${baseName}: Uploads Remaining`);
                                    columns.add(`${baseName}: Hidden`);
                                    columns.add(`${baseName}: Updated At`);
                                }

                                return result;
                            });
                            const csvText = Papa.unparse(data, { columns: [...columns] });

                            const csvData = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
                            let csvURL: string | null = null;
                            const now = new Date();
                            const fileName = `${now.getFullYear()}-${(now.getMonth() + 1)
                                .toString()
                                .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}T${now
                                .getHours()
                                .toString()
                                .padStart(2, "0")}-${now
                                .getMinutes()
                                .toString()
                                .padStart(2, "0")} - Midspace Content.csv`;

                            csvURL = window.URL.createObjectURL(csvData);

                            const tempLink = document.createElement("a");
                            tempLink.href = csvURL ?? "";
                            tempLink.setAttribute("download", fileName);
                            tempLink.click();
                        }
                    }

                    const tooltip = (filler: string) => `Exports ${filler}.`;
                    if (selectedData.length === 0) {
                        return (
                            <Menu>
                                <Tooltip label={tooltip("all content, tags or exhibitions")}>
                                    <MenuButton as={Button} colorScheme="purple" rightIcon={<ChevronDownIcon />}>
                                        Export
                                    </MenuButton>
                                </Tooltip>
                                <MenuList maxH="400px" overflowY="auto">
                                    <MenuItem
                                        onClick={() => {
                                            if (allTags?.collection_Tag) {
                                                doTagsExport(allTags.collection_Tag);
                                            }
                                        }}
                                    >
                                        Tags
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => {
                                            if (allExhibitions?.collection_Exhibition) {
                                                doExhibitionsExport(allExhibitions.collection_Exhibition);
                                            }
                                        }}
                                    >
                                        Exhibitions
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => {
                                            if (allItems?.content_Item) {
                                                doContentExport(allItems.content_Item);
                                            }
                                        }}
                                    >
                                        Content
                                    </MenuItem>
                                    <MenuGroup title="Content with tag">
                                        {allTags?.collection_Tag.map((tag) => (
                                            <MenuItem
                                                key={tag.id}
                                                onClick={() => {
                                                    if (allItems?.content_Item) {
                                                        doContentExport(
                                                            allItems?.content_Item.filter((item) =>
                                                                item.itemTags.some(
                                                                    (itemTag) => itemTag.tagId === tag.id
                                                                )
                                                            )
                                                        );
                                                    }
                                                }}
                                            >
                                                {tag.name}
                                            </MenuItem>
                                        ))}
                                    </MenuGroup>
                                    <MenuGroup title="Content in exhibtion">
                                        {allExhibitions?.collection_Exhibition.map((exh) => (
                                            <MenuItem
                                                key={exh.id}
                                                onClick={() => {
                                                    if (allItems?.content_Item) {
                                                        doContentExport(
                                                            allItems?.content_Item.filter((item) =>
                                                                exh.items.some((exhItm) => exhItm.itemId === item.id)
                                                            )
                                                        );
                                                    }
                                                }}
                                            >
                                                {exh.name}
                                            </MenuItem>
                                        ))}
                                    </MenuGroup>
                                </MenuList>
                            </Menu>
                        );
                    } else {
                        return (
                            <Tooltip label={tooltip("selected content")}>
                                <Box>
                                    <Button
                                        colorScheme="purple"
                                        isDisabled={selectedData.length === 0}
                                        onClick={() => doContentExport(selectedData)}
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
                render: function SendSubmissionRequests({
                    selectedData: items,
                    key,
                }: {
                    selectedData: ManageContent_ItemFragment[];
                    key: string;
                }) {
                    return items.length > 0 ? (
                        <Tooltip
                            key={key}
                            label="Send submission request emails to selected items (first requests, reminders or repeats)."
                        >
                            <Button
                                onClick={() => {
                                    setSendSubmissionRequests_ItemIds(items.map((x) => x.id));
                                    setSendSubmissionRequests_PersonIds(null);
                                    sendSubmissionRequests_OnOpen();
                                }}
                            >
                                Send submission requests
                            </Button>
                        </Tooltip>
                    ) : (
                        <Menu key={key}>
                            <Tooltip label="Send submission requests (first requests, reminders or repeats).">
                                <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                                    Send submission requests
                                </MenuButton>
                            </Tooltip>
                            <MenuList overflow="auto" maxH="30vh">
                                <MenuItem
                                    key="all-items"
                                    onClick={() => {
                                        if (allItems?.content_Item) {
                                            setSendSubmissionRequests_ItemIds(allItems.content_Item.map((x) => x.id));
                                            setSendSubmissionRequests_PersonIds(null);
                                            sendSubmissionRequests_OnOpen();
                                        }
                                    }}
                                >
                                    All content
                                </MenuItem>
                                <MenuGroup title="Content with tag">
                                    {allTags?.collection_Tag
                                        ? R.sortBy((x) => x.name, allTags.collection_Tag).map((tag) => (
                                              <MenuItem
                                                  key={tag.id}
                                                  onClick={() => {
                                                      if (allItems?.content_Item) {
                                                          setSendSubmissionRequests_ItemIds(
                                                              allItems.content_Item
                                                                  .filter((item) =>
                                                                      item.itemTags.some(
                                                                          (itemTag) => itemTag.tagId === tag.id
                                                                      )
                                                                  )
                                                                  .map((x) => x.id)
                                                          );
                                                          setSendSubmissionRequests_PersonIds(null);
                                                          sendSubmissionRequests_OnOpen();
                                                      }
                                                  }}
                                              >
                                                  {tag.name}
                                              </MenuItem>
                                          ))
                                        : undefined}
                                </MenuGroup>
                            </MenuList>
                        </Menu>
                    );
                },
            },
            {
                render: function SubmissionReviews({
                    selectedData: items,
                    key,
                }: {
                    selectedData: ManageContent_ItemFragment[];
                    key: string;
                }) {
                    return items.length > 0 ? (
                        <Button
                            key={key}
                            onClick={() => {
                                setSubmissionsReview_ItemIds(items.map((x) => x.id));
                                submissionsReview_OnOpen();
                            }}
                        >
                            Review submissions
                        </Button>
                    ) : (
                        <Menu key={key}>
                            <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                                Review submissions
                            </MenuButton>
                            <MenuList overflow="auto" maxH="30vh">
                                <MenuItem
                                    key="all-items"
                                    onClick={() => {
                                        if (allItems?.content_Item) {
                                            setSubmissionsReview_ItemIds(allItems.content_Item.map((x) => x.id));
                                            submissionsReview_OnOpen();
                                        }
                                    }}
                                >
                                    All content
                                </MenuItem>
                                <MenuGroup title="Content with tag">
                                    {allTags?.collection_Tag
                                        ? R.sortBy((x) => x.name, allTags.collection_Tag).map((tag) => (
                                              <MenuItem
                                                  key={tag.id}
                                                  onClick={() => {
                                                      if (allItems?.content_Item) {
                                                          setSubmissionsReview_ItemIds(
                                                              allItems.content_Item
                                                                  .filter((item) =>
                                                                      item.itemTags.some(
                                                                          (itemTag) => itemTag.tagId === tag.id
                                                                      )
                                                                  )
                                                                  .map((x) => x.id)
                                                          );
                                                          submissionsReview_OnOpen();
                                                      }
                                                  }}
                                              >
                                                  {tag.name}
                                              </MenuItem>
                                          ))
                                        : undefined}
                                </MenuGroup>
                            </MenuList>
                        </Menu>
                    );
                },
            },
            {
                render: function RenderBulkOperationMenu({
                    selectedData,
                    key,
                }: {
                    selectedData: ManageContent_ItemFragment[];
                    key: string;
                }) {
                    return (
                        <BulkOperationMenu
                            key={key}
                            selectedData={selectedData}
                            allItems={allItems?.content_Item ?? []}
                            allTags={allTags?.collection_Tag ?? []}
                        />
                    );
                },
            },
        ],
        [
            conferencePath,
            client,
            subconferenceId,
            allTags?.collection_Tag,
            allExhibitions?.collection_Exhibition,
            allItems?.content_Item,
            sendSubmissionRequests_OnOpen,
            submissionsReview_OnOpen,
        ]
    );

    const alert = useMemo<
        | {
              title: string;
              description: string;
              status: "info" | "warning" | "error";
          }
        | undefined
    >(
        () =>
            insertItemResponse.error || updateItemResponse.error || deleteItemsResponse.error
                ? {
                      status: "error",
                      title: "Error saving changes",
                      description:
                          extractActualError(
                              insertItemResponse.error ?? updateItemResponse.error ?? deleteItemsResponse.error
                          ) ?? "Unknown error",
                  }
                : undefined,
        [deleteItemsResponse.error, insertItemResponse.error, updateItemResponse.error]
    );

    return (
        <DashboardPage title="Content">
            {(loadingAllTags && !allTags) ||
            (loadingAllExhibitions && !allExhibitions) ||
            (loadingAllItems && !allItems?.content_Item) ? (
                <></>
            ) : errorAllTags || errorAllExhibitions || errorAllItems ? (
                <>An error occurred loading in data - please see further information in notifications.</>
            ) : (
                <></>
            )}
            <HStack w="100%" spacing={2} mx="auto" justifyContent="flex-start">
                <ManageTagsModal
                    onClose={async () => {
                        await Promise.all([refetchAllItems(), refetchAllTags()]);
                        forceReloadRef.current();
                    }}
                />
                <ManageExhibitionsModal
                    onClose={async () => {
                        forceReloadRef.current();
                    }}
                />
            </HStack>
            <CRUDTable<ManageContent_ItemFragment>
                columns={columns}
                row={row}
                data={
                    !loadingAllTags &&
                    !loadingAllExhibitions &&
                    !loadingAllItems &&
                    (allTags?.collection_Tag && allExhibitions?.collection_Exhibition && allItems?.content_Item
                        ? data
                        : null)
                }
                tableUniqueName="ManageConferenceRegistrants"
                alert={alert}
                edit={edit}
                insert={insert}
                update={update}
                delete={deleteProps}
                buttons={buttons}
                forceReload={forceReloadRef}
            />
            <SecondaryEditor
                itemId={editingId}
                itemTitle={editingTitle}
                itemType={editingItemType ?? Content_ItemType_Enum.Other}
                onClose={onSecondaryPanelClose}
                isOpen={isSecondaryPanelOpen}
                openSendSubmissionRequests={openSendSubmissionRequests}
            />
            <SendSubmissionRequestsModal
                isOpen={sendSubmissionRequests_IsOpen}
                onClose={sendSubmissionRequests_OnClose}
                itemIds={sendSubmissionRequests_ItemIds}
                personIds={sendSubmissionRequests_PersonIds}
            />
            <SubmissionsReviewModal
                isOpen={submissionsReview_IsOpen}
                onClose={submissionsReview_OnClose}
                itemIds={submissionsReview_ItemIds}
            />
        </DashboardPage>
    );
}
