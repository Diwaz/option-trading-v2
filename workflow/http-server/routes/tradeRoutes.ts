import { randomUUIDv7 } from "bun";
import { Router } from "express";
import { RedisSubscriber } from "../redisSubscriber";
import type {RedisClientType} from 'redis';
import type {ResponseFromEngine} from '../types/types';


const redisSubscriber = new RedisSubscriber();
export const tradeRoutes = (client:RedisClientType<any>)=>{
    const router = Router();
    router.post("/create", async (req, res) => {
    console.log("inside the route")
    const startTime = Date.now();
    const {userId,margin,slippage,leverage,asset,type} = req.body;

    if (!userId || !margin || !slippage || !leverage || !asset || !type){
      res.status(404).json({
        message:"Invalid User Input"
      })
    }
    const requestId = randomUUIDv7();

    console.log("sending message to the queue")
    await client.xAdd("order_stream", "*", {
        message: JSON.stringify({
            action:"CREATE_ORDER",
            userId,
            requestId,
            margin,
            slippage,
            leverage,
            asset,
            type
        })
    })

    try {

        const responseFromEngine = await redisSubscriber.waitForMessage(requestId) as ResponseFromEngine;
        console.log('resp from server',responseFromEngine.orderId);
        // res.json({
        //     message: "Order placed",
        //     orderId:responseFromEngine.orderId,
        //     responseTime: Date.now() - startTime
        // })

        if (responseFromEngine.action === "FAILED"){
        res.status(404).json({
            message: responseFromEngine.error,
        }) }
        if (responseFromEngine.action === "SUCCESS"){
            res.status(200).json({
            message: "Order Placed",
            orderId:responseFromEngine.orderId,
            responseTime: Date.now() - startTime
        })

        }

    } catch(e) {
        res.status(411).json({
            message: "Trade not placed"
        });
    }

});

router.post("/close", async (req, res) => {
    const startTime = Date.now();
    const {userId,orderId} = req.body;
    if (!orderId || !userId){
      res.status(400).json({
        message:"Invalid UserId or OrderId"
      })
    }
    const requestId = randomUUIDv7();

    console.log("sending message to the queue")
    await client.xAdd("order_stream", "*", {
        message: JSON.stringify({
            action:"CLOSE_ORDER",
            userId,
            requestId,
            orderId,
        })
    })

    try {

        const responseFromEngine = await redisSubscriber.waitForMessage(requestId) as ResponseFromEngine;
        console.log('resp from server',responseFromEngine.orderId);

        if (responseFromEngine.action === "FAILED"){
        res.status(404).json({
            message: responseFromEngine.error,
        }) }
        if (responseFromEngine.action === "SUCCESS"){
            res.json({
            message: "Order cancled successfully",
            // orderId:responseFromEngine.orderId,
            responseTime: Date.now() - startTime
        })

        }
    } catch(e) {
        res.status(411).json({
            message: "Trade not placed"
        });
    }

});

return router;
}

