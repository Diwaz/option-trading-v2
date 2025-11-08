import { Router } from "express";
import {tradeRoutes} from "./tradeRoutes";


const routes = Router();

routes.use('/trade',tradeRoutes);


export default routes;