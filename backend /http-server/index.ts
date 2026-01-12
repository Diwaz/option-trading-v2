import express, { request, response } from 'express'
import cors from 'cors';
import morgan from 'morgan';
import { createClient, type RedisClientType } from 'redis';
import routes from './routes';
import { tradeRoutes } from './routes/tradeRoutes';
import { authMiddleware } from './auth-middleware';
import { otpCache } from './routes/auth';

const redisInstance: RedisClientType = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT)
    }
});

redisInstance.on('error', err => console.log('Redis Client Error', err));
await redisInstance.connect();
const app = express()




app.use(express.json())
// app.use(cors())
app.use(morgan('dev'));

app.use('/api/v1/',routes);
app.use(authMiddleware);
app.use('/api/v1/trade/',tradeRoutes(redisInstance));
app.get('/api/v1/checkHealth', async (req, res) => {
  res.status(200).json({
    message: "ok"
  })

});


 


app.listen(8848, () => {
  console.log(`server started to listen in ${process.env.ENVIRONMENT} MODE`);

})

