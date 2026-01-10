import { Router } from "express";
import {tradeRoutes} from "./tradeRoutes";
import authRoutes from "./auth";
import candleRoute from "./candles";


const routes = Router();

routes.use('/auth',authRoutes);
routes.use('/candles',candleRoute)


export default routes;