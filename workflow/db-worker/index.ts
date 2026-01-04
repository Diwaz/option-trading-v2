import { createClient } from "redis"
import { Prisma } from "./prisma"
import nodemailer from "nodemailer";
import { closeTradeEmailHTML } from "./emailTemplate";


const redis = createClient();
const client = redis.duplicate();
await client.connect();

const GROUP = "worker-group";
const CONSUMER = "consumer-1";

const mailCache = new Map<string,boolean>();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, 
  auth: {
    user: "y2kdwz@gmail.com",
    pass: process.env.SMTP_PASS,
  },
});

const sendMail = async (email: string,htmlBody:string) => {
  const info = await transporter.sendMail({
    from: '"Flux Trade" <y2kdwz@gmail.com>',
    to: email,
    subject: "ORDER CLOSE NOTICE",
    html: htmlBody, // HTML body
  });


}

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

const userEmail = await Prisma.user.findUnique({
    where: {
        id: trade.userId
    },
    select : {
        email:true
    }
});
if (process.env.ENVIRONMENT === "DEVELOPMENT"){
    if (!mailCache.has(userEmail?.email as string)) {
        mailCache.set(userEmail?.email as string,true)
        const pnlColor = trade.pnl > 0 ? "green" : "red";
        const htmlBody = closeTradeEmailHTML(trade.asset,(trade.pnl.toFixed(2)),trade.type,(trade.openingPrice/1e4).toString(),(trade.margin/1e4).toString(),trade.type.toUpperCase(),trade.leverage.toString(),(trade.closePrice/1e4).toString(),trade.orderId,pnlColor);
        await sendMail(userEmail?.email as string,htmlBody);
    }

}

} catch(Error) {
    console.log("Failed to Saving to DB")
    throw(Error)
}

console.log("saving this to DB",trade)
}


