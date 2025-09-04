mod models;

use anyhow::Result;
use models::{Action, Command};
use redis::streams::{StreamReadOptions, StreamReadReply};
use redis::AsyncCommands;
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() -> Result<()> {
    // Connect to Redis
    let client = redis::Client::open("redis://127.0.0.1/")?;
    let mut conn = client.get_multiplexed_tokio_connection().await?;

    println!("🚀 Trading engine started. Listening on Redis stream `orders`...");

    // Start from latest
    let mut last_id = "$".to_string();

    loop {
        // Block up to 5s waiting for messages
        let opts = StreamReadOptions::default().block(0).count(10);
        let reply: StreamReadReply = conn.xread_options(&["orders"], &[&last_id], &opts).await?;

        for stream_key in reply.keys {
            for msg in stream_key.ids {
                last_id = msg.id.clone(); // update offset

                // Convert Redis map into JSON
                let mut map = serde_json::Map::new();

                for (k, v) in msg.map {
                    if let Ok(s) = redis::from_redis_value::<String>(&v) {
                        map.insert(k, s.into());
                    }
                }
                match serde_json::from_value::<Command>(map.into()) {
                    Ok(cmd) => handle_command(cmd).await,
                    Err(e) => eprintln!("❌ Failed to parse command: {}", e),
                }
            }
        }

        // small delay to avoid busy loop
        sleep(Duration::from_millis(100)).await;
    }
}

async fn handle_command(cmd: Command) {
    match cmd.action {
        Action::OrderCreate => {
            println!("📦 Creating order: {:?}", cmd);
            // TODO: implement order book / DB insert
        }
        Action::CloseOrder => {
            println!("❌ Closing order: {:?}", cmd);
            // TODO: implement cancel logic
        }
        Action::CheckBalance => {
            println!("💰 Checking balance for user {:?}", cmd.user_id);
            // TODO: query DB or Redis and respond
        }
    }
}

