import { createClient } from "redis";



const redis = createClient();
await redis.connect();
const queue = redis.duplicate();
const publisher = redis.duplicate();
await publisher.connect();
await queue.connect();

interface Balance {
  usd_balance: number
}
interface createAccount {
  action: string,
  userId: string
}
interface Trade {
  orderId: string,
  type: "buy" | "sell",
  margin: number,
  leverage: number,
  slippage: number,
  asset: string
}

let openTradesArray: Trade[] = [];
let openTrade: Record<string, Trade[]> = {};
let userBalance: Record<string, Balance> = {};

interface createOrder {
  action: string,
  orderId: string,
  userId: string,
  type: "buy" | "sell",
  margin: string,
  leverage: string,
  asset: string,
  slippage: string

}

const runLoop = async () => {
  while (1) {

    const response = await queue.xRead({
      key: "order_stream",
      id: "$"
    }, {
      BLOCK: 0,
      COUNT: 1
    });
    // const id = response[0].messages[0].id;
    // const name = response[0].name;
    // console.log("response received", response[0]?.messages[0].message);
    console.log('reached here')
    console.log(response[0].messages[0].message.action);
    const payload = response[0]?.messages[0].message;
    const action = response[0].messages[0].message.action;
    // console.log(JSON.parse(response[0].messages[0].message));
    switch (action) {
      case "CREATEACCOUNT":
        console.log("reached here in CREATEACCOUNT");
        initiateUser(payload);
        responseToServer(payload);
        break;
      case "ORDERCREATE":
        console.log("reached here to ORDERCREATE");
        // createOrder(payload);
        break;
      case "ORDERCLOSE":
        console.log("canceling order...");
        break;

      default:
        console.log("here in default");
        break;
    }
  }
}
runLoop();

const initiateUser = (data: createAccount) => {
  console.log("payload userId.....", data.userId);
  // responseToServer(data.userId)
}
const createOrder = (payload: createOrder) => {
  console.log("creating order .......", payload);
  // responseToServer(payload);
}

const responseToServer = (payload) => {
  const orderId = payload.userId;
  console.log("orderId",orderId);
  
  queue.xAdd("callback_queue", "*", {
    id: orderId
  })
  console.log("response sent back");
  
}
