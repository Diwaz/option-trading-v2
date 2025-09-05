mod account;
mod crete_order;
mod models;

use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;
use models::{Action, Command};
use redis::streams::{StreamReadOptions, StreamReadReply};
use redis::AsyncCommands;
use serde::Deserialize;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

//custom crates
use account::handle_create_account;
use crete_order::handle_create_order;

#[derive(Debug, Deserialize)]
pub struct AppState {
    prices: HashMap<String, PricePacket>,
}

#[derive(Debug, Deserialize)]
struct PricePacket {
    buy: String,
    ask: String,
}
// for storing balances inMemory
pub type Asset = String;
pub type Amount = u64;
#[derive(Deserialize, Debug)]
pub struct Balances {
    pub wallet: HashMap<Asset, Amount>,
}
pub type BalancesStore = Arc<Mutex<HashMap<String, Balances>>>;

#[tokio::main]
async fn main() -> Result<()> {
    let state = Arc::new(Mutex::new(AppState {
        prices: HashMap::new(),
    }));

    let balances: BalancesStore = Arc::new(Mutex::new(HashMap::new()));

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
        let mut conn_guard = redis_conn.lock().await;
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
                        let balance_state = Arc::clone(&balances);
                        if let Err(e) =
                            handle_command(cmd, state_for_update, redis_for_update, balance_state)
                                .await
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
    balance: BalancesStore,
) -> redis::RedisResult<()> {
    match cmd.action {
        Action::CreateAccount => {
            handle_create_account(cmd, Arc::clone(&conn), balance).await?;
            Ok(())
        }
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
            let mut state_data = state.lock().await;
            if let (Some(asset), Some(buy), Some(ask)) = (cmd.asset, cmd.buy, cmd.ask) {
                state_data.prices.insert(asset, PricePacket { buy, ask });
            }
            Ok(())
        }
        _ => Ok(()),
    }
}
