import { json, text } from "body-parser";
import express, { Request, Response } from "express";
import { assertType } from "typescript-is";
import {
    handleChimeAttendeeJoinedNotification,
    handleChimeAttendeeLeftNotification,
    handleChimeMeetingEndedNotification,
    handleJoinRoom,
} from "../handlers/chime";
import { tryConfirmSubscription, validateSNSNotification } from "../lib/sns/sns";
import { checkEventSecret } from "../middlewares/checkEventSecret";
import {
    ChimeAttendeeJoinedDetail,
    ChimeAttendeeLeftDetail,
    ChimeEventBase,
    ChimeMeetingEndedDetail,
} from "../types/chime";
import { ActionPayload } from "../types/hasura/action";

export const router = express.Router();

// Unprotected routes
router.post("/notify", text(), async (req: Request, res: Response) => {
    console.log(req.originalUrl);

    try {
        const message = await validateSNSNotification(req.body);
        if (!message) {
            res.status(403).json("Access denied");
            return;
        }

        if (message.TopicArn !== process.env.AWS_CHIME_NOTIFICATIONS_TOPIC_ARN) {
            console.log("Received SNS notification for the wrong topic", {
                originalUrl: req.originalUrl,
                topicArn: message.TopicArn,
            });
            res.status(403).json("Access denied");
            return;
        }

        const subscribed = await tryConfirmSubscription(message);
        if (subscribed) {
            res.status(200).json("OK");
            return;
        }

        if (message.Type === "Notification") {
            console.log("Received SNS notification", {
                originalUrl: req.originalUrl,
                messageId: message.MessageId,
                message: message.Message,
            });

            let event: ChimeEventBase;
            try {
                event = JSON.parse(message.Message);
                assertType<ChimeEventBase>(event);
            } catch (err) {
                console.error("Unrecognised notification message", { originalUrl: req.originalUrl, err });
                res.status(500).json("Unrecognised notification message");
                return;
            }

            if (event.detail.eventType === "chime:AttendeeLeft") {
                const detail: ChimeAttendeeLeftDetail = event.detail;
                try {
                    assertType<ChimeAttendeeLeftDetail>(event.detail);
                } catch (err) {
                    console.error("Invalid SNS event detail", {
                        eventType: "chime:AttendeeLeft",
                        eventDetail: event.detail,
                    });
                    res.status(500).json("Invalid event detail");
                    return;
                }

                try {
                    console.log("Received chime:AttendeeLeft notification", detail);
                    await handleChimeAttendeeLeftNotification(detail);
                } catch (err) {
                    console.error("Failure while handling chime:AttendeeLeft event", { err });
                }
                res.status(200).json("OK");
                return;
            }

            if (event.detail.eventType === "chime:AttendeeJoined") {
                const detail: ChimeAttendeeJoinedDetail = event.detail;
                try {
                    assertType<ChimeAttendeeJoinedDetail>(event.detail);
                } catch (err) {
                    console.error("Invalid SNS event detail", {
                        eventType: "chime:AttendeeJoined",
                        eventDetail: event.detail,
                    });
                    res.status(500).json("Invalid event detail");
                    return;
                }

                try {
                    console.log("Received chime:AttendeeJoined notification", detail);
                    await handleChimeAttendeeJoinedNotification(detail);
                } catch (err) {
                    console.error("Failure while handling chime:AttendeeJoined event", { err });
                }
                res.status(200).json("OK");
                return;
            }

            if (event.detail.eventType === "chime:MeetingEnded") {
                const detail: ChimeMeetingEndedDetail = event.detail;
                try {
                    assertType<ChimeMeetingEndedDetail>(event.detail);
                } catch (err) {
                    console.error("Invalid SNS event detail", {
                        eventType: "chime:MeetingEnded",
                        eventDetail: event.detail,
                    });
                    res.status(500).json("Invalid event detail");
                    return;
                }

                try {
                    console.log("Received chime:MeetingEnded notification", detail);
                    await handleChimeMeetingEndedNotification(detail);
                } catch (err) {
                    console.error("Failure while handling chime:MeetingEnded event", { err });
                }
                res.status(200).json("OK");
                return;
            }

            res.status(200).json("OK");
        }
    } catch (err) {
        console.error("Failed to handle request", { originalUrl: req.originalUrl, err });
        res.status(500).json("Failure");
    }
});

// Protected routes
router.use(checkEventSecret);

router.post("/joinRoom", json(), async (req: Request, res: Response<JoinRoomChimeSessionOutput>) => {
    let body: ActionPayload<joinRoomChimeSessionArgs>;
    try {
        body = req.body;
        assertType<ActionPayload<joinRoomChimeSessionArgs>>(body);
    } catch (e) {
        console.error("Invalid request", { url: req.originalUrl, input: req.body.input, err: e });
        return res.status(200).json({
            message: "Invalid request",
        });
    }

    try {
        const result = await handleJoinRoom(body.input, body.session_variables["x-hasura-user-id"]);
        return res.status(200).json(result);
    } catch (e) {
        console.error("Failure while handling request", { url: req.originalUrl, input: req.body.input, err: e });
        return res.status(200).json({
            message: "Failure while handling request",
        });
    }
});