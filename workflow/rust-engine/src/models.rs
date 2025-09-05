use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Action {
    OrderCreate,
    CreateAccount,
    CloseOrder,
    CheckBalance,
    PriceUpdate,
}

#[derive(Debug, Deserialize)]
pub struct Command {
    pub action: Action,
    pub order_id: Option<String>,
    pub user_id: Option<String>,
    pub side: Option<String>,
    pub margin: Option<String>,
    pub leverage: Option<String>,
    pub asset: Option<String>,
    pub slippage: Option<String>,
    pub buy: Option<String>,
    pub ask: Option<String>,
}
