import { gql } from "@apollo/client/core";
import { LanguageCode } from "@aws-sdk/client-transcribe";
import type { AudioElementBlob, VideoElementBlob } from "@midspace/shared-types/content";
import { AWSJobStatus } from "@midspace/shared-types/content";
import AmazonS3URI from "amazon-s3-uri";
import assert from "assert";
import path from "path";
import type { P } from "pino";
import R from "ramda";
import { assertType, is } from "typescript-is";
import { v4 as uuidv4 } from "uuid";
import {
    CreateTranscriptionJobDocument,
    ElementAddNewVersionDocument,
    GetTranscriptionJobDocument,
} from "../generated/graphql";
import { apolloClient } from "../graphqlClient";
import { S3, Transcribe } from "./aws/awsClient";
import { getS3TextObject } from "./aws/s3";
import { getLatestVersion } from "./element";
import type { AmazonTranscribeOutput } from "./subtitleConvert";
import { convertJsonToSrt } from "./subtitleConvert";

gql`
    mutation CreateTranscriptionJob(
        $awsTranscribeJobName: String!
        $elementId: uuid!
        $videoS3Url: String!
        $transcriptionS3Url: String!
        $languageCode: String!
    ) {
        insert_video_TranscriptionJob_one(
            object: {
                awsTranscribeJobName: $awsTranscribeJobName
                elementId: $elementId
                videoS3Url: $videoS3Url
                transcriptionS3Url: $transcriptionS3Url
                languageCode: $languageCode
            }
        ) {
            id
        }
    }

    query GetTranscriptionJob($awsTranscribeJobName: String!) {
        video_TranscriptionJob(where: { awsTranscribeJobName: { _eq: $awsTranscribeJobName } }) {
            videoS3Url
            elementId
            transcriptionS3Url
            languageCode
            id
        }
    }
`;

function replaceExtension(key: string, extension: string): string {
    return path.posix.format({
        ...path.posix.parse(key),
        base: undefined,
        ext: extension,
    });
}

export async function completeTranscriptionJob(logger: P.Logger, awsTranscribeJobName: string): Promise<void> {
    // Find our stored record of this transcription job
    const transcriptionJobResult = await apolloClient.query({
        query: GetTranscriptionJobDocument,
        variables: {
            awsTranscribeJobName,
        },
    });

    if (transcriptionJobResult.data.video_TranscriptionJob.length !== 1) {
        throw new Error("Could not find the specified transcription job");
    }

    const job = transcriptionJobResult.data.video_TranscriptionJob[0];

    const { latestVersion } = await getLatestVersion(job.elementId);
    assert(latestVersion, `Could not find latest version of content item ${job.elementId}`);

    // Convert the Transcribe output to SRT and save to S3

    const { bucket, key } = AmazonS3URI(job.transcriptionS3Url);
    assert(bucket, "Could not parse bucket from S3 URI");
    assert(key, "Could not parse key from S3 URI");

    const transcriptText = await getS3TextObject(bucket, key);
    const transcriptJson = await JSON.parse(transcriptText);

    assertType<AmazonTranscribeOutput>(transcriptJson);

    const transcriptSrt = convertJsonToSrt(transcriptJson);
    const transcriptSrtKey = replaceExtension(key, ".srt");

    await S3.putObject({
        Bucket: bucket,
        Key: transcriptSrtKey,
        Body: transcriptSrt,
    });

    // Save the new version of the content item
    const newVersion = R.clone(latestVersion);
    assert(
        is<VideoElementBlob>(newVersion.data) || is<AudioElementBlob>(newVersion.data),
        `Content item ${job.elementId} is not a video or audio file.`
    );

    newVersion.data.subtitles = {};
    newVersion.data.subtitles[job.languageCode] = {
        s3Url: `s3://${bucket}/${transcriptSrtKey}`,
        status: AWSJobStatus.Completed,
    };

    newVersion.createdAt = new Date().getTime();
    newVersion.createdBy = "system";

    await apolloClient.mutate({
        mutation: ElementAddNewVersionDocument,
        variables: {
            id: job.elementId,
            newVersion,
        },
    });

    if (transcriptionJobResult.errors) {
        logger.error(
            { elementId: job.elementId, errors: transcriptionJobResult.errors },
            "Failed to record completed transcription"
        );
        throw new Error(`Failed to record completed transcription for ${job.elementId}`);
    }
}

