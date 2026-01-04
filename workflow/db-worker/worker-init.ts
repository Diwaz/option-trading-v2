import { createClient } from "redis";

const client = createClient();
await client.connect();

const STREAM = "worker-stream";
const GROUP = "worker-group";

async function ensureGroup() {
  try {
    await client.xGroupCreate(
      STREAM,
      GROUP,
      "$",           // start from latest
      { MKSTREAM: true } // create stream if missing
    );
    console.log("Consumer group created");
  } catch (err: any) {
    if (err?.message?.includes("BUSYGROUP")) {
      console.log("Consumer group already exists");
    } else {
      throw err; // real failure
    }
  }
}

await ensureGroup();
