import WebSocket from "ws";
import { createClient } from "redis";
const ws = new WebSocket(`wss://ws.backpack.exchange/`);
const publisher = createClient();
await publisher.connect();

interface Asset {
  asset: string,
  buy: number,
  ask: number
}
const marketData: { price_updates: Asset[] } = {
  price_updates: [
    // "sol": {
    // "buy" : 123,
    // "sell": 125
    // },
    // "eth": {
    // "buy": 200,
    // "sell": 205,
    // }
  ]
}
ws.on('open', () => {
  console.log("server opened")
  ws.send(
    JSON.stringify(
      {
        "method": "SUBSCRIBE",
        "params": ["bookTicker.SOL_USDC", "bookTicker.BTC_USDC","bookTicker.ETH_USDC"]
      }
    )
  )
})

const updatePrice = (symbol: string, buyPrice: number, sellPrice: number) => {
  console.log(symbol, buyPrice, sellPrice);
  const entry = marketData.price_updates.find(trade => trade.asset === symbol)
  if (entry) {
    entry.buy = buyPrice,
      entry.ask = sellPrice
  } else {
    marketData.price_updates.push({
      asset: symbol,
      buy: buyPrice,
      ask: sellPrice
    })
  }
}
ws.on("message", (msg) => {
  // console.log(JSON.parse(msg.toString()));
  const trade = JSON.parse(msg.toString())
  console.log("trades", trade.data);
  updatePrice(trade.data.s, Number(trade.data.b), Number(trade.data.a));
})
setInterval(async () => {

  for (const a of marketData.price_updates) {
    await publisher.xAdd("order_stream", "*", {
      message: JSON.stringify({
      action: "PRICE_UPDATE",
      asset: a.asset,
      buy: Math.trunc(a.buy*1e4).toString(),
      ask: Math.trunc(a.ask*1e4).toString()

      })
    });
  }
  publisher.publish("data", JSON.stringify(marketData))
}, 100)

