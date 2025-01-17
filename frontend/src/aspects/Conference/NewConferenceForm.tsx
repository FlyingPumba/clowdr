import {
    Button,
    FormControl,
    FormErrorMessage,
    FormLabel,
    Input,
    InputGroup,
    InputRightAddon,
    Tooltip,
    useToast,
} from "@chakra-ui/react";
import { AuthHeader, HasuraRoleName } from "@midspace/shared-types/auth";
import { gql } from "@urql/core";
import type { FieldProps, FormikErrors } from "formik";
import { Field, Form, Formik } from "formik";
import React from "react";
import { useHistory } from "react-router-dom";
import { useClient } from "urql";
import { validate } from "uuid";
import type {
    ConferenceTakenQuery,
    ConferenceTakenQueryVariables,
    Conference_Conference,
} from "../../generated/graphql";
import {
    ConferenceTakenDocument,
    useCreateConferenceMutation,
    useCreateNewConferenceMetaStructureMutation,
} from "../../generated/graphql";
import useCurrentUser from "../Users/CurrentUser/useCurrentUser";

gql`
    query ConferenceTaken($name: String!, $shortName: String!, $slug: String!) {
        conference_Conference(
            where: { _or: [{ name: { _eq: $name } }, { shortName: { _eq: $shortName } }, { slug: { _eq: $slug } }] }
        ) {
            id
            name
            shortName
            slug
        }
    }

    mutation CreateConference($name: String!, $shortName: String!, $slug: String!, $demoCode: uuid!, $userId: String!) {
        insert_conference_Conference(
            objects: [{ name: $name, shortName: $shortName, slug: $slug, demoCodeId: $demoCode }]
        ) {
            returning {
                id
                slug
            }
        }

        update_conference_DemoCode(
            where: { id: { _eq: $demoCode } }
            _set: { note: "Code has been used.", usedById: $userId }
        ) {
            affected_rows
        }
    }

    mutation CreateNewConferenceMetaStructure(
        $conferenceId: uuid!
        $registrantDisplayName: String!
        $userId: String!
        $abstractData: jsonb!
        $exploreProgramData: jsonb!
        $exploreScheduleData: jsonb!
        $registerButtonData: jsonb!
    ) {
        insert_registrant_Registrant(
            objects: [
                {
                    displayName: $registrantDisplayName
                    userId: $userId
                    conferenceId: $conferenceId
                    conferenceRole: ORGANIZER
                }
            ]
        ) {
            affected_rows
        }

        insert_content_Item(
            objects: {
                conferenceId: $conferenceId
                typeName: LANDING_PAGE
                elements: {
                    data: [
                        {
                            conferenceId: $conferenceId
                            typeName: ABSTRACT
                            data: $abstractData
                            isHidden: false
                            layoutData: null
                            name: "Welcome text"
                        }
                        {
                            conferenceId: $conferenceId
                            typeName: EXPLORE_PROGRAM_BUTTON
                            data: $exploreProgramData
                            isHidden: false
                            layoutData: null
                            name: "Explore program button"
                        }
                        {
                            conferenceId: $conferenceId
                            typeName: EXPLORE_SCHEDULE_BUTTON
                            data: $exploreScheduleData
                            isHidden: false
                            layoutData: null
                            name: "Explore program button"
                        }
                        {
                            conferenceId: $conferenceId
                            typeName: LINK_BUTTON
                            data: $registerButtonData
                            isHidden: false
                            layoutData: null
                            name: "Register button"
                        }
                    ]
                }
                shortTitle: "Welcome Lobby"
                title: "Landing page"
            }
        ) {
            affected_rows
        }
    }
`;

export function normaliseName(value: string, trim = true): string {
    let result = value?.replace(/\s\s+/g, " ");
    if (trim) {
        result = result?.trim();
    }
    return result;
}

/**
 * Returns error message or undefined if no errors.
 */
export function validateName(inValue: string | null | undefined): string | undefined {
    let error;
    const value = inValue ? normaliseName(inValue) : undefined;
    if (!value || value.length === 0) {
        error = "Name is required";
    } else if (value.length < 10) {
        error = "Name must be at least 10 characters.";
    }
    return error;
}

/**
 * Returns error message or undefined if no errors.
 */
