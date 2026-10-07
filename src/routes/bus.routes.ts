import { Router } from "express";
import { getBuses } from "../controllers/bus.controllers.js";

const router = Router();

router.get("/", getBuses) 
 

export default router;
