import { Router } from "express";
import { getBusCacheStatus, getBuses, getBusRoute } from "../controllers/bus.controllers.js";

const router = Router();

router.get("/", getBuses);

router.get("/status", getBusCacheStatus);

router.get("/:id/route", getBusRoute)

export default router;
