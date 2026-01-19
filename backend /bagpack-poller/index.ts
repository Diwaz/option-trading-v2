import WebSocket from "ws";
import { createClient } from "redis";

let ws: WebSocket;
const WS_URL = `wss://ws.backpack.exchange/`;

function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log("server opened");
    ws.send(
      JSON.stringify({
        "method": "SUBSCRIBE",
        "params": ["bookTicker.SOL_USDC", "bookTicker.BTC_USDC", "bookTicker.ETH_USDC"]
      })
    );
  });

  ws.on("message", (msg) => {
    const trade = JSON.parse(msg.toString());
    updatePrice(trade.data.s, Number(trade.data.b), Number(trade.data.a));
  });

  ws.on("close", () => {
    console.log("WebSocket closed. Attempting to reconnect in 2 seconds...");
    setTimeout(connectWebSocket, 2000);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    ws.terminate();
  });
}

const publisher = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT)
  }
});
await publisher.connect();

interface Asset {
  asset: string,
  buy: number,
  ask: number
}
const marketData: { price_updates: Asset[] } = {
  price_updates: []
};

function updatePrice(symbol: string, buyPrice: number, sellPrice: number) {
  const entry = marketData.price_updates.find(trade => trade.asset === symbol);
  if (entry) {
    entry.buy = buyPrice;
    entry.ask = sellPrice;
  } else {
    marketData.price_updates.push({
      asset: symbol,
      buy: buyPrice,
      ask: sellPrice
    });
  }
}

connectWebSocket();

setInterval(async () => {
  for (const a of marketData.price_updates) {
    await publisher.xAdd("order_stream", "*", {
      message: JSON.stringify({
        action: "PRICE_UPDATE",
        asset: a.asset,
        buy: Math.trunc(a.buy * 1e4).toString(),
        ask: Math.trunc(a.ask * 1e4).toString()
      })
    },
    {
      TRIM: {
        strategy: "MAXLEN",
        strategyModifier: "~",
        threshold: 50_000
      }
    });
  }
  publisher.publish("data", JSON.stringify(marketData));
}, 100);

