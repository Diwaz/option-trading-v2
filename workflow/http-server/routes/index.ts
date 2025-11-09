import { Router } from "express";
import {tradeRoutes} from "./tradeRoutes";
import authRoutes from "./auth";


const routes = Router();

routes.use('/auth',authRoutes);


export default routes;