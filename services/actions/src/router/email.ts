import { EventWebhook, EventWebhookHeader } from "@sendgrid/eventwebhook";
import { text } from "body-parser";
import express, { NextFunction, Request, Response } from "express";
import { initSGMail, processEmailWebhook } from "../handlers/email";
import { UnexpectedServerError } from "../lib/errors";
import { logger } from "../lib/logger";

export const router = express.Router();

function verifyRequest(publicKey: string, payload: string | Buffer, signature: string, timestamp: string) {
    const eventWebhook = new EventWebhook();
    const ecPublicKey = eventWebhook.convertPublicKeyToECDSA(publicKey);
    return eventWebhook.verifySignature(ecPublicKey, payload, signature, timestamp);
}

router.use(text({ type: "application/json" }));

router.post("/webhook", async (req: Request, resp: Response, next: NextFunction) => {
    try {
        const sgMailParams = await initSGMail(logger);
        if (sgMailParams) {
            const key = sgMailParams.webhookPublicKey;
            const signature = req.get(EventWebhookHeader.SIGNATURE());
            const timestamp = req.get(EventWebhookHeader.TIMESTAMP());
            const requestBody = req.body;

            if (signature && timestamp && verifyRequest(key, requestBody, signature, timestamp)) {
                await processEmailWebhook(JSON.parse(requestBody));
                resp.sendStatus(204);
            } else {
                resp.sendStatus(403);
            }
        } else {
            resp.sendStatus(204);
        }
    } catch (err: unknown) {
        if (err instanceof Error) {
            next(err);
        } else {
            next(new UnexpectedServerError("Server error", undefined, err));
        }
    }
});
