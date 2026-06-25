import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vehicleRouter from "./vehicle";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vehicleRouter);

export default router;
