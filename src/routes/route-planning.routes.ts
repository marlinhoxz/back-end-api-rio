
import { Router } from "express";
import { planRoute } from "../controllers/route-planning.controllers.js";

const router = Router();

router.get("/plan", planRoute);

export default router;
