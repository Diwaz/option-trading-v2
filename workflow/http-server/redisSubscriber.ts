import { createClient, type RedisClientType } from "redis";

export class RedisSubscriber {

  private client: RedisClientType;
  private callbacks: Record<string, () => void>;

  constructor() {
    this.client = createClient();
    this.client.connect();
    this.callbacks = {}
    this.runLoop();
  }

  async runLoop() {
    while (1) {
      const response = await this.client.xRead({
        key: "callback_queue",
        id: "$",
      }, {
        BLOCK: 0,
        COUNT: 1
      })

      if (!response) {
        continue;
      }

      const { name, messages } = response[0];
      console.log("received message from the callback queue", messages[0].message.id);
      this.callbacks[messages[0].message.id]();
      delete this.callbacks[messages[0].message.id]
    }
  }

  waitForMessage(callbackId: string) {
    return new Promise((resolve, reject) => {
      this.callbacks[callbackId] = resolve;
      setTimeout(() => {
        if (this.callbacks[callbackId]) {
          reject();
        }
      }, 5000)
    })
  }

}
