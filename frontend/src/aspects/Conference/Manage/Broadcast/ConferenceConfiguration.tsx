import { Alert, AlertIcon, AlertTitle, Box, Heading } from "@chakra-ui/react";
import { AuthHeader, HasuraRoleName } from "@midspace/shared-types/auth";
import { gql } from "@urql/core";
import AmazonS3URI from "amazon-s3-uri";
import React, { useMemo } from "react";
import ReactPlayer from "react-player";
import type { ConferenceConfiguration_ConferenceConfigurationsFragment } from "../../../../generated/graphql";
import {
    Conference_ConfigurationKey_Enum,
    useConferenceConfiguration_GetConferenceConfigurationsQuery,
} from "../../../../generated/graphql";
import { makeContext } from "../../../GQL/make-context";
import QueryWrapper from "../../../GQL/QueryWrapper";

gql`
    query ConferenceConfiguration_GetConferenceConfigurations($conferenceId: uuid!) {
        conference_Configuration(where: { conferenceId: { _eq: $conferenceId } }) {
            ...ConferenceConfiguration_ConferenceConfigurations
        }
    }

    fragment ConferenceConfiguration_ConferenceConfigurations on conference_Configuration {
        conferenceId
        key
        value
    }
`;

export function Configuration({ conferenceId }: { conferenceId: string }): JSX.Element {
    const context = useMemo(
        () =>
            makeContext(
                {
                    [AuthHeader.Role]: HasuraRoleName.ConferenceOrganizer,
                },
                ["conference_Configuration"]
            ),
        []
    );
    const [conferenceConfigurationsResult] = useConferenceConfiguration_GetConferenceConfigurationsQuery({
        variables: {
            conferenceId,
        },
        context,
    });

    return (
        <QueryWrapper queryResult={conferenceConfigurationsResult} getter={(result) => result.conference_Configuration}>
            {(configurations: readonly ConferenceConfiguration_ConferenceConfigurationsFragment[]) => (
                <FillerVideoConfiguration
                    fillerVideos={
                        configurations.find((x) => x.key === Conference_ConfigurationKey_Enum.FillerVideos)?.value ??
                        null
                    }
                    update={() => {
                        //todo
                    }}
                />
            )}
        </QueryWrapper>
    );
}

function FillerVideoConfiguration({
    fillerVideos,
}: {
    fillerVideos: string[] | null;
    update: (fillerVideos: any[]) => void;
}): JSX.Element {
    const fillerVideoUrl = useMemo(() => {
        try {
            if (!fillerVideos) {
                return null;
            }
            const { bucket, key } = new AmazonS3URI(fillerVideos[0]);
            return `https://s3.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${bucket}/${key}`;
        } catch {
            return null;
        }
    }, [fillerVideos]);

    return (
        <Box minW="50vw">
            <Heading as="h3" size="md" textAlign="left" mb={3}>
                Filler video
            </Heading>
            {fillerVideoUrl ? (
                <ReactPlayer
                    url={fillerVideoUrl}
                    controls={true}
                    width="300px"
                    height="auto"
                    maxHeight="400px"
                    style={{ borderRadius: "10px", overflow: "hidden" }}
                />
            ) : (
                <Alert status="error">
                    <AlertIcon />
                    <AlertTitle mr={2}>No video selected yet.</AlertTitle>
                </Alert>
            )}
        </Box>
    );
}
