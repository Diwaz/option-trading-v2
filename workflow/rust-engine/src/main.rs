mod crete_order;
mod models;

use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result; // ✅ don't import `Ok`, just `Result`
use crete_order::handle_create_order;
use models::{Action, Command};
use redis::streams::{StreamReadOptions, StreamReadReply};
use redis::AsyncCommands;
use serde::Deserialize;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

#[derive(Debug, Deserialize)]
pub struct AppState {
    prices: HashMap<String, PricePacket>,
}

#[derive(Debug, Deserialize)]
struct PricePacket {
    buy: String,
    ask: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    let state = Arc::new(Mutex::new(AppState {
        prices: HashMap::new(),
    }));

    // Connect to Redis
    let client = redis::Client::open("redis://127.0.0.1/")?;
    let conn = client.get_multiplexed_tokio_connection().await?;
    let redis_conn = Arc::new(Mutex::new(conn));
    println!(" Trading engine started. Listening on Redis stream `orders`...");

    // Start from latest
    let mut last_id = "$".to_string();

    loop {
        //  Non-blocking wait for messages
        let opts = StreamReadOptions::default().block(0).count(10);
        let mut conn_guard = redis_conn.lock().await; // ✅ lock the shared connection
        let reply: StreamReadReply = conn_guard
            .xread_options(&["orders"], &[&last_id], &opts)
            .await?;
        drop(conn_guard); // release lock early

        for stream_key in reply.keys {
            for msg in stream_key.ids {
                last_id = msg.id.clone(); // update offset

                // Convert Redis map into JSON
                let mut map = serde_json::Map::new();

                for (k, v) in msg.map {
                    let parsed: redis::RedisResult<String> = redis::from_redis_value(&v);
                    if let Ok(s) = parsed {
                        map.insert(k, s.into());
                    }
                }

                // Deserialize into Command
                match serde_json::from_value::<Command>(map.into()) {
                    Ok(cmd) => {
                        let state_for_update = Arc::clone(&state);
                        let redis_for_update = Arc::clone(&redis_conn);
                        if let Err(e) =
                            handle_command(cmd, state_for_update, redis_for_update).await
                        {
                            eprintln!("❌ Command failed: {}", e);
                        }
                    }
                    Err(e) => eprintln!("❌ Failed to parse command: {}", e),
                }
            }
        }

        // small delay to avoid busy loop
        sleep(Duration::from_millis(100)).await;
    }
}

async fn handle_command(
    cmd: Command,
    state: Arc<Mutex<AppState>>,
    conn: Arc<Mutex<redis::aio::MultiplexedConnection>>,
) -> redis::RedisResult<()> {
    match cmd.action {
        Action::OrderCreate => {
            handle_create_order(cmd, Arc::clone(&conn)).await?;
            Ok(())
        }
        Action::CloseOrder => {
            println!("❌ Closing order: {:?}", cmd);
            Ok(())
        }
        Action::CheckBalance => {
            println!("💰 Checking balance for user {:?}", cmd.user_id);
            Ok(())
        }
        Action::PriceUpdate => {
            let mut state_data = state.lock().await; // ✅ use .await, not unwrap
            if let (Some(asset), Some(buy), Some(ask)) = (cmd.asset, cmd.buy, cmd.ask) {
                state_data.prices.insert(asset, PricePacket { buy, ask });
            }
            Ok(())
        }
    }
}

