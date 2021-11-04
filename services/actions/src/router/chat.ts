import { checkEventSecret } from "@midspace/auth/middlewares/checkEventSecret";
import type { FlagData, Payload } from "@midspace/hasura/event";
import { json } from "body-parser";
import type { Request, Response } from "express";
import express from "express";
import { assertType } from "typescript-is";
import { handleFlagInserted } from "../handlers/chat";

export const router = express.Router();

// Protected routes
router.use(checkEventSecret);
router.use(json());

router.post("/flag/inserted", async (req: Request, res: Response) => {
    try {
        assertType<Payload<FlagData>>(req.body);
    } catch (e: any) {
        req.log.error(`${req.originalUrl}: received incorrect payload`, e);
        res.status(500).json("Unexpected payload");
        return;
    }
    try {
        await handleFlagInserted(req.log, req.body);
    } catch (e: any) {
        req.log.error("Failure while handling flag inserted", e);
        res.status(500).json("Failure while handling flag inserted");
        return;
    }
    res.status(200).json("OK");
});
