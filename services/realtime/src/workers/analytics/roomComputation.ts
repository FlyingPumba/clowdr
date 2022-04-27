import { gqlClient } from "@midspace/component-clients/graphqlClient";
import { gql } from "@urql/core";
import type { Analytics_ListRoomsQuery, Analytics_ListRoomsQueryVariables } from "../../generated/graphql";
import {
    Analytics_FetchRoomPresenceDocument,
    Analytics_InsertRoomPresenceDocument,
    Analytics_ListRoomsDocument,
} from "../../generated/graphql";
import { logger } from "../../lib/logger";
import { getVerifiedPageKey } from "../../lib/presence";
import { ModelName, onBatchUpdate } from "../../rabbitmq/analytics/batchUpdate";

logger.info("Analytics computation worker running");

gql`
    query Analytics_ListRooms($conferenceId: uuid!) {
        conference_Conference_by_pk(id: $conferenceId) {
            id
            slug
        }
        room_Room(where: { conferenceId: { _eq: $conferenceId } }) {
            id
        }
    }

    query Analytics_FetchRoomPresence($offset: Int!, $limit: Int!, $dateCutoff: timestamptz!) {
        analytics_AppStats(
            order_by: { created_at: desc }
            offset: $offset
            limit: $limit
            where: { created_at: { _gt: $dateCutoff } }
        ) {
            created_at
            total_unique_tabs
            total_unique_user_ids
            pages
        }
    }

    mutation Analytics_InsertRoomPresence($roomId: uuid!, $createdAt: timestamptz!, $count: bigint!) {
        insert_analytics_RoomPresence_one(
            object: { roomId: $roomId, created_at: $createdAt, count: $count }
            on_conflict: { constraint: RoomPresence_roomId_created_at_key, update_columns: [] }
        ) {
            count
            roomId
            id
        }
    }
`;

async function onRoomBatchUpdate(conferenceId: string, backdateDistance?: number) {
    backdateDistance =
        backdateDistance ??
        (process.env.ANALYTICS_BACKDATE_CUTOFF
            ? parseInt(process.env.ANALYTICS_BACKDATE_CUTOFF, 10)
            : 7 * 24 * 60 * 60 * 1000);
    const dateCutoff = new Date(Date.now() - backdateDistance).toISOString();

    logger.info(`Rooms Batch Update: Conference Id ${conferenceId} (stats going back to ${dateCutoff})`);

    const roomsResponse = await gqlClient
        ?.query<Analytics_ListRoomsQuery, Analytics_ListRoomsQueryVariables>(Analytics_ListRoomsDocument, {
            conferenceId,
        })
        .toPromise();

    if (roomsResponse?.data && roomsResponse.data.conference_Conference_by_pk) {
        const conferenceSlug = roomsResponse.data.conference_Conference_by_pk.slug;
        const roomIds = roomsResponse.data.room_Room.map((x) => x.id);
        const roomHashes = roomIds.map((roomId) => {
            return {
                id: roomId,
                hash: getVerifiedPageKey(conferenceSlug, `/conference/${conferenceSlug}/room/${roomId}`),
            };
        });

        const batchSize = 100;
        let lastResponseSize = Number.POSITIVE_INFINITY;
        let offset = 0;
        while (lastResponseSize > 0) {
            const statsResponse = await gqlClient
                ?.query(Analytics_FetchRoomPresenceDocument, {
                    limit: batchSize,
                    offset,
                    dateCutoff,
                })
                .toPromise();
            offset += batchSize;
            lastResponseSize = statsResponse?.data.analytics_AppStats.length ?? 0;

            if (statsResponse?.data && statsResponse.data.analytics_AppStats.length > 0) {
                const firstSet = statsResponse.data.analytics_AppStats[0];
                const lastSet = statsResponse.data.analytics_AppStats[statsResponse.data.analytics_AppStats.length - 1];
                const numSets = statsResponse.data.analytics_AppStats.length;
                logger.info(
                    `Rooms Batch Update: Conference Id ${conferenceId}. Processing stat sets for: ${firstSet.created_at} to ${lastSet.created_at} (${numSets} sets) (Offset: ${offset}, Batch size: ${batchSize}, Date cutoff: ${dateCutoff})`
                );

                for (const statSet of statsResponse.data.analytics_AppStats) {
                    try {
                        if (statSet.pages) {
                            await Promise.all(
                                roomHashes.map(async (roomHash) => {
                                    try {
                                        const stat = statSet.pages[`PresenceList:${roomHash.hash}`];
                                        if (typeof stat === "number" && stat > 0) {
                                            await gqlClient
                                                ?.mutation(Analytics_InsertRoomPresenceDocument, {
                                                    roomId: roomHash.id,
                                                    createdAt: statSet.created_at,
                                                    count: stat,
                                                })
                                                .toPromise();
                                        }
                                    } catch (error: any) {
                                        logger.error(
                                            { error },
                                            "Error processing room statistic: " +
                                                conferenceId +
                                                " @ " +
                                                statSet.created_at +
                                                " / " +
                                                roomHash.id +
                                                " / PresenceList:" +
                                                roomHash.hash
                                        );
                                    }
                                })
                            );
                        }
                    } catch (error: any) {
                        logger.error(
                            { error },
                            "Error processing room statistics set: " + conferenceId + " @ " + statSet.created_at
                        );
                    }
                }
            }
        }

        logger.info(`Rooms Batch Update: Conference Id ${conferenceId}: Done processing stat sets.`);
    }
}

async function Main() {
    onBatchUpdate(ModelName.Room, onRoomBatchUpdate);
}

Main();