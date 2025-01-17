import { Button, FormControl, FormLabel, Select, useToast, VStack } from "@chakra-ui/react";
import { AuthHeader, HasuraRoleName } from "@midspace/shared-types/auth";
import type { FieldProps } from "formik";
import { Field, Form, Formik } from "formik";
import React, { useMemo } from "react";
import { gql } from "urql";
import {
    useEventVonageControls_GetEventsQuery,
    useEventVonageControls_StopEventBroadcastMutation,
} from "../../../../generated/graphql";
import { makeContext } from "../../../GQL/make-context";

gql`
    query EventVonageControls_GetEvents($conferenceId: uuid!) {
        schedule_Event(where: { conferenceId: { _eq: $conferenceId }, modeName: { _eq: LIVESTREAM } }) {
            id
            name
            conferenceId
            modeName
            itemId
            item {
                id
                title
            }
        }
    }
    mutation EventVonageControls_StopEventBroadcast($eventId: uuid!) {
        stopEventBroadcast(eventId: $eventId) {
            broadcastsStopped
        }
    }
`;

export function EventVonageControls({ conferenceId }: { conferenceId: string }): JSX.Element {
    const context = useMemo(
        () =>
            makeContext(
                {
                    [AuthHeader.Role]: HasuraRoleName.ConferenceOrganizer,
                },
                []
            ),
        []
    );
    const [{ data }] = useEventVonageControls_GetEventsQuery({
        variables: {
            conferenceId,
        },
        context,
    });

    const [, stopEventBroadcastMutation] = useEventVonageControls_StopEventBroadcastMutation();

    const toast = useToast();

    const options = useMemo(() => {
        return data?.schedule_Event.map(
            (event) =>
                (
                    <option key={event.id} value={event.id}>
                        {event.item ? `${event.item.title} (${event.name})` : event.name}
                    </option>
                ) ?? []
        );
    }, [data?.schedule_Event]);

    return (
        <Formik<{ eventId: string | null }>
            initialValues={{ eventId: null }}
            onSubmit={async (values) => {
                try {
                    if (!values.eventId) {
                        throw new Error("No event selected");
                    }
                    const result = await stopEventBroadcastMutation(
                        {
                            eventId: values.eventId,
                        },
                        {
                            fetchOptions: {
                                headers: {
                                    [AuthHeader.Role]: HasuraRoleName.ConferenceOrganizer,
                                },
                            },
                        }
                    );

                    if (result.data?.stopEventBroadcast) {
                        toast({
                            status: "success",
                            title: `Stopped ${result.data.stopEventBroadcast.broadcastsStopped} broadcasts`,
                        });
                    } else {
                        throw new Error("No response from server");
                    }
                } catch (e: any) {
                    toast({
                        status: "error",
                        title: "Failed to stop broadcasts",
                        description: e.toString(),
                    });
                }
            }}
        >
            {({ isSubmitting }) => (
                <Form>
                    <VStack alignItems="center">
                        <Field name="eventId">
                            {({ field, form }: FieldProps<string>) => (
                                <FormControl
                                    w="auto"
                                    maxW="400px"
                                    isInvalid={!!form.errors.eventId && !!form.touched.eventId}
                                    isRequired
                                >
                                    <FormLabel htmlFor="eventId">Event</FormLabel>
                                    <Select {...field} id="eventId" placeholder="Choose event">
                                        {options}
                                    </Select>
                                </FormControl>
                            )}
                        </Field>
                        <Button type="submit" isLoading={isSubmitting} mt={4}>
                            Stop any ongoing broadcasts
                        </Button>
                    </VStack>
                </Form>
            )}
        </Formik>
    );
}
