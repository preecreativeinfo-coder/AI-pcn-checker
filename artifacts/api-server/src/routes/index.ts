import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vehicleRouter from "./vehicle";
import analyzeRouter from "./analyze";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vehicleRouter);
router.use(analyzeRouter);

export default router;
