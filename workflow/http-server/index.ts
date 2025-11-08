import express, { request, response } from 'express'
import cors from 'cors';
import morgan from 'morgan';
import { createClient } from 'redis';
import { RedisSubscriber } from './redisSubscriber';
import routes from './routes';
import { tradeRoutes } from './routes/tradeRoutes';

const redisInstance = createClient();
await redisInstance.connect();
const app = express()

interface CreateOrder {
  type: "buy" | "sell",
  margin: number,
  leverage: number,
  asset: string,
}
interface ResponseFromEngine {
  orderId?: string,
  action: String,
  userId?: String

}
interface ResponseFromEngineBalance {
  action: EngineResponse,
  balance: number
}
enum Task {
  CheckBalance,
  CreateOrder,
  CloseOrder,
}
enum EngineResponse {
  ORDER_CREATE_SUCCESS,
  ORDER_CREATE_FAILED,
  ORDER_CANCLE_SUCCESS,
  ORDER_CANDLE_FAILED,
  CHECKBALANCE_SUCCESS,
  CHECKBALANCE_FAILED,
}


app.use(express.json())
app.use(cors())
app.use(morgan('dev'));

// app.post("/api/v1/trade/create", async (req, res) => {
//     console.log("inside the route")
//     const startTime = Date.now();
//     const {userId,margin,slippage,leverage,asset,type} = req.body;

//     if (!userId || !margin || !slippage || !leverage || !asset || !type){
//       res.status(404).json({
//         message:"Invalid User Input"
//       })
//     }
//     const requestId = randomUUIDv7();

//     console.log("sending message to the queue")
//     await client.xAdd("order_stream", "*", {
//         message: JSON.stringify({
//             action:"CREATE_ORDER",
//             userId,
//             requestId,
//             margin,
//             slippage,
//             leverage,
//             asset,
//             type
//         })
//     })

//     try {

//         const responseFromEngine = await redisSubscriber.waitForMessage(requestId);
//         console.log('resp from server',responseFromEngine.orderId);
//         // res.json({
//         //     message: "Order placed",
//         //     orderId:responseFromEngine.orderId,
//         //     responseTime: Date.now() - startTime
//         // })

//         if (responseFromEngine.action === "FAILED"){
//         res.status(404).json({
//             message: responseFromEngine.error,
//         }) }
//         if (responseFromEngine.action === "SUCCESS"){
//             res.status(200).json({
//             message: "Order Placed",
//             orderId:responseFromEngine.orderId,
//             responseTime: Date.now() - startTime
//         })

//         }

//     } catch(e) {
//         res.status(411).json({
//             message: "Trade not placed"
//         });
//     }

// });

// app.post("/api/v1/trade/close", async (req, res) => {
//     const startTime = Date.now();
//     const {userId,orderId} = req.body;
//     if (!orderId || !userId){
//       res.status(400).json({
//         message:"Invalid UserId or OrderId"
//       })
//     }
//     const requestId = randomUUIDv7();

//     console.log("sending message to the queue")
//     await client.xAdd("order_stream", "*", {
//         message: JSON.stringify({
//             action:"CLOSE_ORDER",
//             userId,
//             requestId,
//             orderId,
//         })
//     })

//     try {

//         const responseFromEngine = await redisSubscriber.waitForMessage(requestId);
//         console.log('resp from server',responseFromEngine.orderId);

//         if (responseFromEngine.action === "FAILED"){
//         res.status(404).json({
//             message: responseFromEngine.error,
//         }) }
//         if (responseFromEngine.action === "SUCCESS"){
//             res.json({
//             message: "Order cancled successfully",
//             // orderId:responseFromEngine.orderId,
//             responseTime: Date.now() - startTime
//         })

//         }
//     } catch(e) {
//         res.status(411).json({
//             message: "Trade not placed"
//         });
//     }

// });


app.use('/api/v1/trade/',tradeRoutes(redisInstance));
app.get('/api/v1/checkHealth', async (req, res) => {
  res.status(200).json({
    message: "ok"
  })

});

app.listen(5555, () => {
  console.log("server started to listen");
})

