import type { ConferenceEntity } from "@midspace/caches/conference";
import { conferenceCache } from "@midspace/caches/conference";
import { conferenceRoomsCache } from "@midspace/caches/conferenceRoom";
import {
    Conference_VisibilityLevel_Enum,
    Registrant_RegistrantRole_Enum,
    Room_ManagementMode_Enum,
    Room_PersonRole_Enum,
} from "@midspace/caches/generated/graphql";
import { registrantCache } from "@midspace/caches/registrant";
import { roomCache } from "@midspace/caches/room";
import { roomMembershipsCache } from "@midspace/caches/roomMembership";
import { subconferenceCache } from "@midspace/caches/subconference";
import { subconferenceRoomsCache } from "@midspace/caches/subconferenceRoom";
import { userCache } from "@midspace/caches/user";
import type { P } from "pino";

/** @summary Output variables (verified) from the auth service - to be used as Hasura session variables. */
export enum AuthSessionVariables {
    Role = "X-Hasura-Role",

    UserId = "X-Hasura-User-Id",
    RegistrantIds = "X-Hasura-Registrant-Ids",
    ConferenceIds = "X-Hasura-Conference-Ids",
    SubconferenceIds = "X-Hasura-Subconference-Ids",
    RoomIds = "X-Hasura-Room-Ids",

    MagicToken = "X-Hasura-Magic-Token",
    InviteCode = "X-Hasura-Invite-Code",
}

enum HasuraRoleNames {
    User = "user",
    Unauthenticated = "unauthenticated",
    MainConferenceOrganizer = "main-conference-organizer",
    Organizer = "organizer",
    Moderator = "moderator",
    Attendee = "attendee",
    Submitter = "submitter",
    RoomAdmin = "room-admin",
    RoomMember = "room-member",
    Superuser = "superuser",
}

/**
 * Search for the given header in a headers(or session variables) object.
 * @param headers An object representing the headers as key-value pairs.
 * @param headerName Name of the header, in title case (e.g. `"X-Foo-Bar"`).
 * @returns The value of the specified header, if found.
 */
export function getAuthHeader(
    headers: Partial<Record<string, string | string[]>>,
    headerName: AuthSessionVariables | string
): string | undefined {
    if (headers[headerName]) {
        const header = headers[headerName];
        if (typeof header === "string" && header.length) {
            return header;
        }
    }
    const lowercaseHeaderName = headerName.toLowerCase();
    if (headers[lowercaseHeaderName]) {
        const header = headers[lowercaseHeaderName];
        if (typeof header === "string" && header.length) {
            return header;
        }
    }
    const uppercaseHeaderName = headerName.toUpperCase();
    if (headers[uppercaseHeaderName]) {
        const header = headers[uppercaseHeaderName];
        if (typeof header === "string" && header.length) {
            return header;
        }
    }

    return undefined;
}

export class ParseHeaderArrayError extends Error {
    constructor(message: string) {
        super(message);
    }
}

/** @summary Parse an array-type Hasura session variable from a header value.
 *  @remarks Hasura session variables are serialised in Postgres-literal format. e.g. `{1,2,3}`.
 *  Does not currently support string literals in array (especially commas inside string literals!).
 *  @returns Array of values in the header.
 *  @emits
 */
export function parseHasuraHeaderArray(value: string): string[] {
    if (value.charAt(0) !== "{") {
        throw new ParseHeaderArrayError("Expected '{' at position 0");
    }
    if (value.charAt(value.length - 1) !== "}") {
        throw new ParseHeaderArrayError(`Expected '{' at position ${value.length - 1}`);
    }
    const innerValue = value.slice(1, -1);
    const values = innerValue
        .split(",")
        .map((v) => (v.charAt(0) === '"' && v.charAt(v.length - 1) === '"' ? v.slice(1, -1) : v))
        .map((v) => (v.charAt(0) === "'" && v.charAt(v.length - 1) === "'" ? v.slice(1, -1) : v));
    return values;
}

function formatArrayForHasuraHeader(values: string | string[]): string {
    if (typeof values === "string") {
        return `{"${values}"}`;
    } else {
        return `{${values.map((x) => `"${x}"`).join(",")}}`;
    }
}

