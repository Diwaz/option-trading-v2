import { createClient } from "redis";
import { WebSocketServer } from "ws";
import WebSocket from "ws";

const redis = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT)
    }
});

redis.on('error', err => console.log('Redis Client Error', err));
const subscriber = redis.duplicate();
const subscribedUsers: Set<WebSocket> = new Set();
await subscriber.connect();

const wss = new WebSocketServer({ port: 8080 })

subscriber.subscribe('data', (data) => {
  subscribedUsers.forEach((ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })
  // console.log('data', data)
})


wss.on('connection', (ws) => {
  console.log("New User Added")
  subscribedUsers.add(ws)
  ws.on('close', () => {
    subscribedUsers.delete(ws)
    console.log('User deleted after disconnecting')
  })
})

