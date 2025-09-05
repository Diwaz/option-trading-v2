use crate::models::Command;
use crate::Balances;
use crate::BalancesStore;
use redis::AsyncCommands;
use redis::RedisResult;
use serde_json;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn handle_create_account(
    cmd: Command,
    conn: Arc<Mutex<redis::aio::MultiplexedConnection>>,
    balance: BalancesStore,
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
        let mut store = balance.lock().await;

        let mut wallet = HashMap::new();
        wallet.insert("usd".to_string(), 5000);

        store.insert(user_id.clone(), Balances { wallet });

        println!("initialize balance for user {:?}", &store);
    } else {
        println!("Account creation Failed");
    }

    // if let (Some())
    Ok(())
}
// fn initiateAccountBalance(userId: String){
//
// }
