use crate::models::Command;
use serde_json;
use std::sync::Arc;
use tokio::sync::Mutex;
pub async fn handle_create_order(
    cmd: Command,
    conn: Arc<Mutex<redis::aio::MultiplexedConnection>>,
) -> redis::RedisResult<()> {
    println!("Preparing to create order {:?}", cmd);

    let mut conn = conn.lock().await;

    if let Some(order_id) = cmd.order_id {
        let payload = serde_json::json!({
            "action":"ORDER_CREATE_SUCCESS",
            "orderId": order_id
        })
        .to_string();
        println!("{:?}", order_id);
        // Equivalent of client.publish(orderId, "any random msg here");
        redis::cmd("PUBLISH")
            .arg(&order_id) // channel name = order_id
            .arg(payload) // message
            .query_async(&mut *conn)
            .await?;
    } else {
        println!("No order_id found, skipping publish");
    }

    Ok(())
}
