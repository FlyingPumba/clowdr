import { gql } from "@apollo/client/core";
import type { Bunyan } from "@eropple/nestjs-bunyan/dist";
import { RootLogger } from "@eropple/nestjs-bunyan/dist";
import type { ElementDataBlob, VideoBroadcastBlob, VideoElementBlob } from "@midspace/shared-types/content";
import { Content_ElementType_Enum, ElementBaseType, isElementDataBlob } from "@midspace/shared-types/content";
import { Injectable } from "@nestjs/common";
import AmazonS3URI from "amazon-s3-uri";
import * as R from "ramda";
import { ContentElement_GetElementDocument } from "../../generated/graphql";
import { GraphQlService } from "../graphql/graphql.service";

@Injectable()
export class ContentElementDataService {
    private logger: Bunyan;

    constructor(@RootLogger() logger: Bunyan, private graphQlService: GraphQlService) {
        this.logger = logger.child({ component: this.constructor.name });
    }

    public async getElement(elementId: string): Promise<{ conferenceId: string; data: ElementDataBlob } | null> {
        gql`
            query ContentElement_GetElement($elementId: uuid!) {
                content_Element_by_pk(id: $elementId) {
                    id
                    data
                    conferenceId
                }
            }
        `;

        const result = await this.graphQlService.apolloClient.query({
            query: ContentElement_GetElementDocument,
            variables: {
                elementId,
            },
        });

        if (!result.data.content_Element_by_pk || !isElementDataBlob(result.data.content_Element_by_pk.data)) {
            return null;
        }

        return {
            conferenceId: result.data.content_Element_by_pk.conferenceId,
            data: result.data.content_Element_by_pk.data,
        };
    }

    public getVideoKey(videoElementData: VideoElementBlob): string | null {
        if (videoElementData.broadcastTranscode?.s3Url) {
            try {
                const { key } = new AmazonS3URI(videoElementData.broadcastTranscode.s3Url);
                if (!key) {
                    throw new Error("Key in S3 URL was empty");
                }
                return key;
            } catch (err) {
                this.logger.warn(
                    { err, s3Url: videoElementData.broadcastTranscode.s3Url },
                    "Could not parse S3 URL of broadcast transcode."
                );
            }
        }
        if (videoElementData.transcode?.s3Url) {
            try {
                const { key } = new AmazonS3URI(videoElementData.transcode.s3Url);
                if (!key) {
                    throw new Error("Key in S3 URL was empty");
                }
                return key;
            } catch (err) {
                this.logger.warn(
                    { err, s3Url: videoElementData.transcode.s3Url },
                    "Could not parse S3 URL of preview transcode."
                );
            }
        }
        if (videoElementData.s3Url) {
            try {
                const { key } = new AmazonS3URI(videoElementData.s3Url);
                if (!key) {
                    throw new Error("Key in S3 URL was empty");
                }
                return key;
            } catch (err) {
                this.logger.warn({ err, s3Url: videoElementData.s3Url }, "Could not parse S3 URL of original upload.");
            }
        }
        return null;
    }

    getLatestVideoData(contentItemData: unknown): VideoElementBlob | null {
        if (!isElementDataBlob(contentItemData)) {
            return null;
        }
        const contentItemDataBlob: ElementDataBlob = contentItemData as any;

        const latestVersion = R.last(contentItemDataBlob);

        if (!latestVersion) {
            return null;
        }

        if (latestVersion.data.baseType === ElementBaseType.Video) {
            return latestVersion.data;
        }

        return null;
    }

    getLatestBroadcastVideoData(contentItemData: unknown): VideoBroadcastBlob | null {
        if (!isElementDataBlob(contentItemData)) {
            return null;
        }
        const contentItemDataBlob: ElementDataBlob = contentItemData as any;

        const latestVersion = R.last(contentItemDataBlob);

        if (!latestVersion) {
            return null;
        }

        if (
            latestVersion.data.baseType === ElementBaseType.Video &&
            latestVersion.data.type === Content_ElementType_Enum.VideoBroadcast
        ) {
            return latestVersion.data;
        }

        return null;
    }
}
