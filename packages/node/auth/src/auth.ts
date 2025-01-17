import type { ConferenceEntity } from "@midspace/caches/conference";
import { ConferenceCache } from "@midspace/caches/conference";
import { conferenceRoomsCache } from "@midspace/caches/conferenceRoom";
import {
    Conference_VisibilityLevel_Enum,
    Registrant_RegistrantRole_Enum,
    Room_ManagementMode_Enum,
    Room_PersonRole_Enum,
} from "@midspace/caches/generated/graphql";
import { RegistrantCache } from "@midspace/caches/registrant";
import { RoomCache } from "@midspace/caches/room";
import { roomMembershipsCache } from "@midspace/caches/roomMembership";
import { SubconferenceCache } from "@midspace/caches/subconference";
import { subconferenceRoomsCache } from "@midspace/caches/subconferenceRoom";
import { UserCache } from "@midspace/caches/user";
import { HasuraRoleName } from "@midspace/shared-types/auth";
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

/**
 * Sorts by highest privilege first: null, organizer, moderator, attendee
 * -1 indicates x before y
 * 0 indicates x equals y
 * 1 indicates x after y
 *
 * Note that null comes first since it denotes such a high level of privilege
 * that no attendee shall ever have it.
 */
function compareRoles(x: Registrant_RegistrantRole_Enum, y?: Registrant_RegistrantRole_Enum | null): -1 | 0 | 1 {
    if (!y) {
        return 1;
    }

    switch (x) {
        case Registrant_RegistrantRole_Enum.Organizer:
            switch (y) {
                case Registrant_RegistrantRole_Enum.Organizer:
                    return 0;
                default:
                    return -1;
            }
        case Registrant_RegistrantRole_Enum.Moderator:
            switch (y) {
                case Registrant_RegistrantRole_Enum.Organizer:
                    return 1;
                case Registrant_RegistrantRole_Enum.Moderator:
                    return 0;
                default:
                    return -1;
            }
        case Registrant_RegistrantRole_Enum.Attendee:
            switch (y) {
                case Registrant_RegistrantRole_Enum.Organizer:
                    return 1;
                case Registrant_RegistrantRole_Enum.Moderator:
                    return 1;
                case Registrant_RegistrantRole_Enum.Attendee:
                    return 0;
            }
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
): Promise<string | Partial<Record<AuthSessionVariables, string>>> {
    logger.trace({ verifiedParams, unverifiedParams }, "Computing auth headers");

    // TODO: Do we want to cache the outcome of this logic?
    //          And if so, what is the invalidation strategy?
    //          Particularly given the constraints of redis deleting keys

    if (unverifiedParams.role === HasuraRoleName.Superuser) {
        if (verifiedParams.userId?.length) {
            // We rely on Hasura permissions to figure this out since it is so
            // infrequent that we don't want to waste space caching these
            // permissions.
            return {
                [AuthSessionVariables.UserId]: verifiedParams.userId,
                [AuthSessionVariables.Role]: HasuraRoleName.Superuser,
            };
        } else {
            return "Superuser requested but no user id present.";
        }
    }

    if (unverifiedParams.magicToken) {
        return {
            [AuthSessionVariables.Role]: HasuraRoleName.Submitter,
            [AuthSessionVariables.MagicToken]: unverifiedParams.magicToken,
        };
    }

    if (unverifiedParams.inviteCode) {
        return {
            [AuthSessionVariables.Role]: HasuraRoleName.Unauthenticated,
            [AuthSessionVariables.InviteCode]: unverifiedParams.inviteCode,
        };
    }

    if (!verifiedParams.userId?.length || unverifiedParams.role === HasuraRoleName.Unauthenticated) {
        const result: Partial<Record<AuthSessionVariables, string>> = {
            [AuthSessionVariables.Role]: HasuraRoleName.Unauthenticated,
            [AuthSessionVariables.ConferenceIds]: formatArrayForHasuraHeader([]),
            [AuthSessionVariables.SubconferenceIds]: formatArrayForHasuraHeader([]),
            [AuthSessionVariables.InviteCode]: "00000000-0000-0000-0000-000000000000",
        };

        if (unverifiedParams.conferenceId && unverifiedParams.conferenceId !== "NONE") {
            const conference = await new ConferenceCache(logger).getEntity(unverifiedParams.conferenceId);

            if (conference) {
                await evaluateUnauthenticatedConference(logger, conference, result, unverifiedParams);
            }
        }

        return result;
    } else if (verifiedParams.userId?.length) {
        const result: Partial<Record<AuthSessionVariables, string>> = {
            [AuthSessionVariables.InviteCode]: "00000000-0000-0000-0000-000000000000",
        };
        const allowedRoles: HasuraRoleName[] = [];
        let requestedRole = (unverifiedParams.role ?? HasuraRoleName.User) as HasuraRoleName;

        const user = await new UserCache(logger).getEntity(verifiedParams.userId);
        if (user) {
            result[AuthSessionVariables.UserId] = user.id;
            allowedRoles.push(HasuraRoleName.User);

            if (unverifiedParams.conferenceId && unverifiedParams.conferenceId !== "NONE") {
                const registrantId = user.registrants.find((x) => x.conferenceId === unverifiedParams.conferenceId);
                if (registrantId) {
                    const registrant = await new RegistrantCache(logger).getEntity(registrantId.id);
                    const conference = await new ConferenceCache(logger).getEntity(unverifiedParams.conferenceId);

                    if (
                        registrant &&
                        conference &&
                        compareRoles(registrant.conferenceRole, conference.lowestRoleWithAccess) <= 0
                    ) {
                        result[AuthSessionVariables.RegistrantIds] = formatArrayForHasuraHeader(registrant.id);
                        result[AuthSessionVariables.ConferenceIds] = formatArrayForHasuraHeader(conference.id);

                        if (!unverifiedParams.subconferenceId) {
                            allowedRoles.push(HasuraRoleName.Attendee);

                            let availableSubconferenceIds: string[] = [];

                            if (registrant.conferenceRole === Registrant_RegistrantRole_Enum.Moderator) {
                                allowedRoles.push(HasuraRoleName.Moderator);

                                const scCache = new SubconferenceCache(logger);
                                await scCache.hydrateIfNecessary({ conferenceId: unverifiedParams.conferenceId });
                                await Promise.all(
                                    conference.subconferenceIds.map(async (subconferenceId) => {
                                        const subconference = await scCache.getEntity(subconferenceId, false);
                                        if (
                                            subconference &&
                                            (subconference?.conferenceVisibilityLevel ===
                                                Conference_VisibilityLevel_Enum.Public ||
                                                subconference?.conferenceVisibilityLevel ===
                                                    Conference_VisibilityLevel_Enum.External ||
                                                registrant.subconferenceMemberships.some(
                                                    (x) => x.subconferenceId === subconference?.id
                                                ))
                                        ) {
                                            availableSubconferenceIds.push(subconference.id);
                                        }
                                    })
                                );
                            } else if (registrant.conferenceRole === Registrant_RegistrantRole_Enum.Organizer) {
                                allowedRoles.push(HasuraRoleName.Moderator);
                                allowedRoles.push(HasuraRoleName.SubconferenceOrganizer);
                                allowedRoles.push(HasuraRoleName.ConferenceOrganizer);

                                availableSubconferenceIds = conference.subconferenceIds;
                            } else {
                                const scCache = new SubconferenceCache(logger);
                                await scCache.hydrateIfNecessary({ conferenceId: unverifiedParams.conferenceId });
                                await Promise.all(
                                    conference.subconferenceIds.map(async (subconferenceId) => {
                                        const subconference = await scCache.getEntity(subconferenceId, false);
                                        if (
                                            subconference &&
                                            (subconference?.conferenceVisibilityLevel ===
                                                Conference_VisibilityLevel_Enum.Public ||
                                                subconference?.conferenceVisibilityLevel ===
                                                    Conference_VisibilityLevel_Enum.External ||
                                                registrant.subconferenceMemberships.some(
                                                    (x) => x.subconferenceId === subconference?.id
                                                ))
                                        ) {
                                            availableSubconferenceIds.push(subconference.id);
                                        }
                                    })
                                );
                            }

                            result[AuthSessionVariables.SubconferenceIds] =
                                formatArrayForHasuraHeader(availableSubconferenceIds);

                            if (unverifiedParams.roomId) {
                                const room = await new RoomCache(logger).getEntity(unverifiedParams.roomId);
                                if (room) {
                                    if (
                                        room.conferenceId === conference.id &&
                                        (!room.subconferenceId ||
                                            registrant.conferenceRole === Registrant_RegistrantRole_Enum.Organizer ||
                                            registrant.subconferenceMemberships.some(
                                                (x) => x.subconferenceId === room.subconferenceId
                                            ))
                                    ) {
                                        if (
                                            allowedRoles.includes(HasuraRoleName.Moderator) ||
                                            allowedRoles.includes(HasuraRoleName.ConferenceOrganizer)
                                        ) {
                                            result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(room.id);
                                            allowedRoles.push(HasuraRoleName.RoomAdmin);
                                            allowedRoles.push(HasuraRoleName.RoomMember);
                                        } else {
                                            const role = await roomMembershipsCache(logger).getField(
                                                room.id,
                                                registrant.id
                                            );
                                            if (role) {
                                                result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(
                                                    room.id
                                                );
                                                allowedRoles.push(HasuraRoleName.RoomMember);

                                                if (role === Room_PersonRole_Enum.Admin) {
                                                    allowedRoles.push(HasuraRoleName.RoomAdmin);
                                                }
                                            } else if (
                                                room.subconferenceId &&
                                                registrant.subconferenceMemberships.some(
                                                    (x) =>
                                                        x.subconferenceId === room.subconferenceId &&
                                                        [
                                                            Registrant_RegistrantRole_Enum.Moderator,
                                                            Registrant_RegistrantRole_Enum.Organizer,
                                                        ].includes(x.role)
                                                )
                                            ) {
                                                result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(
                                                    room.id
                                                );
                                                allowedRoles.push(HasuraRoleName.RoomAdmin);
                                                allowedRoles.push(HasuraRoleName.RoomMember);
                                            } else if (room.managementModeName === Room_ManagementMode_Enum.Public) {
                                                result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(
                                                    room.id
                                                );
                                                allowedRoles.push(HasuraRoleName.RoomMember);
                                            } else {
                                                return "Access to requested room denied - registrant is not a member of the room or organizer of the subconference.";
                                            }
                                        }
                                    } else {
                                        return room.conferenceId !== conference.id
                                            ? "Access to requested room denied - room belongs to a different conference."
                                            : "Access to requested room denied - registrant is not a member of the room's subconference.";
                                    }
                                } else {
                                    return "Access to room denied - room not found.";
                                }
                            } else if (unverifiedParams.includeRoomIds) {
                                allowedRoles.push(HasuraRoleName.RoomMember);

                                // We're going to pre-hydrate the room cache because there is a high chance individual
                                // rooms are about to be requested if "includeRoomIds" was set
                                const rCache = new RoomCache(logger);
                                rCache
                                    .hydrateIfNecessary({
                                        conferenceId: conference.id,
                                    })
                                    .catch((err) => {
                                        logger.error(err, "Error pre-emptively hydrating rooms cache");
                                    });

                                const crCache = conferenceRoomsCache(logger);
                                await crCache.hydrateIfNecessary({ conferenceId: conference.id });
                                const allRooms: Record<string, string> | undefined = await crCache.getEntity(
                                    conference.id,
                                    false
                                );
                                if (allRooms) {
                                    const scrCache = subconferenceRoomsCache(logger);
                                    await scrCache.hydrateIfNecessary({ conferenceId: conference.id });
                                    await Promise.all(
                                        availableSubconferenceIds.map(async (subconferenceId) => {
                                            const allSubconfRooms = await scrCache.getEntity(subconferenceId, false);
                                            for (const roomId in allSubconfRooms) {
                                                const roomManagementMode = allSubconfRooms[roomId];
                                                allRooms[roomId] = roomManagementMode;
                                            }
                                        })
                                    );

                                    if (requestedRole === HasuraRoleName.ConferenceOrganizer) {
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
                                            return `Access to conference denied - ${requestedRole} role requested but registrant is not a conference organizer.`;
                                        }
                                    } else {
                                        const availableRoomIds: string[] = [];
                                        const rmCache = roomMembershipsCache(logger);
                                        await rmCache.hydrateIfNecessary({ conferenceId: conference.id });
                                        await Promise.all(
                                            Object.keys(allRooms).map(async (roomId) => {
                                                const roomManagementMode = allRooms[roomId];
                                                if (roomManagementMode === Room_ManagementMode_Enum.Public) {
                                                    availableRoomIds.push(roomId);
                                                } else if (
                                                    roomManagementMode === Room_ManagementMode_Enum.Private ||
                                                    roomManagementMode === Room_ManagementMode_Enum.Managed ||
                                                    roomManagementMode === Room_ManagementMode_Enum.Dm
                                                ) {
                                                    const roomMembership = await rmCache.getField(
                                                        roomId,
                                                        registrant.id,
                                                        false
                                                    );
                                                    if (roomMembership) {
                                                        availableRoomIds.push(roomId);
                                                    }
                                                }
                                            })
                                        );

                                        result[AuthSessionVariables.RoomIds] =
                                            formatArrayForHasuraHeader(availableRoomIds);
                                    }
                                } else {
                                    return "Unable to include room ids in the response - allRooms was undefined.";
                                }
                            } else {
                                result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader([]);
                            }
                        } else {
                            const subconferenceMembership =
                                registrant.conferenceRole === Registrant_RegistrantRole_Enum.Organizer
                                    ? true
                                    : registrant.subconferenceMemberships.find(
                                          (x) => x.subconferenceId === unverifiedParams.subconferenceId
                                      );
                            if (subconferenceMembership) {
                                result[AuthSessionVariables.SubconferenceIds] = formatArrayForHasuraHeader(
                                    unverifiedParams.subconferenceId
                                );
                                allowedRoles.push(HasuraRoleName.Attendee);
                                if (
                                    subconferenceMembership !== true &&
                                    subconferenceMembership.role === Registrant_RegistrantRole_Enum.Moderator
                                ) {
                                    allowedRoles.push(HasuraRoleName.Moderator);
                                } else if (
                                    subconferenceMembership === true ||
                                    subconferenceMembership.role === Registrant_RegistrantRole_Enum.Organizer
                                ) {
                                    allowedRoles.push(HasuraRoleName.Moderator);
                                    allowedRoles.push(HasuraRoleName.SubconferenceOrganizer);
                                }

                                if (unverifiedParams.roomId) {
                                    const room = await new RoomCache(logger).getEntity(unverifiedParams.roomId);
                                    if (room) {
                                        if (
                                            room.conferenceId === conference.id &&
                                            (subconferenceMembership === true ||
                                                room.subconferenceId === subconferenceMembership.subconferenceId)
                                        ) {
                                            if (
                                                allowedRoles.includes(HasuraRoleName.Moderator) ||
                                                allowedRoles.includes(HasuraRoleName.SubconferenceOrganizer)
                                            ) {
                                                result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(
                                                    room.id
                                                );
                                                allowedRoles.push(HasuraRoleName.RoomAdmin);
                                                allowedRoles.push(HasuraRoleName.RoomMember);
                                            } else {
                                                const role = await roomMembershipsCache(logger).getField(
                                                    room.id,
                                                    registrant.id
                                                );
                                                if (role) {
                                                    result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(
                                                        room.id
                                                    );
                                                    allowedRoles.push(HasuraRoleName.RoomMember);

                                                    if (role === Room_PersonRole_Enum.Admin) {
                                                        allowedRoles.push(HasuraRoleName.RoomAdmin);
                                                    }
                                                } else if (
                                                    room.managementModeName === Room_ManagementMode_Enum.Public
                                                ) {
                                                    result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader(
                                                        room.id
                                                    );
                                                    allowedRoles.push(HasuraRoleName.RoomMember);
                                                } else {
                                                    return "Access to requested room denied - [subconference room] registrant is not a member of the room.";
                                                }
                                            }
                                        } else {
                                            return room.conferenceId !== conference.id
                                                ? "Access to requested room denied - [subconference room] room belongs to a different conference."
                                                : "Access to requested room denied - [subconference room] registrant is not a member of the room's subconference.";
                                        }
                                    } else {
                                        return "Access to room denied - [subconference room] room not found.";
                                    }
                                } else if (unverifiedParams.includeRoomIds) {
                                    allowedRoles.push(HasuraRoleName.RoomMember);

                                    // We're going to pre-hydrate the room cache because there is a high chance individual
                                    // rooms are about to be requested if "includeRoomIds" was set
                                    const rCache = new RoomCache(logger);
                                    rCache
                                        .hydrateIfNecessary({
                                            conferenceId: conference.id,
                                        })
                                        .catch((err) => {
                                            logger.error(err, "Error pre-emptively hydrating rooms cache");
                                        });

                                    const scrCache = subconferenceRoomsCache(logger);
                                    await scrCache.hydrateIfNecessary({
                                        subconferenceId: unverifiedParams.subconferenceId,
                                    });
                                    const allRooms = await scrCache.getEntity(unverifiedParams.subconferenceId, false);
                                    if (allRooms) {
                                        if (
                                            requestedRole === HasuraRoleName.ConferenceOrganizer ||
                                            requestedRole === HasuraRoleName.SubconferenceOrganizer
                                        ) {
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
                                                return `Access to conference denied - ${requestedRole} role requested but registrant is not a conference organizer nor a subconference organizer.`;
                                            }
                                        } else {
                                            const availableRoomIds: string[] = [];
                                            const rmCache = roomMembershipsCache(logger);
                                            await rmCache.hydrateIfNecessary({ registrantId: registrant.id });
                                            for (const roomId in allRooms) {
                                                const roomManagementMode = allRooms[roomId];
                                                if (roomManagementMode === Room_ManagementMode_Enum.Public) {
                                                    availableRoomIds.push(roomId);
                                                } else if (
                                                    roomManagementMode === Room_ManagementMode_Enum.Private ||
                                                    roomManagementMode === Room_ManagementMode_Enum.Managed ||
                                                    roomManagementMode === Room_ManagementMode_Enum.Dm
                                                ) {
                                                    const roomMembership = await rmCache.getField(
                                                        roomId,
                                                        registrant.id,
                                                        false
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
                                        return "Unable to include room ids in the response - [subconference] allRooms was undefined.";
                                    }
                                } else {
                                    result[AuthSessionVariables.RoomIds] = formatArrayForHasuraHeader([]);
                                }
                            } else {
                                return "Unable to include room ids in the response - [subconference] allRooms was undefined.";
                            }
                        }
                    } else {
                        return !registrant
                            ? "Access to conference denied - registrant not found."
                            : !conference
                            ? "Access to conference denied - conference not found."
                            : `Access to conference denied - registrant does not have access at the moment. Registrant role: ${registrant.conferenceRole}, Lowest role with access: ${conference.lowestRoleWithAccess}`;
                    }
                } else {
                    const conference = await new ConferenceCache(logger).getEntity(unverifiedParams.conferenceId);
                    if (conference) {
                        if (conference.createdBy === user.id) {
                            allowedRoles.push(HasuraRoleName.SubconferenceOrganizer);
                            allowedRoles.push(HasuraRoleName.ConferenceOrganizer);
                            result[AuthSessionVariables.ConferenceIds] = formatArrayForHasuraHeader(conference.id);
                        } else {
                            result[AuthSessionVariables.ConferenceIds] = formatArrayForHasuraHeader([]);
                            result[AuthSessionVariables.SubconferenceIds] = formatArrayForHasuraHeader([]);

                            if (await evaluateUnauthenticatedConference(logger, conference, result, unverifiedParams)) {
                                allowedRoles.push(HasuraRoleName.Unauthenticated);
                                requestedRole = HasuraRoleName.Unauthenticated;
                            } else {
                                return "Access to conference denied - no registrant specified, the user is not the conference creator and unauthenticated access is not permitted for this conference.";
                            }
                        }
                    } else {
                        return "Access to conference denied - conference not found.";
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
            return `Access denied - requested role (${requestedRole}) not in the set of allowed roles (${JSON.stringify(
                allowedRoles,
                null,
                2
            )})`;
        }

        return result;
    }

    return "Access denied - fell through all cases.";
}
async function evaluateUnauthenticatedConference(
    logger: P.Logger,
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
            const conferenceVisibilityLevel = await new SubconferenceCache(logger).getField(
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
            const scCache = new SubconferenceCache(logger);
            await scCache.hydrateIfNecessary({ conferenceId: conference.id });
            await Promise.all(
                conference.subconferenceIds.map(async (subconferenceId) => {
                    const conferenceVisibilityLevel = await scCache.getField(
                        subconferenceId,
                        "conferenceVisibilityLevel",
                        false
                    );
                    if (conferenceVisibilityLevel === Conference_VisibilityLevel_Enum.Public) {
                        publicSubconferenceIds.push(subconferenceId);
                    }
                })
            );
            result[AuthSessionVariables.SubconferenceIds] = formatArrayForHasuraHeader(publicSubconferenceIds);
            return true;
        }
    }
    return false;
}
