import { createClient } from "redis";
import { WebSocketServer } from "ws";
import WebSocket from "ws";

const redis = createClient();

const subscriber = redis.duplicate();
const subscribedUsers: Set<WebSocket> = new Set();
await subscriber.connect();

const wss = new WebSocketServer({ port: 8088 })

subscriber.subscribe('data', (data) => {
  subscribedUsers.forEach((ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })
  console.log('data', data)
})


wss.on('connection', (ws) => {

  subscribedUsers.add(ws)
  ws.on('close', () => {
    subscribedUsers.delete(ws)
    console.log('User deleted after disconnecting')
  })
})

