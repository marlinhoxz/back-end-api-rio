import { Router } from "express";

import { getLineDirections } from "../controllers/line.controllers.js";

const router = Router();

router.get("/:line/directions", getLineDirections);

export default router;