export interface CreateOrder {
  type: "buy" | "sell",
  margin: number,
  leverage: number,
  asset: string,
}
export interface ResponseFromEngine {
  orderId?: string,
  action: String,
  userId?: String

}
export interface ResponseFromEngineBalance {
  action: EngineResponse,
  balance: number
}
export enum Task {
  CheckBalance,
  CreateOrder,
  CloseOrder,
}
export enum EngineResponse {
  ORDER_CREATE_SUCCESS,
  ORDER_CREATE_FAILED,
  ORDER_CANCLE_SUCCESS,
  ORDER_CANDLE_FAILED,
  CHECKBALANCE_SUCCESS,
  CHECKBALANCE_FAILED,
}

export interface ResponseFromEngine {
  orderId?: string,
  action: String,
  userId?: String,
  error?:String,
  payload?:string,

}
 export interface OtpWrapper {
  created: number,
  otp:string
 }