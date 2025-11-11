import { randomUUIDv7 } from "bun";
import { Router } from "express";
import { RedisSubscriber } from "../redisSubscriber";
import type {RedisClientType} from 'redis';
import type {ResponseFromEngine} from '../types/types';
import { PrismaClient } from "../generated/prisma/client";


const redisSubscriber = new RedisSubscriber();
const prisma = new PrismaClient();
export const tradeRoutes = (client:RedisClientType<any>)=>{
    const router = Router();

    router.post("/onRamp", async (req, res) => {
    console.log("inside the route")
    const startTime = Date.now();
    const {email} = req.body;
    // console.log("userId",userId)

    if (!email){
      res.status(404).json({
        message:"Invalid User Input"
      })
    }
    const user = await prisma.user.findUnique({
        where:{
            email
        }
    })
    if (!user){
        return res.status(400).json({
            error:"Unable to create account"
        })
    }
    const {id} = user;


    const requestId = randomUUIDv7();

    console.log("sending message to the queue")
    await client.xAdd("order_stream", "*", {
        message: JSON.stringify({
            action:"CREATE_ACCOUNT",
            userId:id,
            requestId,
        })
    })

    try {

        const responseFromEngine = await redisSubscriber.waitForMessage(requestId) as ResponseFromEngine;

        if (responseFromEngine.action === "FAILED"){
        res.status(404).json({
            message: responseFromEngine.error,
        }) }
        if (responseFromEngine.action === "SUCCESS"){
            res.status(200).json({
            message: "User Registered Successfully",
            orderId:responseFromEngine.orderId,
            responseTime: Date.now() - startTime
        })

        }

    } catch(e) {
        res.status(411).json({
            message: "Unable to init User"
        });
    }

});
    router.post("/create", async (req, res) => {
    console.log("inside the route")
    const startTime = Date.now();
    const {margin,slippage,leverage,asset,type} = req.body;
    const {userId,email} = req.user;
    console.log("userId",userId)
    console.log("email",email)

    if (!userId || !margin || !leverage || !asset || !type){
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
    const {orderId} = req.body;
    const {userId} = req.user;
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
        if (responseFromEngine.action === "LIQUIDATED"){
            res.json({
            message: "Order Already Liquidated",
            responseTime: Date.now() - startTime
        })

        }
    } catch(e) {
        res.status(411).json({
            message: "Trade not placed"
        });
    }

});
router.post("/balance", async (req, res) => {
    const startTime = Date.now();
    const {userId} = req.user;
    if ( !userId){
      res.status(400).json({
        message:"Invalid UserId"
      })
    }
    const requestId = randomUUIDv7();

    console.log("sending message to the queue")
    await client.xAdd("order_stream", "*", {
        message: JSON.stringify({
            action:"GET_BALANCE",
            userId,
            requestId,
        })
    })

    try {

        const responseFromEngine = await redisSubscriber.waitForMessage(requestId) as ResponseFromEngine;
        // console.log('resp from server',responseFromEngine.orderId);

        if (responseFromEngine.action === "FAILED"){
        res.status(404).json({
            message: responseFromEngine.error,
        }) }
        if (responseFromEngine.action === "SUCCESS"){
            res.json({
            message: responseFromEngine.orderId,
            responseTime: Date.now() - startTime
        })

        }
    } catch(e) {
        res.status(411).json({
            message: "Error Retriving Message"
        });
    }

});

return router;
}

