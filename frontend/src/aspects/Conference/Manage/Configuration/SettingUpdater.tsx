import { gql } from "@apollo/client";
import { Spinner, useToast } from "@chakra-ui/react";
import React, { useCallback } from "react";
import type { Conference_ConfigurationKey_Enum } from "../../../../generated/graphql";
import {
    useSettingUpdater_DeleteConfigurationMutation,
    useSettingUpdater_GetConfigurationQuery,
    useSettingUpdater_SetConfigurationMutation,
} from "../../../../generated/graphql";
import { useConference } from "../../useConference";

gql`
    query SettingUpdater_GetConfiguration($conferenceId: uuid!, $key: conference_ConfigurationKey_enum!) {
        conference_Configuration_by_pk(conferenceId: $conferenceId, key: $key) {
            conferenceId
            key
            value
        }
    }

    mutation SettingUpdater_SetConfiguration(
        $conferenceId: uuid!
        $key: conference_ConfigurationKey_enum!
        $value: jsonb!
    ) {
        insert_conference_Configuration_one(
            object: { conferenceId: $conferenceId, key: $key, value: $value }
            on_conflict: { constraint: Configuration_pkey, update_columns: [value] }
        ) {
            conferenceId
            key
            value
        }
    }

    mutation SettingUpdater_DeleteConfiguration($conferenceId: uuid!, $key: conference_ConfigurationKey_enum!) {
        delete_conference_Configuration_by_pk(conferenceId: $conferenceId, key: $key) {
            conferenceId
            key
        }
    }
`;

export interface SettingChildProps<T = any> {
    settingName: Conference_ConfigurationKey_Enum;
    value: T;
    onChange: (value: T | undefined) => void;
}

export default function SettingUpdater<T>({
    settingName,
    defaultValue,
    children,
}: {
    settingName: Conference_ConfigurationKey_Enum;
    defaultValue: T | undefined;
    children: (props: SettingChildProps<T>) => JSX.Element;
}): JSX.Element {
    const conference = useConference();
    const setting = useSettingUpdater_GetConfigurationQuery({
        variables: {
            conferenceId: conference.id,
            key: settingName,
        },
        fetchPolicy: "network-only",
    });
    const [updateSetting] = useSettingUpdater_SetConfigurationMutation();
    const [deleteSetting] = useSettingUpdater_DeleteConfigurationMutation();

    const toast = useToast();
    const onChange = useCallback(
        async (newValue: T | undefined) => {
            try {
                if (newValue === undefined || (typeof newValue === "string" && !newValue?.trim().length)) {
                    await deleteSetting({
                        variables: {
                            conferenceId: conference.id,
                            key: settingName,
                        },
                    });
                    toast({
                        status: "success",
                        title: "Setting updated",
                        isClosable: true,
                        duration: 2000,
                        position: "bottom",
                    });
                } else {
                    await updateSetting({
                        variables: {
                            conferenceId: conference.id,
                            key: settingName,
                            value: typeof newValue === "string" ? newValue?.trim() : newValue,
                        },
                    });
                    toast({
                        status: "success",
                        title: "Setting updated",
                        isClosable: true,
                        duration: 2000,
                        position: "bottom",
                    });
                }
            } catch (e: any) {
                toast({
                    status: "error",
                    title: "Failed to update setting",
                    description: e.toString(),
                    isClosable: true,
                    position: "bottom",
                });
            }
        },
        [conference.id, deleteSetting, settingName, toast, updateSetting]
    );

    return setting.data ? (
        children({
            settingName,
            value: setting.data.conference_Configuration_by_pk?.value ?? defaultValue,
            onChange,
        })
    ) : (
        <Spinner label="Loading" />
    );
}