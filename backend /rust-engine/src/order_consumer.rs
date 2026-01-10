use redis::{Commands, RedisResult, Value};
use serde::Deserialize;
use serde_json::{Map, Value as JsonValue};
use std::sync::{Arc, Mutex};

use crate::AppState;

#[derive(Debug, Deserialize)]
struct Order {
    action: String,
    #[serde(rename = "orderId")]
    order_id: String,
    #[serde(rename = "userId")]
    user_id: String,
    side: String,
    margin: String,
    leverage: String,
    asset: String,
    slippage: String,
}

pub fn consume_orders(state: Arc<Mutex<AppState>>) -> RedisResult<()> {
    let client = redis::Client::open("redis://127.0.0.1/")?;
    let mut con = client.get_connection()?;

    let mut last_id = "0-0".to_string();

    loop {
        let reply: redis::Value = redis::cmd("XREAD")
            .arg("BLOCK")
            .arg(0)
            .arg("COUNT")
            .arg(1)
            .arg("STREAMS")
            .arg("orders")
            .arg(&last_id)
            .query(&mut con)?;

        if let redis::Value::Array(streams) = reply {
            if let Some(redis::Value::Array(entries)) = streams.get(0) {
                if let Some(redis::Value::Array(order)) = entries.get(1) {
                    println!("orders {:?}", order);
                    let mut obj = serde_json::Map::new();
                    let mut iter = order.iter();
                    while let (
                        Some(redis::Value::BulkString(ref f)),
                        Some(redis::Value::BulkString(ref v)),
                    ) = (iter.next(), iter.next())
                    {
                        let field = String::from_utf8_lossy(f).to_string();
                        let value = String::from_utf8_lossy(v).to_string();
                        println!("key :{:?} value :{:?}", field, value);
                        obj.insert(field, JsonValue::String(value));
                    }

                    if let Ok(order) =
                        serde_json::from_value::<Order>(serde_json::Value::Object(obj))
                    {
                        println!("here {:?}", &order);
                        let data = state.lock().unwrap();
                        if let Some(price) = data.prices.get(&order.asset) {
                            println!(
                                "[ORDER] {:?} enriched with price: buy={} sell={}",
                                order, price.buy, price.ask
                            );
                        } else {
                            println!("[ORDER] {:?} but no price yet", order);
                        }
                    }
                }
            }
        }
    }
}
