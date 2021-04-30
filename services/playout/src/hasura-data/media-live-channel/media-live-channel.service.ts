import { gql } from "@apollo/client/core";
import { Bunyan, RootLogger } from "@eropple/nestjs-bunyan";
import { Injectable } from "@nestjs/common";
import { ChannelStackDescription } from "../../channel-stack/channel-stack/channelStack";
import {
    CreateMediaLiveChannelDocument,
    DeleteMediaLiveChannelDocument,
    FindMediaLiveChannelsByStackArnDocument,
    GetMediaLiveChannelByRoomDocument,
} from "../../generated/graphql";
import { GraphQlService } from "../graphql/graphql.service";
import { ChannelStackDetails } from "./channel-stack-details";

@Injectable()
export class MediaLiveChannelService {
    private logger: Bunyan;

    constructor(@RootLogger() logger: Bunyan, private graphQlService: GraphQlService) {
        this.logger = logger.child({ component: this.constructor.name });
    }

    public async getChannelStackDetails(roomId: string): Promise<ChannelStackDetails | null> {
        gql`
            query GetMediaLiveChannelByRoom($roomId: uuid!) {
                Room_by_pk(id: $roomId) {
                    id
                    conferenceId
                    mediaLiveChannel {
                        id
                        mediaLiveChannelId
                        mp4InputAttachmentName
                        vonageInputAttachmentName
                        loopingMp4InputAttachmentName
                    }
                }
            }
        `;
        const channelResult = await this.graphQlService.apolloClient.query({
            query: GetMediaLiveChannelByRoomDocument,
            variables: {
                roomId,
            },
        });

        if (!channelResult.data.Room_by_pk?.mediaLiveChannel) {
            return null;
        }

        return {
            id: channelResult.data.Room_by_pk.mediaLiveChannel.id,
            roomId,
            conferenceId: channelResult.data.Room_by_pk.conferenceId,
            mediaLiveChannelId: channelResult.data.Room_by_pk.mediaLiveChannel.mediaLiveChannelId,
            mp4InputAttachmentName: channelResult.data.Room_by_pk.mediaLiveChannel.mp4InputAttachmentName,
            vonageInputAttachmentName: channelResult.data.Room_by_pk.mediaLiveChannel.vonageInputAttachmentName,
            loopingMp4InputAttachmentName: channelResult.data.Room_by_pk.mediaLiveChannel.loopingMp4InputAttachmentName,
        };
    }

    public async createMediaLiveChannel(
        stackDescription: ChannelStackDescription,
        cloudFormationStackArn: string,
        jobId: string,
        conferenceId: string,
        roomId: string
    ): Promise<void> {
        gql`
            mutation CreateMediaLiveChannel(
                $cloudFormationStackArn: String!
                $cloudFrontDistributionId: String!
                $mediaLiveChannelId: String!
                $mediaPackageChannelId: String!
                $mp4InputId: String!
                $rtmpInputId: String!
                $rtmpInputUri: String!
                $endpointUri: String!
                $cloudFrontDomain: String!
                $mp4InputAttachmentName: String!
                $loopingMp4InputAttachmentName: String!
                $vonageInputAttachmentName: String!
                $conferenceId: uuid!
                $channelStackCreateJobId: uuid!
                $roomId: uuid!
            ) {
                insert_video_MediaLiveChannel_one(
                    object: {
                        cloudFormationStackArn: $cloudFormationStackArn
                        cloudFrontDistributionId: $cloudFrontDistributionId
                        mediaLiveChannelId: $mediaLiveChannelId
                        mediaPackageChannelId: $mediaPackageChannelId
                        mp4InputId: $mp4InputId
                        rtmpInputId: $rtmpInputId
                        rtmpInputUri: $rtmpInputUri
                        endpointUri: $endpointUri
                        cloudFrontDomain: $cloudFrontDomain
                        mp4InputAttachmentName: $mp4InputAttachmentName
                        loopingMp4InputAttachmentName: $loopingMp4InputAttachmentName
                        vonageInputAttachmentName: $vonageInputAttachmentName
                        conferenceId: $conferenceId
                        channelStackCreateJobId: $channelStackCreateJobId
                        roomId: $roomId
                    }
                ) {
                    id
                }
            }
        `;

        const result = await this.graphQlService.apolloClient.mutate({
            mutation: CreateMediaLiveChannelDocument,
            variables: {
                channelStackCreateJobId: jobId,
                cloudFormationStackArn,
                cloudFrontDistributionId: stackDescription.cloudFrontDistributionId,
                cloudFrontDomain: stackDescription.cloudFrontDomain,
                conferenceId,
                endpointUri: stackDescription.endpointUri,
                loopingMp4InputAttachmentName: stackDescription.loopingMp4InputAttachmentName,
                mediaLiveChannelId: stackDescription.mediaLiveChannelId,
                mediaPackageChannelId: stackDescription.mediaPackageChannelId,
                mp4InputAttachmentName: stackDescription.mp4InputAttachmentName,
                mp4InputId: stackDescription.mp4InputId,
                rtmpInputId: stackDescription.rtmpAInputId,
                rtmpInputUri: stackDescription.rtmpAInputUri,
                vonageInputAttachmentName: stackDescription.rtmpAInputAttachmentName,
                roomId,
            },
        });

        this.logger.info(
            {
                mediaLiveChannelId: result.data?.insert_video_MediaLiveChannel_one?.id,
            },
            "Created MediaLiveChannel"
        );
    }

    /**
     * @summary Deletes the database entry for a MediaLive channel stack
     */
    public async deleteMediaLiveChannel(
        mediaLiveChannelId: string
    ): Promise<{ cloudFormationStackArn?: string | null }> {
        gql`
            mutation DeleteMediaLiveChannel($id: uuid!) {
                delete_video_MediaLiveChannel_by_pk(id: $id) {
                    id
                    cloudFormationStackArn
                }
            }
        `;

        const result = await this.graphQlService.apolloClient.mutate({
            mutation: DeleteMediaLiveChannelDocument,
            variables: {
                id: mediaLiveChannelId,
            },
        });

        return { cloudFormationStackArn: result.data?.delete_video_MediaLiveChannel_by_pk?.cloudFormationStackArn };
    }

    public async findMediaLiveChannelsByStackArn(stackArn: string): Promise<string[]> {
        gql`
            query FindMediaLiveChannelsByStackArn($stackArn: String!) {
                video_MediaLiveChannel(where: { cloudFormationStackArn: { _eq: $stackArn } }) {
                    id
                }
            }
        `;

        const result = await this.graphQlService.apolloClient.query({
            query: FindMediaLiveChannelsByStackArnDocument,
            variables: {
                stackArn,
            },
        });
        return result.data.video_MediaLiveChannel.map((c) => c.id);
    }
}