export async function computeAuthHeaders(
    logger: P.Logger,
    verifiedParams: Partial<{ userId: string }>,
    unverifiedParams: Partial<{
        conferenceId: string;
        subconferenceId: string;
        roomId: string;
        magicToken: string;
        inviteCode: string;
        role: string;
        includeRoomIds: boolean;
    }>
): Promise<false | Partial<Record<AuthSessionVariables, string>>> {
    logger.info({ verifiedParams, unverifiedParams }, "Auth webhook inputs");

    // TODO: Do we want to cache the outcome of this logic?
    //          And if so, what is the invalidation strategy?
    //          Particularly given the constraints of redis deleting keys

    if (unverifiedParams.role === HasuraRoleNames.Superuser) {
        if (verifiedParams.userId?.length) {
            // We rely on Hasura permissions to figure this out since it is so
            // infrequent that we don't want to waste space caching these
            // permissions.
            return {
                [AuthSessionVariables.UserId]: verifiedParams.userId,
                [AuthSessionVariables.Role]: HasuraRoleNames.Superuser,
            };
        } else {
            return false;
        }
    }

    if (unverifiedParams.magicToken) {
        return {
            [AuthSessionVariables.Role]: HasuraRoleNames.Submitter,
            [AuthSessionVariables.MagicToken]: unverifiedParams.magicToken,
        };
    }

    if (unverifiedParams.inviteCode) {
        return {
            [AuthSessionVariables.Role]: HasuraRoleNames.Unauthenticated,
            [AuthSessionVariables.InviteCode]: unverifiedParams.inviteCode,
        };
    }

    if (!verifiedParams.userId?.length || unverifiedParams.role === HasuraRoleNames.Unauthenticated) {
        const result: Partial<Record<AuthSessionVariables, string>> = {
            [AuthSessionVariables.Role]: HasuraRoleNames.Unauthenticated,
            [AuthSessionVariables.ConferenceIds]: formatArrayForHasuraHeader([]),
            [AuthSessionVariables.SubconferenceIds]: formatArrayForHasuraHeader([]),
        };

        if (unverifiedParams.conferenceId) {
            const conference = await conferenceCache.getEntity(unverifiedParams.conferenceId);

            if (conference) {
                await evaluateUnauthenticatedConference(conference, result, unverifiedParams);
            }
        }

        return result;
    } else if (verifiedParams.userId?.length) {
        const result: Partial<Record<AuthSessionVariables, string>> = {};
        const allowedRoles: HasuraRoleNames[] = [];
        let requestedRole = (unverifiedParams.role ?? HasuraRoleNames.User) as HasuraRoleNames;

        const user = await userCache.getEntity(verifiedParams.userId);
        if (user) {
            result[AuthSessionVariables.UserId] = user.id;
            allowedRoles.push(HasuraRoleNames.User);

            if (unverifiedParams.conferenceId) {
                const registrantId = user.registrants.find((x) => x.conferenceId === unverifiedParams.conferenceId);
                if (registrantId) {
                    const registrant = await registrantCache.getEntity(registrantId.id);
                    const conference = await conferenceCache.getEntity(unverifiedParams.conferenceId);

                    if (registrant && conference) {
                        result[AuthSessionVariables.RegistrantIds] = formatArrayForHasuraHeader(registrant.id);
                        result[AuthSessionVariables.ConferenceIds] = formatArrayForHasuraHeader(conference.id);

                        if (!unverifiedParams.subconferenceId) {
                            allowedRoles.push(HasuraRoleNames.Attendee);

                            let availableSubconferenceIds: string[] = [];

                            if (registrant.conferenceRole === Registrant_RegistrantRole_Enum.Moderator) {
                                allowedRoles.push(HasuraRoleNames.Moderator);

                                for (const subconferenceId of conference.subconferenceIds) {
                                    const subconference = await subconferenceCache.getEntity(subconferenceId);
                                    if (
                                        subconference?.conferenceVisibilityLevel ===
                                            Conference_VisibilityLevel_Enum.Public ||
                                        subconference?.conferenceVisibilityLevel ===
                                            Conference_VisibilityLevel_Enum.External
                                    ) {
                                        availableSubconferenceIds.push(subconference.id);
                                    }
                                }
                            } else if (registrant.conferenceRole === Registrant_RegistrantRole_Enum.Organizer) {
                                allowedRoles.push(HasuraRoleNames.Moderator);
                                allowedRoles.push(HasuraRoleNames.Organizer);
                                allowedRoles.push(HasuraRoleNames.MainConferenceOrganizer);

                                availableSubconferenceIds = conference.subconferenceIds;
                            } else {
                                for (const subconferenceId of conference.subconferenceIds) {
                                    const subconference = await subconferenceCache.getEntity(subconferenceId);
                                    if (
                                        subconference?.conferenceVisibilityLevel ===
                                            Conference_VisibilityLevel_Enum.Public ||
                                        subconference?.conferenceVisibilityLevel ===
                                            Conference_VisibilityLevel_Enum.External
                                    ) {
                                        availableSubconferenceIds.push(subconference.id);
                                    }
                                }
                            }

                            result[AuthSessionVariables.SubconferenceIds] =
                                formatArrayForHasuraHeader(availableSubconferenceIds);

                            if (unverifiedParams.roomId) {
                                const room = await roomCache.getEntity(unverifiedParams.roomId);
                                if (room) {
                                    if (room.conferenceId === conference.id && !room.subconferenceId) {
                                        if (
                                            allowedRoles.includes(HasuraRoleNames.Moderator) ||
                                            allowedRoles.includes(HasuraRoleNames.Organizer) ||
                                            allowedRoles.includes(HasuraRoleNames.MainConferenceOrganizer)
                                        ) {
                                            result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(room.id);
                                            allowedRoles.push(HasuraRoleNames.RoomAdmin);
                                            allowedRoles.push(HasuraRoleNames.RoomMember);
                                        } else if (room.managementModeName === Room_ManagementMode_Enum.Public) {
                                            result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(room.id);
                                            allowedRoles.push(HasuraRoleNames.RoomMember);
                                        } else {
                                            const role = await roomMembershipsCache.getField(room.id, registrant.id);
                                            if (role) {
                                                result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(
                                                    room.id
                                                );
                                                allowedRoles.push(HasuraRoleNames.RoomMember);

                                                if (role === Room_PersonRole_Enum.Admin) {
                                                    allowedRoles.push(HasuraRoleNames.RoomAdmin);
                                                }
                                            } else {
                                                return false;
                                            }
                                        }
                                    } else {
                                        return false;
                                    }
                                } else {
                                    return false;
                                }
                            } else if (unverifiedParams.includeRoomIds) {
                                allowedRoles.push(HasuraRoleNames.RoomMember);

                                const allRooms: Record<string, string> | undefined =
                                    await conferenceRoomsCache.getEntity(conference.id);
                                if (allRooms) {
                                    for (const subconferenceId of availableSubconferenceIds) {
                                        const allSubconfRooms = await subconferenceRoomsCache.getEntity(
                                            subconferenceId
                                        );
                                        for (const roomId in allSubconfRooms) {
                                            const roomManagementMode = allSubconfRooms[roomId];
                                            allRooms[roomId] = roomManagementMode;
                                        }
                                    }

                                    if (requestedRole === HasuraRoleNames.Organizer) {
                                        if (allowedRoles.includes(requestedRole)) {
                                            const availableRoomIds: string[] = [];
                                            for (const roomId in allRooms) {
                                                const roomManagementMode = allRooms[roomId];
                                                // We exclude DM and Managed Rooms from the catch-all list of rooms
                                                // since the UI currently doesn't need them and the list of ids
                                                // could rapidly become massive / out of bounds.
                                                if (
                                                    roomManagementMode === Room_ManagementMode_Enum.Public ||
                                                    roomManagementMode === Room_ManagementMode_Enum.Private
                                                ) {
                                                    availableRoomIds.push(roomId);
                                                }
                                            }
                                            result[AuthSessionVariables.RoomIds] =
                                                formatArrayForHasuraHeader(availableRoomIds);
                                        } else {
                                            return false;
                                        }
                                    } else {
                                        const availableRoomIds: string[] = [];
                                        for (const roomId in allRooms) {
                                            const roomManagementMode = allRooms[roomId];
                                            if (roomManagementMode === Room_ManagementMode_Enum.Public) {
                                                availableRoomIds.push(roomId);
                                            } else if (
                                                roomManagementMode === Room_ManagementMode_Enum.Private ||
                                                roomManagementMode === Room_ManagementMode_Enum.Managed ||
                                                roomManagementMode === Room_ManagementMode_Enum.Dm
                                            ) {
                                                const roomMembership = await roomMembershipsCache.getField(
                                                    roomId,
                                                    registrant.id
                                                );
                                                if (roomMembership) {
                                                    availableRoomIds.push(roomId);
                                                }
                                            }
                                        }
                                        result[AuthSessionVariables.RoomIds] =
                                            formatArrayForHasuraHeader(availableRoomIds);
                                    }
                                } else {
                                    return false;
                                }
                            } else {
                                result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader([]);
                            }
                        } else {
                            const subconferenceMembership = registrant.subconferenceMemberships.find(
                                (x) => x.subconferenceId === unverifiedParams.subconferenceId
                            );
                            if (subconferenceMembership) {
                                result[AuthSessionVariables.SubconferenceIds] = formatArrayForHasuraHeader(
                                    unverifiedParams.subconferenceId
                                );
                                allowedRoles.push(HasuraRoleNames.Attendee);
                                if (subconferenceMembership.role === Registrant_RegistrantRole_Enum.Moderator) {
                                    allowedRoles.push(HasuraRoleNames.Moderator);
                                } else if (subconferenceMembership.role === Registrant_RegistrantRole_Enum.Organizer) {
                                    allowedRoles.push(HasuraRoleNames.Moderator);
                                    allowedRoles.push(HasuraRoleNames.Organizer);
                                }

                                if (unverifiedParams.roomId) {
                                    const room = await roomCache.getEntity(unverifiedParams.roomId);
                                    if (room) {
                                        if (
                                            room.conferenceId === conference.id &&
                                            room.subconferenceId === subconferenceMembership.subconferenceId
                                        ) {
                                            if (
                                                allowedRoles.includes(HasuraRoleNames.Moderator) ||
                                                allowedRoles.includes(HasuraRoleNames.Organizer)
                                            ) {
                                                result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(
                                                    room.id
                                                );
                                                allowedRoles.push(HasuraRoleNames.RoomAdmin);
                                                allowedRoles.push(HasuraRoleNames.RoomMember);
                                            } else if (room.managementModeName === Room_ManagementMode_Enum.Public) {
                                                result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(
                                                    room.id
                                                );
                                                allowedRoles.push(HasuraRoleNames.RoomMember);
                                            } else {
                                                const role = await roomMembershipsCache.getField(
                                                    room.id,
                                                    registrant.id
                                                );
                                                if (role) {
                                                    result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(
                                                        room.id
                                                    );
                                                    allowedRoles.push(HasuraRoleNames.RoomMember);

                                                    if (role === Room_PersonRole_Enum.Admin) {
                                                        allowedRoles.push(HasuraRoleNames.RoomAdmin);
                                                    }
                                                } else {
                                                    return false;
                                                }
                                            }
                                        } else {
                                            return false;
                                        }
                                    } else {
                                        return false;
                                    }
                                } else if (unverifiedParams.includeRoomIds) {
                                    allowedRoles.push(HasuraRoleNames.RoomMember);

                                    const allRooms = await subconferenceRoomsCache.getEntity(
                                        subconferenceMembership.subconferenceId
                                    );
                                    if (allRooms) {
                                        if (requestedRole === HasuraRoleNames.Organizer) {
                                            if (allowedRoles.includes(requestedRole)) {
                                                const availableRoomIds: string[] = [];
                                                for (const roomId in allRooms) {
                                                    const roomManagementMode = allRooms[roomId];
                                                    // We exclude DM and Managed Rooms from the catch-all list of rooms
                                                    // since the UI currently doesn't need them and the list of ids
                                                    // could rapidly become massive / out of bounds.
                                                    if (
                                                        roomManagementMode === Room_ManagementMode_Enum.Public ||
                                                        roomManagementMode === Room_ManagementMode_Enum.Private
                                                    ) {
                                                        availableRoomIds.push(roomId);
                                                    }
                                                }
                                                result[AuthSessionVariables.RoomIds] =
                                                    formatArrayForHasuraHeader(availableRoomIds);
                                            } else {
                                                return false;
                                            }
                                        } else {
                                            const availableRoomIds: string[] = [];
                                            for (const roomId in allRooms) {
                                                const roomManagementMode = allRooms[roomId];
                                                if (roomManagementMode === Room_ManagementMode_Enum.Public) {
                                                    availableRoomIds.push(roomId);
                                                } else if (
                                                    roomManagementMode === Room_ManagementMode_Enum.Private ||
                                                    roomManagementMode === Room_ManagementMode_Enum.Managed ||
                                                    roomManagementMode === Room_ManagementMode_Enum.Dm
                                                ) {
                                                    const roomMembership = await roomMembershipsCache.getField(
                                                        roomId,
                                                        registrant.id
                                                    );
                                                    if (roomMembership) {
                                                        availableRoomIds.push(roomId);
                                                    }
                                                }
                                            }
                                            result[AuthSessionVariables.RoomIds] =
                                                formatArrayForHasuraHeader(availableRoomIds);
                                        }
                                    } else {
                                        return false;
                                    }
                                } else {
                                    result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader([]);
                                }
                            } else {
                                return false;
                            }
                        }
                    } else {
                        return false;
                    }
                } else {
                    const conference = await conferenceCache.getEntity(unverifiedParams.conferenceId);
                    if (conference) {
                        if (conference.createdBy === user.id) {
                            allowedRoles.push(HasuraRoleNames.Organizer);
                            allowedRoles.push(HasuraRoleNames.MainConferenceOrganizer);
                            result[AuthSessionVariables.ConferenceIds] = formatArrayForHasuraHeader(conference.id);
                        } else {
                            result[AuthSessionVariables.ConferenceIds] = formatArrayForHasuraHeader([]);
                            result[AuthSessionVariables.SubconferenceIds] = formatArrayForHasuraHeader([]);
                            if (await evaluateUnauthenticatedConference(conference, result, unverifiedParams)) {
                                allowedRoles.push(HasuraRoleNames.Unauthenticated);
                                requestedRole = HasuraRoleNames.Unauthenticated;
                            } else {
                                return false;
                            }
                        }
                    } else {
                        return false;
                    }
                }
            } else {
                result[AuthSessionVariables.RegistrantIds] = formatArrayForHasuraHeader(
                    user.registrants.map((x) => x.id)
                );
                result[AuthSessionVariables.ConferenceIds] = formatArrayForHasuraHeader(
                    user.registrants.map((x) => x.conferenceId)
                );
            }
        }

        if (allowedRoles.includes(requestedRole)) {
            result[AuthSessionVariables.Role] = requestedRole;
        } else {
            return false;
        }

        return result;
    }

    return false;
}
async function evaluateUnauthenticatedConference(
    conference: ConferenceEntity,
    result: Partial<Record<AuthSessionVariables, string>>,
    unverifiedParams: Partial<{
        conferenceId: string;
        subconferenceId: string;
        roomId: string;
        magicToken: string;
        inviteCode: string;
        role: string;
        includeRoomIds: boolean;
    }>
): Promise<boolean> {
    if (conference.conferenceVisibilityLevel === Conference_VisibilityLevel_Enum.Public) {
        result[AuthSessionVariables.ConferenceIds] = formatArrayForHasuraHeader(conference.id);

        if (unverifiedParams.subconferenceId) {
            const conferenceVisibilityLevel = await subconferenceCache.getField(
                unverifiedParams.subconferenceId,
                "conferenceVisibilityLevel"
            );

            if (conferenceVisibilityLevel === Conference_VisibilityLevel_Enum.Public) {
                result[AuthSessionVariables.SubconferenceIds] = formatArrayForHasuraHeader(
                    unverifiedParams.subconferenceId
                );
                return true;
            }
        } else {
            // All public subconferences
            const publicSubconferenceIds: string[] = [];
            for (const subconferenceId of conference.subconferenceIds) {
                const conferenceVisibilityLevel = await subconferenceCache.getField(
                    subconferenceId,
                    "conferenceVisibilityLevel"
                );
                if (conferenceVisibilityLevel === Conference_VisibilityLevel_Enum.Public) {
                    publicSubconferenceIds.push(subconferenceId);
                }
            }
            result[AuthSessionVariables.SubconferenceIds] = formatArrayForHasuraHeader(publicSubconferenceIds);
            return true;
        }
    }
    return false;
}