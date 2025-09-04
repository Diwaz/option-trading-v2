import { createClient } from "redis";



const redis = createClient();
await redis.connect();
const queue = redis.duplicate();
const publisher = redis.duplicate();
await publisher.connect();
await queue.connect();

while (true) {

  queue.rPop("orders", (msg) => {
    console.log(JSON.parse(msg));
  })
}
