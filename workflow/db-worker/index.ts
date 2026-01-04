import { createClient } from "redis"
import { Prisma } from "./prisma"


const redis = createClient();
const client = redis.duplicate();
await client.connect();


const GROUP = "worker-group";
const CONSUMER = "consumer-1";

while (true) {
  const response = await client.xReadGroup(
    GROUP,
    CONSUMER,
    [{ key: "worker-stream", id: ">" }],
    {
      COUNT: 1,
      BLOCK: 0
    }
  );

  if (!response) continue;

  for (const stream of response) {
    for (const message of stream.messages) {
      const { id, message: data } = message;

      console.log("Processing:", id, data);

      await saveToDB(data.data);

      await client.xAck("worker-stream", GROUP, id);
      console.log("ACKD")
    }
  }
}


interface closedOrder {
    action: string,
    userId: string,
    orderId:string,
    type: string,
    margin:number,
    leverage:number,
    asset:string,
    openingPrice:number
    closePrice:number,
    pnl:number
}


async function saveToDB(data:closedOrder) {
const trade:closedOrder = JSON.parse(data)
console.log("parsed data",trade)
try {
await Prisma.trade.create({
    data:{
        tradeId:trade.orderId,
        symbol:trade.asset,
        buyPrice:trade.openingPrice,
        side: trade.type,
        pnl:trade.pnl*1e4, 
        sellPrice:trade.closePrice,
        userId:trade.userId,
        leverage:trade.leverage,
        margin:trade.margin
    }
})
} catch(Error) {
    console.log("Failed to Saving to DB")
    throw(Error)
}

console.log("saving this to DB",trade)
}