export async function failTranscriptionJob(logger: P.Logger, awsTranscribeJobName: string): Promise<void> {
    // Find our stored record of this transcription job
    const transcriptionJobResult = await apolloClient.query({
        query: GetTranscriptionJobDocument,
        variables: {
            awsTranscribeJobName,
        },
    });

    if (transcriptionJobResult.data.video_TranscriptionJob.length !== 1) {
        throw new Error("Could not find the specified transcription job");
    }

    const job = transcriptionJobResult.data.video_TranscriptionJob[0];

    const { latestVersion } = await getLatestVersion(job.elementId);
    assert(latestVersion, `Could not find latest version of content item ${job.elementId}`);

    // Save the new version of the content item
    const newVersion = R.clone(latestVersion);
    assert(
        is<VideoElementBlob>(newVersion.data) || is<AudioElementBlob>(newVersion.data),
        `Content item ${job.elementId} is not a video or audio file.`
    );

    newVersion.data.subtitles = {};
    newVersion.data.subtitles[job.languageCode] = {
        s3Url: "",
        status: AWSJobStatus.Failed,
        message: `Job ${awsTranscribeJobName} failed`,
    };

    newVersion.createdAt = new Date().getTime();
    newVersion.createdBy = "system";

    await apolloClient.mutate({
        mutation: ElementAddNewVersionDocument,
        variables: {
            id: job.elementId,
            newVersion,
        },
    });

    if (transcriptionJobResult.errors) {
        logger.error(
            { elementId: job.elementId, errors: transcriptionJobResult.errors },
            "Failed to record failure of transcribe"
        );
        throw new Error(`Failed to record failure of transcribe for ${job.elementId}`);
    }
}

export async function startTranscribe(logger: P.Logger, transcodeS3Url: string, elementId: string): Promise<void> {
    logger.info({ transcodeS3Url, elementId }, "Starting transcribe");
    const { bucket, key } = AmazonS3URI(transcodeS3Url);

    if (bucket !== process.env.AWS_CONTENT_BUCKET_ID) {
        logger.error({ bucket, elementId }, "Unexpected S3 bucket");
        throw new Error(`Unexpected S3 bucket: ${bucket}`);
    }

    if (!key) {
        logger.error({ transcodeS3Url, elementId }, "Could not parse S3 URL");
        throw new Error(`Could not parse S3 URL: ${transcodeS3Url}`);
    }

    const outputKey = replaceExtension(key, ".json");

    const transcriptionJobName = uuidv4();

    await Transcribe.startTranscriptionJob({
        Media: {
            MediaFileUri: transcodeS3Url,
        },
        TranscriptionJobName: transcriptionJobName,
        LanguageCode: LanguageCode.EN_US,
        IdentifyLanguage: false,
        JobExecutionSettings: {
            DataAccessRoleArn: process.env.AWS_TRANSCRIBE_SERVICE_ROLE_ARN,
        },
        OutputBucketName: process.env.AWS_CONTENT_BUCKET_ID,
        OutputKey: outputKey,
    });

    await apolloClient.mutate({
        mutation: CreateTranscriptionJobDocument,
        variables: {
            awsTranscribeJobName: transcriptionJobName,
            elementId,
            videoS3Url: transcodeS3Url,
            languageCode: "en_US",
            transcriptionS3Url: `s3://${process.env.AWS_CONTENT_BUCKET_ID}/${outputKey}`,
        },
    });

    logger.info({ transcodeS3Url, elementId }, "Started transcribe");
}
