import { randomUUIDv7 } from "bun";
import { createClient } from "redis";



const redis = createClient();
await redis.connect();
const queue = redis.duplicate();
const publisher = redis.duplicate();
await publisher.connect();
await queue.connect();

// interface Balance {
//   usd_balance: number
// }
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
  asset: string,
  openingPrice:number,
}

interface closedTrade extends Trade  {
  closePrice:number,
  pnl: number
}

let openTradesArray: Trade[] = [];
let openTrades: Record<string, {trades: Trade[]}> = {};
let userBalance: Record<string, {usd_balance:number}> = {};
const closedTrades :Record<string,{trades:closedTrade[]}>={};
let snapShot :Record<string,any> = {};

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
interface closeOrder {
  userId:string,
  orderId:string
}

interface Asset {
  bid:number,
  ask:number
}
let marketPrice :Record<string,Asset>= {};
const runLoop = async () => {
  while (1) {

    const response = await queue.xRead({
      key: "order_stream",
      id: "$"
    }, {
      BLOCK: 0,
      COUNT: 1
    }) ;
    const payload = JSON.parse(response[0].messages[0].message.message);
    console.log(JSON.parse(response[0].messages[0].message.message).action);
    const action = JSON.parse(response[0].messages[0].message.message).action;
    
    switch (action) {
      case "CREATEACCOUNT":
        console.log("reached here in CREATEACCOUNT");
        // initiateUser(payload);
        responseToServer(payload);
        // loadSnapShot();
        console.log("openTrades",openTrades)
        console.log("openTradesArray",openTradesArray)
        console.log("userbalance",userBalance)
        break;
      case "CREATE_ORDER":
        console.log("reached here to ORDERCREATE");
        // createOrder(payload);
        createOrder(payload)
        break;
      case "CLOSE_ORDER":
        console.log("canceling order...");
        closeOrder(payload);
        break;
      case "PRICE_UPDATE":
        // console.log('updating price',payload);
        marketPrice[payload.asset]= {
          bid:parseInt(payload.buy),
          ask:parseInt(payload.ask)
        }
        liquidationEngine({
          bid:parseInt(payload.buy),
          ask:parseInt(payload.ask)
        })
        // console.log(marketPrice);
        break;
      default:
        console.log("here in default");
        break;
    }
  }
}
runLoop();
export const initBalanceForUser = (userId: string) => {
  userBalance[userId] = { usd_balance:  5000 }; // default starting balance
};

export const updateBalanceForClosedOrder = (userId:string,pnl:number,liquidation:boolean,margin:number) => {
  // if (!userBalance[userId]){
  //   userBalance[userId]={usd_balance:5000};
  // }  
  if (!userBalance[userId]) {
    userBalance[userId] = { usd_balance: 0 };
  }
  if(!liquidation){
    userBalance[userId].usd_balance += pnl;
  }
    
}
export const updateBalanceForUser = (
  userId:string,
  margin: number,
  type : "buy" | "sell",
)=>{

      let balance = userBalance[userId] ?? {usd_balance:0};
      console.log("type of trade",margin/1e2);
      
      if (type === "buy"){
        // deduct user balance
        // 1 . get margin 
        balance.usd_balance  -= (margin/1e2);
        console.log('stock buy worth',margin);

      }
      if (type === "sell"){
        balance.usd_balance -= (margin/1e2);
      }
}


