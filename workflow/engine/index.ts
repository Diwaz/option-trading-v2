import { randomUUIDv7 } from "bun";
import { createClient } from "redis";
import type { ParsePayload } from "zod/v4/core";



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
const LiquidatedOrders = new Map<string,string>();

interface createOrder {
  action: string,
  orderId: string,
  userId: string,
  type: "buy" | "sell",
  margin: string,
  leverage: string,
  asset: string,
  slippage: string,
  requestId: string
}
interface fetchOrder {
  action:string;
  userId:string;
  orderId:string;
  requestId:string;
}
// const trade = {
//     orderId,
//     margin: Number(margin),
//     leverage: Number(leverage),
//     slippage:Number(slippage),
//     asset,
//     type,
//     openingPrice:marketPrice[asset]?.ask ?? 0,
//     requestId
//   }
interface GetBalance {
  action:string,
  userId:string,
  requestId:string,
}
interface closeOrder {
  userId:string,
  orderId:string,
  requestId:string
}

interface Asset {
  bid:number,
  ask:number
  asset?:string
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
    // const payload = JSON.parse(response[0].messages[0].message.message);
    // const action = JSON.parse(response[0].messages[0].message.message).action;
    const raw = response[0].messages[0].message.message;
const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
const action = payload.action
    switch (action) {
      case "CREATE_ACCOUNT":
        // console.log("reached here in CREATEACCOUNT");
        const {userId,requestId} = payload;
        if (!userBalance[userId]){
          initBalanceForUser(userId);
        }
        const resp = {
          requestId,
          orderId:"Successfully created"
        }
        // initiateUser(payload);
        responseToServer(resp);
        // loadSnapShot();
        // console.log("openTrades",openTrades)
        // console.log("openTradesArray",openTradesArray)
        // console.log("userbalance",userBalance)
        break;
      case "CREATE_ORDER":
        console.log("reached here to ORDERCREATE");
        // createOrder(payload);
        // console.log("payload from here",payload);
        
        createOrder(payload)
        break;
      case "GET_OPEN_ORDERS":
        console.log("reached here to fetch open orders");
        // createOrder(payload);
        // console.log("payload from here",payload);
        getOpenOrders(payload);
        // createOrder(payload)
        break;
      case "CLOSE_ORDER":
        console.log("canceling order...");
        closeOrder(payload);
        break;
      case "GET_BALANCE":
        console.log("checking balance...");
        getBalance(payload);
        break;
      case "PRICE_UPDATE":
        // console.log('updating price',payload);
        marketPrice[payload.asset]= {
          bid:parseInt(payload.buy),
          ask:parseInt(payload.ask)
        }
        liquidationEngine({
          bid:parseInt(payload.buy),
          ask:parseInt(payload.ask),
          asset:(payload.asset)
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
      let descaledMargin= margin/1e2;
      if (balance.usd_balance < descaledMargin){
        throw new Error("Insufficient Amount!");
      } 
      if (type === "buy"){
        // deduct user balance
        // 1 . get margin 
        balance.usd_balance  -= (descaledMargin);
        console.log('stock buy worth',descaledMargin);

      }
      if (type === "sell"){
        balance.usd_balance -= (descaledMargin);
      }
}


const addTrades = (userId: string , trade: Trade) =>{
    try {
      if (!userId || !trade){
        console.log("trade Cancelled")
        return false;
      }
       if (!openTrades[userId]) {
        openTrades[userId] = { trades:[]}; 
      }
      openTrades[userId]?.trades.push(trade);
      openTradesArray.push(trade);
      console.log("trade added",trade);
      console.log("open trades from create trade",openTrades);
      
      // mapUserToTrades[userId]?.push(trade.orderId);
      // console.log('openTradesArray',openTradesArray);
      // console.log('mapUserToTrades',mapUserToTrades);
      return true;
} catch(err){
  return false ;
}
  
}
const getOpenOrders=(payload:fetchOrder)=>{
  const userId = payload.userId;
  const trades = openTrades[userId]?.trades;
  let convertedTrades = trades?.map(t => ({
    ...t,
    openingPrice: t.openingPrice / 10000,
    margin: t.margin / 100,
  }));

let data = {
  requestId:payload.requestId,
  response:convertedTrades 
}

  if (!trades){
 data = {
  requestId:payload.requestId,
  response:[]
}
  }

console.log("before sending open trades data :",data)
  responseToServerFlexible(data)
  console.log(`open trade for user ${userId}:`,data.response)
    // console.log("open trades ALLLLL",openTrades)
}
export const closeTrade = (userId:string,orderId:string,liquidation:boolean) => {

  const user= openTrades[userId];

  if (!user) return null;
  // console.log("closing trade",{
  //   userId,
  //   orderId,
  //   liquidation
  // })
  const tradeIndex = user.trades.findIndex(i=>i.orderId === orderId);
  console.log("order id i want to cancle",tradeIndex)
  // console.log("total orders",user.trades)

  console.log("tradeIndex?",tradeIndex);
  
  if (tradeIndex < 0 ){
    console.log("reached here where we dont have tradeIndex");
    
    throw new Error("Order Id doesnot exist");
  }
  const trade  = user.trades[tradeIndex] as Trade;
  const asset = trade?.asset ?? "ETH_USDC";
  const closingPrice = trade.type === "buy" ? marketPrice[asset]?.ask  : marketPrice[asset]?.bid; 
  // const closingPrice = marketPrice[asset]?.bid ?? 0;

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
const closePrice = closingPrice! / 1e4;
const margin = trade.margin / 1e2;
const leverage = trade.leverage;
// console.log("margin");

// 2. Calculate exposure (not scaled)
const exposure = margin * leverage;

// 3. Calculate position size (quantity)
const qty = exposure / openPrice; // how many units of asset bought

// 4. Calculate PnL
let rawPnl = 0;
if (trade.type === "buy") {

   rawPnl = (closePrice - openPrice) * qty;
}else{
  
   rawPnl = (openPrice - closePrice) * qty;
}

const totalTransaction = rawPnl+margin;

  const closedTrade : closedTrade = {
    ...trade,
    closePrice:closingPrice ?? 0,
    pnl:rawPnl,
  }

  const payload  = {
    userId,
    orderId:trade.orderId,
    type: trade.type,
    margin: trade.margin,
    leverage: trade.leverage,
    asset: trade.asset,
    openingPrice: trade.openingPrice,
    closePrice:closingPrice,
    pnl: rawPnl
  }
  responseClosedOrder(payload);

  user.trades.splice(tradeIndex,1);

  if (!liquidation){

  const tradeArrayIndex = openTradesArray.findIndex(i=>i.orderId === orderId);
    openTradesArray.splice(tradeArrayIndex,1);

  }

  console.log('after closing balance',totalTransaction)
  updateBalanceForClosedOrder(userId,totalTransaction,liquidation,margin);
  if (!closedTrades[userId]) {
    closedTrades[userId] = { trades: [] }; 
  }
    closedTrades[userId]?.trades.push(closedTrade);
  // console.log('closing trade',closedTrade);
  // console.log('final balance after closing',userBalance[userId]);
    return true;
}

const getBalance= (payload:GetBalance)=> {
  const {userId,requestId} = payload;
  // console.log("balance payload",payload)
  if (!userBalance[userId]){

    initBalanceForUser(userId);
    // console.log("no balance found for userid:",userId)
    // errorToServer({
    //   requestId,
    //   err:"Unable to retrive Balance"
    // }) 
  }else{
    const balance = userBalance[userId]
    const payload = {
      requestId,
      orderId:balance.usd_balance.toString(),
      action:"GET_BALANCE"
    }
    responseToServer(payload);
  } 
}

const createOrder = (payload: createOrder) => {
  const {margin,leverage,slippage,asset,userId,type,requestId} = payload;

  // console.log('payload',payload);
  console.log("received this asset",asset) 
  console.log("creating order .......", !userBalance[userId]);
  if (!userBalance[userId]){
    initBalanceForUser(userId);
  }

  
  const orderId = randomUUIDv7();
  // const trade = {
  //   orderId,
  //   margin: Number(margin),
  //   leverage: Number(leverage),
  //   slippage:Number(slippage),
  //   type,
  //   asset,
  //   openingPrice:marketPrice[asset]?.ask ?? 0,
  //   requestId
  // }
const trade = {
  orderId,
  margin: Number(margin) || 0,
  leverage: Number(leverage) || 0,
  slippage: Number(slippage) || 0,
  asset,
  type,
  openingPrice: marketPrice[asset]?.ask ?? 0,
  requestId
}
console.log("traded ADDEDEDDE",trade)
  try {
    updateBalanceForUser(userId,Number(margin),type)
    addTrades(userId,trade); 
    responseToServer(trade)

  }catch(err){
    errorToServer({
      requestId: payload.requestId,
      err,
    })
  }
}
const isLiquidated = (orderId:string)=>{
    if (LiquidatedOrders.has(orderId)){
      return true
    }
    return false;
}

 const closeOrder =(payload:closeOrder)=>{
  const {userId,orderId} = payload;

  try {
    if (isLiquidated(orderId)){

      responseLiquidatedOrders({
          requestId:payload.requestId,
          orderId
      })
    }else{

    closeTrade(userId,orderId,false);

    // console.log("'resp from close",responseFromClose);
    responseToServer(payload); 
    }

  }catch(err){
    // console.log("close order failed",err);
    errorToServer({
      requestId:payload.requestId,
      err
    }) 
  }
 
 }
const errorToServer = (payload:any)=>{
  queue.xAdd("callback_queue", "*", {
    id: payload.requestId,
    error: payload.err.toString(),
    action:"FAILED",
  })

}
const responseLiquidatedOrders = (payload:any) => {
  const requestId = payload.requestId;
   
  queue.xAdd("callback_queue", "*", {
    id: requestId,
    orderId: payload.orderId,
    message:"Order Already Liquidated!",
    action:"LIQUIDATED"
  })
 console.log("Order Liquidated Detected & Sent") 
}

const responseToServer = (payload:any) => {
  const requestId = payload.requestId;
  // console.log("payload.action",payload.action)
  // if (payload.action != "GET_BALANCE"){

  //   console.log("resp to server payload",payload);
  // }
  
  queue.xAdd("callback_queue", "*", {
    id: requestId,
    orderId: payload.orderId,
    action:"SUCCESS"
  })
  console.log("response sent back");
  
}


const responseClosedOrder = (payload:any)=> {
  const requestId = payload.requestId;
  const closedOrder = {
id:requestId,
    action:"CLOSED_ORDER",
    userId:payload.userId,
    orderId:payload.orderId,
    type: payload.type,
    margin: payload.margin,
    leverage: payload.leverage,
    asset: payload.asset,
    openingPrice: payload.openingPrice,
    closePrice:payload.closePrice,
    pnl: payload.pnl
  }
  queue.xAdd("worker-stream","*",{
  data:JSON.stringify(closedOrder)    
  })
  console.log("closed order response sent back")
}

const responseToServerFlexible = (payload:any) => {
  const requestId = payload.requestId;
  // console.log("payload.action",payload.action)
  
  console.log("before crashing",JSON.stringify(payload)) 
  queue.xAdd("callback_queue", "*", {
    id: requestId,
    payload: JSON.stringify(payload.response),
    action:"SUCCESS"
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
    if (order.leverage > 1 && order.type === "buy" && order.asset === liveTrade.asset) {
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
        // console.log("order openingPrice",order.openingPrice)

        // console.log("liveTrade ask Price",liveTrade.ask)

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
          const time = Date.now() 
          LiquidatedOrders.set(order.orderId,time.toString());

          console.log("order closed");

        }

      }
     
    }else {
          if (order.type==="sell" && order.asset === liveTrade.asset ){
              if (liveTrade.bid > order.openingPrice) {
                const changePercentage = (liveTrade.bid - order.openingPrice) / order.openingPrice;
                  if (changePercentage > 90 / (order.leverage)) {
                          // close order
                    const index = openTradesArray.findIndex(i => i.orderId == order.orderId);
                    openTradesArray.splice(index, 1)
                    const userId: string | null = mapOrderIdToUserId(order.orderId);
                      if (!userId) {
                         return;
                        }
                    closeTrade(userId, order.orderId,true);
                    const time = Date.now() 
                   LiquidatedOrders.set(order.orderId,time.toString());


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
  snapShot["marketPrice"] = marketPrice;

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
  marketPrice = recoveredsnapShot["marketPrice"] ?? {}
  

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