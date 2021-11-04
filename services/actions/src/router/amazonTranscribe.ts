import type { TranscribeEvent } from "@midspace/shared-types/sns/transcribe";
import { text } from "body-parser";
import type { Request, Response } from "express";
import express from "express";
import { assertType } from "typescript-is";
import { tryConfirmSubscription, validateSNSNotification } from "../lib/sns/sns";
import { completeTranscriptionJob, failTranscriptionJob } from "../lib/transcribe";

export const router = express.Router();

// Unprotected routes
router.post("/notify", text(), async (req: Request, res: Response) => {
    req.log.info(req.originalUrl);

    try {
        const message = await validateSNSNotification(req.log, req.body);
        if (!message) {
            res.status(403).json("Access denied");
            return;
        }

        if (message.TopicArn !== process.env.AWS_TRANSCRIBE_NOTIFICATIONS_TOPIC_ARN) {
            req.log.info(`${req.originalUrl}: received SNS notification for the wrong topic`, message.TopicArn);
            res.status(403).json("Access denied");
            return;
        }

        const subscribed = await tryConfirmSubscription(req.log, message);
        if (subscribed) {
            res.status(200).json("OK");
            return;
        }

        if (message.Type === "Notification") {
            req.log.info(`${req.originalUrl}: received message`, message.MessageId, message.Message);

            let event: TranscribeEvent;
            try {
                event = JSON.parse(message.Message);
                assertType<TranscribeEvent>(event);
            } catch (err) {
                req.log.error(`${req.originalUrl}: Unrecognised notification message`, err);
                res.status(500).json("Unrecognised notification message");
                return;
            }

            if (event["detail-type"] === "Transcribe Job State Change") {
                if (event.detail.TranscriptionJobStatus === "COMPLETED") {
                    req.log.info("Transcription job completed");
                    await completeTranscriptionJob(req.log, event.detail.TranscriptionJobName);
                } else if (event.detail.TranscriptionJobStatus === "FAILED") {
                    req.log.info("Transcription job failed");
                    await failTranscriptionJob(req.log, event.detail.TranscriptionJobName);
                }
            }
        }

        res.status(200).json("OK");
    } catch (e: any) {
        req.log.error(`${req.originalUrl}: failed to handle request`, e);
        res.status(500).json("Failure");
    }
});
