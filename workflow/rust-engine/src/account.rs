use std::sync::Arc;

use crate::models::Command;
use redis::AsyncCommands;
use redis::RedisResult;
use serde_json;
use tokio::sync::Mutex;

pub async fn handle_create_account(
    cmd: Command,
    conn: Arc<Mutex<redis::aio::MultiplexedConnection>>,
) -> RedisResult<()> {
    println!("Account created successfully {:?}", cmd);
    let mut conn = conn.lock().await;

    if let (Some(user_id)) = cmd.user_id {
        // redis::cmd()
        let payload = serde_json::json!({
            "userId":&user_id,
            "action": "ACCOUNT_SUCCESS"
        })
        .to_string();
        println!("userid {:?}", &user_id);
        conn.publish(&user_id, payload).await?;
        // redis::cmd("PUBLISH")
        //     .arg(&user_id)
        //     .arg(payload)
        //     .query_async(&mut *conn)
        //     .await?;
    } else {
        println!("Account creation Failed");
    }

    // if let (Some())
    Ok(())
}
// fn initiateAccountBalance(userId: String){
//
// }
