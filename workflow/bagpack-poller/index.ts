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
  ]
}
ws.on('open', () => {
  console.log("server opened")
  ws.send(
    JSON.stringify(
      {
        "method": "SUBSCRIBE",
        "params": ["bookTicker.SOL_USDC", "bookTicker.SOL_USDC_PERP", "bookTicker.BTC_USDC", "bookTicker.BTC_USDC_PERP"]
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
  updatePrice(trade.data.s, parseInt(trade.data.b), parseInt(trade.data.a));
})
setInterval(() => {
  publisher.publish("data", JSON.stringify(marketData))
}, 100)

