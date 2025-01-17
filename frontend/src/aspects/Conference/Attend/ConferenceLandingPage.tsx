import { Box, Heading, useColorModeValue } from "@chakra-ui/react";
import type { ElementDataBlob } from "@midspace/shared-types/content";
import { ElementBaseType } from "@midspace/shared-types/content";
import React, { useMemo } from "react";
import { gql } from "urql";
import { Content_ElementType_Enum, useConferenceLandingPageItemQuery } from "../../../generated/graphql";
import CenteredSpinner from "../../Chakra/CenteredSpinner";
import PageFailedToLoad from "../../Errors/PageFailedToLoad";
import PageNotFound from "../../Errors/PageNotFound";
import useQueryErrorToast from "../../GQL/useQueryErrorToast";
import { useTitle } from "../../Hooks/useTitle";
import RequireRole from "../RequireRole";
import { useConference } from "../useConference";
import ElementsGridLayout from "./Content/Element/ElementsGridLayout";

gql`
    query ConferenceLandingPageItem($conferenceId: uuid!) @cached {
        content_Item(
            where: {
                conferenceId: { _eq: $conferenceId }
                subconferenceId: { _is_null: true }
                typeName: { _eq: LANDING_PAGE }
            }
            limit: 1
        ) {
            ...ItemElements_JustElementData
        }
    }
`;

function ConferenceLandingPageInner(): JSX.Element {
    const conference = useConference();

    const title = useTitle(conference.name);

    const [{ error, data }] = useConferenceLandingPageItemQuery({
        variables: {
            conferenceId: conference.id,
        },
    });
    useQueryErrorToast(error, false, "ConferenceLandingPage.tsx");

    const item = useMemo(() => {
        if (data && data.content_Item.length > 0) {
            return data.content_Item[0];
        }
        return null;
    }, [data]);

    const hasAbstract = useMemo(
        () =>
            item?.elements.some((item) => {
                if (item.typeName === Content_ElementType_Enum.Abstract) {
                    const data: ElementDataBlob = item.data;
                    if (
                        data.length > 0 &&
                        data[0].data.baseType === ElementBaseType.Text &&
                        data[0].data.text &&
                        data[0].data.text.trim() !== ""
                    ) {
                        return true;
                    }
                }
                return false;
            }),
        [item?.elements]
    );

    const bgColor = useColorModeValue(
        "ConferenceLandingPage.backgroundColor-light",
        "ConferenceLandingPage.backgroundColor-dark"
    );

    if (!item) {
        return (
            <>
                {title}
                <CenteredSpinner caller="ConferenceLandingPage:70" />
            </>
        );
    }

    if (error) {
        return (
            <>
                {title}
                <PageFailedToLoad>
                    Sorry, we were unable to load the page due to an unrecognised error. Please try again later or
                    contact our support teams if this error persists.
                </PageFailedToLoad>
            </>
        );
    }

    return (
        <Box w="100%" mx={[2, 2, 4]} bgColor={bgColor} pb="40px" minH="100%">
            {title}
            {!hasAbstract ? (
                <Heading as="h1" id="page-heading" mt={2}>
                    {conference.shortName}
                </Heading>
            ) : undefined}
            <ElementsGridLayout elements={item.elements} textJustification="center" />
        </Box>
    );
}

export default function ConferenceLandingPage(): JSX.Element {
    return (
        <RequireRole attendeeRole componentIfDenied={<PageNotFound />}>
            <ConferenceLandingPageInner />
        </RequireRole>
    );
}
