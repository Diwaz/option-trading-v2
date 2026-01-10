import { createClient } from "redis";

const client = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT)
    }
});
client.on('error', err => console.log('Redis Client Error', err));
await client.connect();

const STREAM = "worker-stream";
const GROUP = "worker-group";

async function ensureGroup() {
  try {
    await client.xGroupCreate(
      STREAM,
      GROUP,
      "$",           
      { MKSTREAM: true } 
    );
    console.log("Consumer group created");
  } catch (err: any) {
    if (err?.message?.includes("BUSYGROUP")) {
      console.log("Consumer group already exists");
    } else {
      throw err; 
    }
  }
}

await ensureGroup();
