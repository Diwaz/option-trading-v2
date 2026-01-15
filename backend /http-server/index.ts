import express, { request, response } from 'express'
import cors from 'cors';
import morgan from 'morgan';
import { createClient, type RedisClientType } from 'redis';
import routes from './routes';
import { payloadSchema, tradeRoutes } from './routes/tradeRoutes';
import { authMiddleware } from './auth-middleware';
import { otpCache } from './routes/auth';
import {WebSocketServer} from 'ws';
import http from 'http';
import { URL } from 'url';
import { validate } from './helper/validator';

const redisInstance: RedisClientType = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT)
    }
});

export const webSocketUsers = new Map<string,WebSocket>();

redisInstance.on('error', err => console.log('Redis Client Error', err));
await redisInstance.connect();
const app = express()
const server = http.createServer(app);




app.use(express.json())
app.use(cors())
app.use(morgan('dev'));
app.get('/api/v1/checkHealth', async (req, res) => {
  res.status(200).json({
    message: "ok"
  })

});

app.use('/api/v1/',routes);
app.use(authMiddleware);
app.get('/api/v1/auth/me',(req,res)=>{
  try{

      const payload = validate(payloadSchema)(req.user);
      const {userId} = payload;
      if (!userId){
        return res.status(404).json({
          success: false,
          error: "Unauthorized User"
        })
      }
      return res.status(200).json({
        success: true,
        userId
      })
  }catch(err){
      return res.status(400).json({
        success:false,
        error: err
      })
  } 
})
app.use('/api/v1/trade/',tradeRoutes(redisInstance));

 
const wss = new WebSocketServer({server});  

wss.on('connection', (ws, req) => {
    try {
        // Extract userId from query params
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const userId = url.searchParams.get('userId');
        
        if (!userId) {
            console.warn('WebSocket connection without userId, closing connection');
            ws.close(1008, 'Missing userId parameter');
            return;
        }
        
        // Add user and socket to map
        webSocketUsers.set(userId, ws);
        console.log(`User ${userId} connected. Total users: ${webSocketUsers.size}`);
        
        // Handle disconnect
        ws.on('close', () => {
            webSocketUsers.delete(userId);
            console.log(`User ${userId} disconnected. Total users: ${webSocketUsers.size}`);
        });
        
        // Handle errors
        ws.on('error', (err) => {
            console.error(`WebSocket error for user ${userId}:`, err);
        });
    } catch (err) {
        console.error('Error handling WebSocket connection:', err);
        ws.close(1011, 'Internal server error');
    }
});

server.listen(8848, () => {
  console.log(`server started to listen in ${process.env.ENVIRONMENT} MODE`);

})

