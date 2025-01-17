import { gqlClient } from "@midspace/component-clients/graphqlClient";
import { gql } from "graphql-tag";
import type { InitializeJobMutation, InitializeJobMutationVariables } from "../generated/graphql";
import { InitializeJobDocument } from "../generated/graphql";
import { publishTask } from "../rabbitmq/tasks";
import { clearLocalJobOutputCache } from "./lib/job";

gql`
    mutation InitializeJob($id: uuid!) {
        update_job_queues_ImportJob_by_pk(
            pk_columns: { id: $id }
            _set: { status: "initialize", completed_at: null, errors: [], progress: 1, progressMaximum: 2 }
        ) {
            id
        }
        delete_job_queues_ImportJobOutput(where: { jobId: { _eq: $id } }) {
            affected_rows
        }
    }
`;

export async function initializeTask(jobId: string): Promise<boolean> {
    clearLocalJobOutputCache();

    await publishTask({
        type: "assign_rooms",
        jobId,
    });

    await gqlClient
        ?.mutation<InitializeJobMutation, InitializeJobMutationVariables>(InitializeJobDocument, {
            id: jobId,
        })
        .toPromise();

    return true;
}