export function validateShortName(inValue: string | null | undefined): string | undefined {
    let error;
    const value = inValue ? normaliseName(inValue) : undefined;
    if (!value || value.length === 0) {
        error = "Short name is required";
    } else if (value.length < 5) {
        error = "Short name must be at least 5 characters.";
    }
    return error;
}

export default function NewConferenceForm(): JSX.Element {
    const toast = useToast();
    const client = useClient();
    const history = useHistory();
    const { user } = useCurrentUser();

    const [, createConferenceMutation] = useCreateConferenceMutation();
    const [, createNewConferenceMetaStructureMutation] = useCreateNewConferenceMetaStructureMutation();

    function validateDemoCode(value: string | null | undefined) {
        if (!!value && validate(value)) {
            return undefined;
        } else {
            return "Not a valid access code.";
        }
    }

    function generateSlug(value: string) {
        return value.replace(/\s/g, "").toLowerCase();
    }

    const year = new Date().getFullYear();

    return (
        <Formik
            initialValues={{
                new_conf_name: "My Awesome Conference " + year,
                new_conf_short_name: "MAC " + year,
                new_conf_demo_code: "",
            }}
            onSubmit={async (_values, actions) => {
                const values = {
                    name: normaliseName(_values.new_conf_name),
                    shortName: normaliseName(_values.new_conf_short_name),
                    slug: generateSlug(normaliseName(_values.new_conf_short_name)),
                    demoCode: _values.new_conf_demo_code,
                    userId: user.id,
                };

                let failed: false | string = false;

                const takenResult = await client
                    .query<ConferenceTakenQuery, ConferenceTakenQueryVariables>(ConferenceTakenDocument, {
                        name: values.name,
                        shortName: values.shortName,
                        slug: values.slug,
                    }, {
                        requestPolicy: "network-only",
                    })
                    .toPromise();
                try {
                    let ok: boolean | Pick<Conference_Conference, "id" | "name" | "shortName" | "slug"> = false;
                    if (takenResult.error) {
                        throw takenResult.error;
                    } else {
                        if (takenResult.data) {
                            if (takenResult.data.conference_Conference.length === 0) {
                                ok = true;
                            } else {
                                ok = takenResult.data.conference_Conference[0];
                            }
                        } else {
                            throw new Error("No 'name taken' data!");
                        }
                    }

                    if (ok === true) {
                        const result = await createConferenceMutation(values, {
                            fetchOptions: {
                                headers: {
                                    [AuthHeader.Role]: "user",
                                },
                            },
                        });
                        if (
                            result.error ||
                            !result.data ||
                            !result.data.insert_conference_Conference ||
                            !result.data.insert_conference_Conference.returning.length
                        ) {
                            toast({
                                title: "Could not create conference",
                                description:
                                    "The name or short name may already be taken or your access code may have already been used.",
                                status: "error",
                            });
                            // failed = true;
                        } else {
                            failed = false;
                            const conferenceId = result.data.insert_conference_Conference.returning[0].id;
                            const now = Date.now();

                            await createNewConferenceMetaStructureMutation(
                                {
                                    conferenceId,
                                    registrantDisplayName: "Conference Creator",
                                    userId: user.id,
                                    abstractData: [
                                        {
                                            createdAt: now,
                                            createdBy: "system",
                                            data: {
                                                type: "ABSTRACT",
                                                baseType: "text",
                                                text: "Welcome to this conference!",
                                            },
                                        },
                                    ],
                                    exploreProgramData: [
                                        {
                                            createdAt: now,
                                            createdBy: "system",
                                            data: { type: "EXPLORE_PROGRAM_BUTTON", baseType: "component" },
                                        },
                                    ],
                                    exploreScheduleData: [
                                        {
                                            createdAt: now,
                                            createdBy: "system",
                                            data: { type: "EXPLORE_SCHEDULE_BUTTON", baseType: "component" },
                                        },
                                    ],
                                    registerButtonData: [
                                        {
                                            createdAt: now,
                                            createdBy: "system",
                                            data: { type: "LINK_BUTTON", baseType: "link", text: "Register", url: "" },
                                        },
                                    ],
                                },
                                {
                                    fetchOptions: {
                                        headers: {
                                            [AuthHeader.Role]: HasuraRoleName.ConferenceOrganizer,
                                            [AuthHeader.ConferenceId]: conferenceId,
                                        },
                                    },
                                }
                            );

                            toast({
                                title: "Conference created",
                                status: "success",
                            });
                            history.push(
                                `/conference/${result.data.insert_conference_Conference.returning[0].slug}/manage`
                            );
                        }
                    } else {
                        const errors: FormikErrors<{
                            new_conf_name: string;
                            new_conf_short_name: string;
                        }> = {};
                        if (ok.name === values.name) {
                            errors.new_conf_name = "Name has already been taken";
                        }
                        if (ok.shortName === values.shortName) {
                            errors.new_conf_short_name = "Short name has already been taken";
                        }
                        if (ok.slug === values.slug) {
                            errors.new_conf_short_name = "Short name has already been taken";
                        }
                        actions.setErrors(errors);
                    }
                } catch (e: any) {
                    failed = e.toString();
                }

                if (failed) {
                    if (failed.includes("Check constraint violation. insert check constraint failed")) {
                        toast({
                            title: "Failed to create conference",
                            description:
                                "We were unable to create your conference as the access code has already been used.",
                            status: "error",
                            duration: 7000,
                            isClosable: true,
                        });
                    } else {
                        toast({
                            title: "Failed to create conference",
                            description: `An error has occurred while trying to create your conference.
Please contact our tech support to investigate the issue shown below.`,
                            status: "error",
                            duration: null,
                            isClosable: true,
                        });
                        toast({
                            title: "Error information",
                            description: failed,
                            status: "info",
                            duration: null,
                            isClosable: true,
                        });
                    }
                }

                actions.setSubmitting(false);
            }}
        >
            {(props) => (
                <Form style={{ width: "100%" }}>
                    <Field name="new_conf_name" validate={validateName}>
                        {({ field, form }: FieldProps<string>) => (
                            <FormControl
                                isInvalid={!!form.errors.new_conf_name && !!form.touched.new_conf_name}
                                isRequired
                            >
                                <FormLabel htmlFor="new_conf_name">Name</FormLabel>
                                <Input
                                    {...{
                                        ...field,
                                        value: normaliseName(field.value, false),
                                    }}
                                    id="new_conf_name"
                                    placeholder="Name"
                                />
                                <FormErrorMessage>{form.errors.new_conf_name}</FormErrorMessage>
                            </FormControl>
                        )}
                    </Field>
                    <Field name="new_conf_short_name" validate={validateShortName}>
                        {({ field, form }: FieldProps<string>) => (
                            <FormControl
                                isInvalid={!!form.errors.new_conf_short_name && !!form.touched.new_conf_short_name}
                                isRequired
                                marginTop="1em"
                            >
                                <FormLabel htmlFor="new_conf_short_name">Short name</FormLabel>
                                <Input
                                    {...{
                                        ...field,
                                        value: normaliseName(field.value, false),
                                    }}
                                    id="new_conf_short_name"
                                    placeholder="Short name"
                                />
                                <FormErrorMessage>{form.errors.new_conf_short_name}</FormErrorMessage>
                            </FormControl>
                        )}
                    </Field>
                    <Field name="new_conf_demo_code" validate={validateDemoCode}>
                        {({ field, form }: FieldProps<string>) => (
                            <FormControl
                                isInvalid={!!form.errors.new_conf_demo_code && !!form.touched.new_conf_demo_code}
                                isRequired
                                marginTop="1em"
                            >
                                <FormLabel htmlFor="new_conf_demo_code">Access code</FormLabel>
                                <InputGroup>
                                    <Input {...field} id="new_conf_demo_code" placeholder="Code" />
                                    <InputRightAddon>
                                        <Tooltip label="To create a conference, please contact us at to receive your access code.">
                                            {"What's this?"}
                                        </Tooltip>
                                    </InputRightAddon>
                                </InputGroup>
                                <FormErrorMessage>{form.errors.new_conf_demo_code}</FormErrorMessage>
                            </FormControl>
                        )}
                    </Field>
                    <Button
                        mt={4}
                        colorScheme="PrimaryActionButton"
                        isLoading={props.isSubmitting}
                        type="submit"
                        isDisabled={!props.isValid}
                    >
                        Create
                    </Button>
                </Form>
            )}
        </Formik>
    );
}
