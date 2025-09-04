import express, { response } from 'express'
import cors from 'cors';
import morgan from 'morgan';
import { createClient } from 'redis';
import { randomUUIDv7, resolve } from 'bun';

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
  orderId: string,
  action: String,

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


app.post('/api/v1/trade/create', async (req, res) => {
  const { userId, asset, margin, leverage, slippage, type } = req.body;

  if (!asset || !margin || !leverage || !slippage || !type) {
    return res.status(400).send("Invalid Input");
  }

  if (leverage < 1 || leverage > 100) {
    return res.status(404).send("Invalid Leverage Input");
  }

  const orderId = randomUUIDv7();

  try {
    const response: ResponseFromEngine = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

      client.subscribe(orderId, (msg) => {
        const data = JSON.parse(msg) as ResponseFromEngine;
        client.unsubscribe(orderId);
        clearTimeout(timeout);
        resolve(data);
      });

      queue.xAdd("orders", "*", {
        action: "ORDERCREATE",
        order_id: orderId,
        user_id: userId,
        side: type,
        margin: margin.toString(),
        leverage: leverage.toString(),
        asset,
        slippage: slippage.toString(),
      });
    });
    console.log("response", response);
    if (response.action === "ORDER_CREATE_FAILED") {
      return res.status(400).json({
        orderId: response.orderId,
        message: "error processing order",
      });
    }

    if (response.action === "ORDER_CREATE_SUCCESS") {
      return res.status(200).json({
        orderId: response.orderId,
      });
    }

    return res.status(500).send("Unknown engine response");
  } catch (err) {
    return res.status(500).send("Error processing order");
  }
});
app.post('/api/v1/trade/close', (req, res) => {
  const { orderId, userId } = req.body;
  if (!orderId) {
    return res.status(404).json({
      message: "Invalid orderId"
    })
  }
  const instruction = {
    data: {
      action: "CLOSEORDER",
      userId,
      orderId
    }
  }


  try {
    const response: ResponseFromEngine = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject()
      }, 20000)
      try {
        client.subscribe(orderId, (msg) => {
          const data = JSON.parse(msg) as ResponseFromEngine;
          clearTimeout(timeout);
          client.unsubscribe(orderId);
          resolve(data)
        })
        queue.xAdd('orders', '*', instruction.data)
      } catch (err) {
        reject(err);
        clearTimeout(timeout);
      }
    })
    if (response.action === "ORDER_CREATE_FAILED") {
      return res.status(400).json({
        message: "error processing order",
        orderId: response.orderId,
      })
    }
    if (response.action === "ORDER_CREATE_SUCCESS") {
      return res.status(200).json({
        orderId: response.orderId,
      })
    }
  }

  catch (err) {
    res.status(400).json(
      {
        message: err
      }
    )
  }

})

app.get('/api/v1/balance', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(404).json({
      message: "Unable to get User"
    })
  }
  const queueId = randomUUIDv7();
  const instruction = {
    action: Task.CheckBalance,
    data: {
      action: "CHECKBALANCE",
      userId
    }
  }


  try {
    const response: ResponseFromEngineBalance = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject()
      }, 20000)
      try {
        client.subscribe(queueId, (msg) => {
          const data = JSON.parse(msg) as ResponseFromEngineBalance;
          clearTimeout(timeout);
          client.unsubscribe(queueId);
          resolve(data)
        })
        queue.xAdd('orders', '*', instruction.data)
      } catch (err) {
        reject(err);
        clearTimeout(timeout);
      }
    })
    if (response.action === EngineResponse.CHECKBALANCE_FAILED) {
      return res.status(400).json({
        message: "error processing order",

      })
    }
    if (response.action === EngineResponse.CHECKBALANCE_SUCCESS) {
      return res.status(200).json({
        balance: response.balance,
      })
    }
  }

  catch (err) {
    res.status(400).json(
      {
        message: err
      }
    )
  }

})
app.listen(5555, () => {
  console.log("server started to listen");
})

