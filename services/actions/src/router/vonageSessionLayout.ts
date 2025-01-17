import { checkEventSecret } from "@midspace/auth/middlewares/checkEventSecret";
import type { EventPayload } from "@midspace/hasura/event";
import type { VonageSessionLayoutData_Record } from "@midspace/hasura/event-data";
import { json } from "body-parser";
import type { Request, Response } from "express";
import express from "express";
import { assertType } from "typescript-is";
import { handleVonageSessionLayoutCreated } from "../handlers/vonageSessionLayout";

export const router = express.Router();

// Protected routes
router.use(checkEventSecret);

router.post("/inserted", json(), async (req: Request, res: Response) => {
    try {
        assertType<EventPayload<VonageSessionLayoutData_Record>>(req.body);
    } catch (e: any) {
        req.log.error({ err: e }, "Received incorrect payload");
        res.status(500).json("Unexpected payload");
        return;
    }
    try {
        await handleVonageSessionLayoutCreated(req.log, req.body);
    } catch (e: any) {
        req.log.error({ err: e }, "Failure while handling vonageSessionLayout inserted");
        res.status(500).json("Failure while handling event");
        return;
    }
    res.status(200).json("OK");
});