const addTrades = (userId: string , trade: Trade) =>{
    try {
      if (!userId || !trade){
        return false;
      }
       if (!openTrades[userId]) {
        openTrades[userId] = { trades:[]}; 
      }
      openTrades[userId]?.trades.push(trade);
      openTradesArray.push(trade);
      // mapUserToTrades[userId]?.push(trade.orderId);
      console.log('openTradesArray',openTradesArray);
      // console.log('mapUserToTrades',mapUserToTrades);
      return true;
} catch(err){
  return false ;
}
  
}
export const closeTrade = (userId:string,orderId:string,liquidation:boolean) => {

  const user= openTrades[userId];

  if (!user) return null;

  const tradeIndex = user.trades.findIndex(i=>i.orderId === orderId);
  const tradeArrayIndex = openTradesArray.findIndex(i=>i.orderId === orderId);
  const trade  = user.trades[tradeIndex] as Trade;
  const asset = trade?.asset ?? "ETH";
  const closingPrice = marketPrice[asset]?.bid ?? 0;

  // calculate pnl 
  // openingQty = trade.openingPrice/margin
  // TotalPnl = closingPrice - trade.openingPrice;
  // netPnl = totalPnl * qty
  // ----------------------------------------------------
  // const rawPnl = closingPrice - trade?.openPrice;
  // const exposer = trade?.margin * trade?.leverage;
  // const qty = trade?.openPrice / exposer;
  // const netPnl= rawPnl * qty;
  // 1. Convert back to real numbers
const openPrice = trade.openingPrice / 1e4;
const closePrice = closingPrice / 1e4;
const margin = trade.margin / 1e2;
const leverage = trade.leverage;
// console.log("margin");

// 2. Calculate exposure (not scaled)
const exposure = margin * leverage;

// 3. Calculate position size (quantity)
const qty = exposure / openPrice; // how many units of asset bought

// 4. Calculate PnL
const rawPnl = (closePrice - openPrice) * qty;
const totalTransaction = rawPnl+margin;

  const closedTrade : closedTrade = {
    ...trade,
    closePrice:closingPrice,
    pnl:rawPnl,
  }

  user.trades.splice(tradeIndex,1);
  openTradesArray.splice(tradeArrayIndex,1);
  console.log('after closing balance',totalTransaction)
  updateBalanceForClosedOrder(userId,totalTransaction,liquidation,margin);
  if (!closedTrades[userId]) {
    closedTrades[userId] = { trades: [] }; 
  }
    closedTrades[userId]?.trades.push(closedTrade);
  console.log('closing trade',closedTrade);
  console.log('final balance after closing',userBalance[userId]);
    return true;
}
const initiateUser = (data: createAccount) => {
  console.log("payload userId.....", data.userId);
  // responseToServer(data.userId)
}
const createOrder = (payload: createOrder) => {
  const {margin,leverage,slippage,asset,userId,type,id} = payload;
  
  console.log("creating order .......", !userBalance[userId]);
  if (!userBalance[userId]){
    initBalanceForUser(userId);
  }

  
  const orderId = randomUUIDv7();
  const trade = {
    orderId,
    margin: Number(margin),
    leverage: Number(leverage),
    slippage:Number(slippage),
    asset,
    type,
    openingPrice:marketPrice[asset]?.ask ?? 0,
    id
  }
  updateBalanceForUser(userId,Number(margin),type)
  addTrades(userId,trade); 
  responseToServer(trade)
}
 const closeOrder =(payload:closeOrder)=>{
  const {userId,orderId} = payload;
  closeTrade(userId,orderId,false);
  
 }

const responseToServer = (payload:any) => {
  const orderId = payload.id;
  console.log("orderId",orderId);
  
  queue.xAdd("callback_queue", "*", {
    id: orderId,
    orderId: payload.orderId
  })
  console.log("response sent back");
  
}

export const mapOrderIdToUserId = (orderId:string):string | null => {
  for (const [userId , {trades}]  of Object.entries(openTrades)){
      if (trades.some(trade => trade.orderId === orderId)){
        return userId;
      }
  }
  return null;
}
const liquidationEngine = (liveTrade:Asset) => {
  openTradesArray.map((order) => {
    if (order.leverage > 1 && order.type === "buy") {
      // const rawPnl = liveTrade.sellPrice - order.openPrice;
      // const exposer = order?.margin * order?.leverage;
      // const qty = order?.openPrice / exposer;
      // const netPnl= rawPnl * qty;

      // threshold = 100/leverage === (2)50% ====(3)33.33% ======(10)10%===100(1%)
      // % loss =  rawPnl / netPnl;
      // if threshold > 0.9*(%loss*100) then close order
      // const threshold = 90/leverage;


      if (liveTrade.ask < order.openingPrice) {
        const changePercentge = ((order.openingPrice - liveTrade.ask) / order.openingPrice)*100;
        // console.log('loss percentage',changePercentge);
        if (changePercentge > 90 / (order.leverage)) {
          // close order
          const index = openTradesArray.findIndex(i => i.orderId == order.orderId);
          openTradesArray.splice(index, 1)
          const userId: string | null = mapOrderIdToUserId(order.orderId);
          if (!userId) {
            return;
          }
          closeTrade(userId, order.orderId,true);
          console.log("order closed");

        }

      }
    }else {
          if (order.type==="sell"){
              if (liveTrade.bid > order.openingPrice) {
                const changePercentage = (liveTrade.bid - order.openingPrice) / order.openingPrice;
                  if (changePercentage > 90 / (order.leverage)) {
                          // close order
                    const index = openTradesArray.findIndex(i => i.orderId == order.orderId);
                    openTradesArray.splice(index, 1)
                    console.log("order closed");
        }
      }
    }
    }

  })
}
/*
"snapshot" : {

"openTrades": {},

"openTradesArray": [],

"Balances" : {},

}
 snapshot Record<string,any>
 snapshot["openTrades"] = openTrades
 snapshot["balances"]

*/
const captureSnapShot = async ()=>{
  snapShot["openTrades"]= openTrades;
  snapShot["balances"]=userBalance;
  snapShot["openTradesArray"]= openTradesArray;

  await Bun.write('./snapshot.json',JSON.stringify(snapShot));
}

const loadSnapShot = async ()=>{

  const file = Bun.file('./snapshot.json');
  if (!(await file.exists())){
    console.log("File doesnot exist"); 
    return ;
  }
  try {
  const recoveredsnapShot = await file.json();
  openTrades = recoveredsnapShot["openTrades"]
  openTradesArray = recoveredsnapShot["openTradesArray"]
  userBalance = recoveredsnapShot["balances"]

  }catch(err){
    console.log("error processing snapshot");
  }
}

const loopSnapShot = async ()=>{
  await captureSnapShot();
  setTimeout(loopSnapShot,3000);
}

await loadSnapShot();
loopSnapShot();