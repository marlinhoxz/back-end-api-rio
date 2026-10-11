import { Router } from "express";
import { getBusCacheStatus, getBuses } from "../controllers/bus.controllers.js";

const router = Router();

router.get("/", getBuses);

router.get("/status", getBusCacheStatus);

export default router;
