import express, { response } from 'express'
import cors from 'cors';
import morgan from 'morgan';
import { createClient } from 'redis';
import { randomUUIDv7, resolve } from 'bun';
import { RedisSubscriber } from './redisSubscriber';

const redis = createClient();
const queue = redis.duplicate()
const client = redis.duplicate()
await queue.connect();
await client.connect();
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

async function sendAndWait(
  orderId: string,
  payload: Record<string, any>,
  res: any
) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout: No response from engine"));
    }, 10000);
    await queue.xAdd("order_stream", "*", payload);

    try {
      let lastId = "$";

      while (true) {
        const messages = await queue.xRead(
          [{ key: "order_stream", id: lastId }],
          { BLOCK: 0, COUNT: 1 }
        );

        if (!messages) continue;
        console.log("reached here",messages);
        
        for (const stream of messages) {
          for (const msg of stream.messages) {
            lastId = msg.id;
            console.log("response id ",msg);
            
            const { orderId: respOrderId, response } = msg.message;
            if (respOrderId === orderId) {
              clearTimeout(timeout);
              res.json({ message: JSON.parse(response) });
              return resolve(true);
            }
          }
        }
      }
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

app.post('/api/v1/user/signup', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(411).json({
      message: "Invalid User Id"
    })
  }
  const payload = {
    action: 'CREATEACCOUNT',
    userId,
  }
  const response = await sendAndWait(userId,payload,res);

  res.status(200).json(response)

});

app.post('/api/v1/trade/create', async (req, res) => {
  const { userId,asset,slippage,margin,leverage,type } = req.body;

  if (!userId) {
    return res.status(411).json({
      message: "Invalid User Id"
    })
  }
  if (!asset || !margin || !slippage || !leverage || !type){
    return res.status(404).json({
      message: "Invalid input"
    })
  }
  const payload = {
    action: 'CREATE_ORDER',
    userId,
    margin: margin.toString(),
    leverage: leverage.toString(),
    asset,
    slippage:slippage.toString(),
    type
  }
  const response = await sendAndWait(userId,payload,res);

  res.status(200).json(response)

});

app.post('/api/v1/trade/close', async (req, res) => {
  const { userId,orderId } = req.body;

  if (!userId) {
    return res.status(411).json({
      message: "Invalid User Id"
    })
  }
  if (!orderId){
    return res.status(404).json({
      message:"Invalid order Id"
    })
  }

  const payload = {
    action: 'CLOSE_ORDER',
    userId,
    orderId
  }
  const response = await sendAndWait(userId,payload,res);

  res.status(200).json(response)

});


app.get('/api/v1/checkHealth', async (req, res) => {
  res.status(200).json({
    message: "ok"
  })

});

app.listen(5555, () => {
  console.log("server started to listen");
})

