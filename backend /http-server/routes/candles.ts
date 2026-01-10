
import {Router} from 'express';

const candleRoute = Router();

candleRoute.get('/market', async (req, res) => {
    const {interval,symbol,startTime} = req.query;
  const r = await fetch(`https://api.backpack.exchange/api/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}`)
  const json = await r.json();
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
});


export default candleRoute;