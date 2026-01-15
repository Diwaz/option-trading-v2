import { randomUUIDv7 } from "bun";
import { Router, type Request } from "express";
import { RedisSubscriber } from "../redisSubscriber";
import type {RedisClientType} from 'redis';
import type {ResponseFromEngine} from '../types/types';
import { PrismaClient } from "../generated/prisma/client";
import * as z from "zod";
import { validate } from "../helper/validator";
import { webSocketUsers } from "..";
import { processAgenticMessage } from "../agenticManager";
import { registry } from "@langchain/langgraph/zod";
import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { MessagesZodMeta } from "@langchain/langgraph";


const MessageState = z.object({
  messages: z.array(z.custom<BaseMessage>()).register(registry, MessagesZodMeta),
  llmCalls: z.number().optional()
})


type State = z.infer<typeof MessageState>;
type UserStore = Record<string,State>
type GlobalStore = Record<string,UserStore>

const globalStore:GlobalStore = {}
const state:State ={
  messages:[],
  llmCalls:0,
}

const globalState = new Map<string,State>();

const redisSubscriber = new RedisSubscriber();
const prisma = new PrismaClient();

const createTradeSchema = z.object({
        margin: z.number().positive(),
        leverage: z.number().positive().lt(100),
        asset: z.enum(["SOL_USDC","ETH_USDC","BTC_USDC"]),
        type: z.enum(["buy","sell"]),
        slippage:z.number().positive(),
})
export const payloadSchema = z.object({
    userId: z.string(),
    email:z.email().optional(),
})
const closeOrderSchema = z.object({
    orderId: z.uuid(),
})

const askAgentSchema = z.object({
   humanMessage: z.string().min(1,"String should be  minimum of 5 characters") 

})

export const tradeRoutes = (client:RedisClientType<any>)=>{
    const router = Router();

    router.post("/onRamp", async (req, res) => {
        try {

        
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
    },
    {
TRIM: {
      strategy: "MAXLEN",
      strategyModifier: "~",
      threshold: 100_000
    }
    }

)

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
    } catch(err){
         res.status(411).json({
            message: "Something went wrong"
        });
    }
    // catch here

});


    router.post("/ask-agent",async(req,res)=>{
        const body = validate(askAgentSchema)(req.body);
        const {humanMessage} = body;
        console.log('userId',req.user)
        const payload = validate(payloadSchema)(req.user);
        const {userId} = payload;
        console.log("HUMANNNN MSG",userId)
        const userSocket = webSocketUsers.get(userId);
        if (!userSocket){
            return res.status(404).json({
                success: false,
                error: "Failed to get user"
            })
        }
        // if(!globalStore.userId){
            //       globalStore.userId={
                //           messages:[],
                //           llmCalls:0
                //       }
                //     }
                try {
    const msgState = {
        messages: [],
        llmCalls:0
    }
    if (!globalState.has(userId)){
        globalState.set(userId,msgState)
    }

    
    const projectState:State = globalState.get(userId);
    projectState.messages.push(new HumanMessage(humanMessage))
            await processAgenticMessage(projectState,userSocket)
    res.status(200).json({ message: "Processing your request..." });

        }catch(err){
            return res.status(404).json({
                success: false,
                error: err
            })
        }
    })
    
    
    router.post("/create", async (req, res) => {
        try {

    const startTime = Date.now();

    const body = validate(createTradeSchema)(req.body);
    const payload = validate(payloadSchema)(req.user);

    const {margin,slippage,leverage,asset,type} = body;
    const {userId,email} = payload;

    // console.log("userId",userId)
    // console.log("email",email)

    
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
    },
    {
TRIM: {
      strategy: "MAXLEN",
      strategyModifier: "~",
      threshold: 100_000
    }
    }


)

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
}catch(error){
        res.status(411).json({
            message: "Trade not placeed"
        });
}

});

router.post("/close", async (req, res) => {

    const startTime = Date.now();
     const body = validate(closeOrderSchema)(req.body);
    const payload = validate(payloadSchema)(req.user);

    const {userId} = payload;
    const {orderId} = body;
    
    
    const requestId = randomUUIDv7();

    console.log("sending message to the queue")
    await client.xAdd("order_stream", "*", {
        message: JSON.stringify({
            action:"CLOSE_ORDER",
            userId,
            requestId,
            orderId,
        })
    },
    {
TRIM: {
      strategy: "MAXLEN",
      strategyModifier: "~",
      threshold: 100_000
    }
    }


)

    try {
        const responseFromEngine = await redisSubscriber.waitForMessage(requestId) as ResponseFromEngine;
        console.log('resp from server',responseFromEngine.orderId);

        if (responseFromEngine.action === "FAILED"){
        res.status(404).json({
            message: responseFromEngine.error,
        }) }
        if (responseFromEngine.action === "SUCCESS"){
            res.json({
            message: "Order closed successfully",
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

    const payload = validate(payloadSchema)(req.user);

    const {userId} = payload;

    
    const requestId = randomUUIDv7();

    console.log("sending message to the queue")
    await client.xAdd("order_stream", "*", {
        message: JSON.stringify({
            action:"GET_BALANCE",
            userId,
            requestId,
        })
    },
    {
TRIM: {
      strategy: "MAXLEN",
      strategyModifier: "~",
      threshold: 100_000
    }
    }



)

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
router.get("/closed-orders",async (req,res)=>{

     const payload = validate(payloadSchema)(req.user);

    const {userId} = payload;

    
    try {
    const closedOrders = await prisma.trade.findMany({
        where :{
            userId
        }
    })
    // console.log("closed orders",closedOrders)
        return res.status(200).json({
    closedOrders
})
    
    }catch(err){
        console.log("error fetching closed orders",err)
        return res.status(400).json({
            message:"Something Went Wrong , Please Try again"
        })
    }

})
router.get("/open", async (req, res) => {
    const startTime = Date.now();


   const payload = validate(payloadSchema)(req.user);

    const {userId} = payload;

    
    const requestId = randomUUIDv7();

    console.log("sending message to the queue")
    await client.xAdd("order_stream", "*", {
        message: JSON.stringify({
            action:"GET_OPEN_ORDERS",
            userId,
            requestId,
        })
    },
    {
TRIM: {
      strategy: "MAXLEN",
      strategyModifier: "~",
      threshold: 100_000
    }
    }
)

    try {

        const responseFromEngine = await redisSubscriber.waitForMessage(requestId) as ResponseFromEngine;
        // console.log('resp from server',responseFromEngine.orderId);

        if (responseFromEngine.action === "FAILED"){
        res.status(404).json({
            message: responseFromEngine.error,
        }) }
        if (responseFromEngine.action === "SUCCESS"){
            res.json({
            message: JSON.parse(responseFromEngine.payload!),
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

