import { gqlClient } from "@midspace/component-clients/graphqlClient";
import assert from "assert";
import { gql } from "graphql-tag";
import webPush from "web-push";
import type {
    DeletePushNotificationSubscriptionMutation,
    DeletePushNotificationSubscriptionMutationVariables,
} from "../generated/graphql";
import { DeletePushNotificationSubscriptionDocument } from "../generated/graphql";
import { logger } from "../lib/logger";
import type { Notification } from "../types/chat";
import { getVAPIDKeys } from "./vapidKeys";

gql`
    mutation DeletePushNotificationSubscription($endpoint: String!) {
        delete_PushNotificationSubscription_by_pk(endpoint: $endpoint) {
            endpoint
        }
    }
`;

export async function sendNotification(
    subscription: webPush.PushSubscription,
    notification: Notification
): Promise<void> {
    try {
        const vapidKeys = await getVAPIDKeys();
        assert(process.env.HOST_PUBLIC_URL, "Missing env var HOST_PUBLIC_URL");
        await webPush.sendNotification(subscription, JSON.stringify(notification), {
            vapidDetails: {
                ...vapidKeys,
                subject: process.env.HOST_PUBLIC_URL,
            },
        });
    } catch (error: any) {
        if (!(error.toString().includes("unsubscribed") || error.toString().includes("expired"))) {
            logger.warn("ERROR in sending Notification.\nRemoving the endpoint record: " + subscription.endpoint, {
                subscription,
                error,
            });
        }

        try {
            await gqlClient
                ?.mutation<
                    DeletePushNotificationSubscriptionMutation,
                    DeletePushNotificationSubscriptionMutationVariables
                >(DeletePushNotificationSubscriptionDocument, {
                    endpoint: subscription.endpoint,
                })
                .toPromise();
        } catch (error: any) {
            logger.error({ error }, "Unable to delete push notification subscription from the database");
        }
    }
}
