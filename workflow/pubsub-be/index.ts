import { createClient } from "redis";

const subscriber = createClient();
await subscriber.connect();

subscriber.subscribe('data', (data) => {
  console.log('data', data)
})
