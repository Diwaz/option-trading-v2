import asyncio
import json
import redis.asyncio as redis
from typing import Dict, Any, Optional, List
from collections import deque
import logging
from datetime import datetime
import os
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IndicatorCalculator:
    """Calculate technical indicators from price data"""
    
    def __init__(self):
        # Store price history for each asset
        self.price_history: Dict[str, deque] = {}
        self.max_history = 100  # Keep last 100 prices
    
    def add_price(self, asset: str, price: float):
        """Add new price to history"""
        if asset not in self.price_history:
            self.price_history[asset] = deque(maxlen=self.max_history)
        self.price_history[asset].append(price)
    
    def calculate_rsi(self, asset: str, period: int = 14) -> Optional[float]:
        """Calculate RSI (Relative Strength Index)"""
        if asset not in self.price_history:
            return None
        
        prices = list(self.price_history[asset])
        if len(prices) < period + 1:
            return None
        
        # Calculate price changes
        deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
        
        # Separate gains and losses
        gains = [d if d > 0 else 0 for d in deltas[-period:]]
        losses = [-d if d < 0 else 0 for d in deltas[-period:]]
        
        # Calculate average gain and loss
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        
        if avg_loss == 0:
            return 100
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return round(rsi, 2)
    
    def calculate_macd(self, asset: str, fast: int = 12, slow: int = 26, signal: int = 9) -> Optional[Dict[str, float]]:
        """Calculate MACD (Moving Average Convergence Divergence)"""
        if asset not in self.price_history:
            return None
        
        prices = list(self.price_history[asset])
        if len(prices) < slow:
            return None
        
        # Calculate EMAs
        fast_ema = self._calculate_ema(prices, fast)
        slow_ema = self._calculate_ema(prices, slow)
        
        if fast_ema is None or slow_ema is None:
            return None
        
        macd_line = fast_ema - slow_ema
        
        # For signal line, we'd need MACD history
        # Simplified: use a basic average as signal
        signal_line = macd_line * 0.9  # Simplified
        
        return {
            "macd": round(macd_line, 4),
            "signal": round(signal_line, 4),
            "histogram": round(macd_line - signal_line, 4)
        }
    
    def _calculate_ema(self, prices: List[float], period: int) -> Optional[float]:
        """Calculate Exponential Moving Average"""
        if len(prices) < period:
            return None
        
        # Use simple moving average as starting point
        sma = sum(prices[-period:]) / period
        
        # Calculate EMA
        multiplier = 2 / (period + 1)
        ema = sma
        
        for price in prices[-period:]:
            ema = (price * multiplier) + (ema * (1 - multiplier))
        
        return ema
    
    def calculate_price_change(self, asset: str, periods_ago: int = 1) -> Optional[float]:
        """Calculate percentage price change"""
        if asset not in self.price_history:
            return None
        
        prices = list(self.price_history[asset])
        if len(prices) < periods_ago + 1:
            return None
        
        old_price = prices[-(periods_ago + 1)]
        current_price = prices[-1]
        
        change_percent = ((current_price - old_price) / old_price) * 100
        return round(change_percent, 2)
    
    def to_dict(self) -> Dict:
        """Convert price history to dictionary for snapshot"""
        return {
            asset: list(history) 
            for asset, history in self.price_history.items()
        }
    
    def from_dict(self, data: Dict):
        """Load price history from dictionary"""
        for asset, prices in data.items():
            self.price_history[asset] = deque(prices, maxlen=self.max_history)


class SnapshotManager:
    """Manage snapshot persistence"""
    
    def __init__(self, snapshot_dir: str = "snapshots"):
        base_dir = Path(__file__).resolve().parent
        self.snapshot_dir = base_dir / snapshot_dir
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)
        self.snapshot_file = self.snapshot_dir / "strategy_snapshot.json"
    
    def save_snapshot(self, data: Dict):
        """Save snapshot to disk"""
        try:
            temp_file = self.snapshot_file.with_suffix('.tmp')
            with open(temp_file, 'w') as f:
                json.dump(data, f, indent=2)
            
            # Atomic rename
            temp_file.replace(self.snapshot_file)
            logger.info(f"Snapshot saved successfully")
        except Exception as e:
            logger.error(f"Error saving snapshot: {e}")
    
    def load_snapshot(self) -> Optional[Dict]:
        """Load snapshot from disk"""
        try:
            if self.snapshot_file.exists():
                with open(self.snapshot_file, 'r') as f:
                    data = json.load(f)
                logger.info(f"Snapshot loaded successfully")
                return data
            else:
                logger.info("No existing snapshot found, starting fresh")
                return None
        except Exception as e:
            logger.error(f"Error loading snapshot: {e}")
            return None


class StrategyMatcher:
    def __init__(self, redis_host: str = "localhost", redis_port: int = 6379):
        self.redis_client = None
        self.pubsub = None
        self.redis_host = redis_host
        self.redis_port = redis_port
        self.active_strategies: Dict[str, Dict] = {}
        self.indicator_calc = IndicatorCalculator()
        self.last_check: Dict[str, Dict] = {}  # Track last check values to detect crossovers
        self.snapshot_manager = SnapshotManager()
        self.snapshot_interval = 5  # Save snapshot every 5 seconds
        
    async def connect(self):
        """Connect to Redis"""
        self.redis_client = await redis.Redis(
            host=self.redis_host,
            port=self.redis_port,
            decode_responses=True
        )
        self.pubsub = self.redis_client.pubsub()
        logger.info("Connected to Redis")
        
        # Load snapshot on startup
        await self.load_snapshot()
    
    async def load_snapshot(self):
        """Load snapshot from disk"""
        snapshot = self.snapshot_manager.load_snapshot()
        if snapshot:
            # Restore price history
            if "price_history" in snapshot:
                self.indicator_calc.from_dict(snapshot["price_history"])
                logger.info(f"Restored price history for {len(snapshot['price_history'])} assets")
            
            # Restore active strategies
            if "active_strategies" in snapshot:
                self.active_strategies = snapshot["active_strategies"]
                logger.info(f"Restored {len(self.active_strategies)} active strategies")
            
            # Restore last check values
            if "last_check" in snapshot:
                self.last_check = snapshot["last_check"]
    
    async def save_snapshot_periodically(self):
        """Save snapshot every N seconds"""
        while True:
            await asyncio.sleep(self.snapshot_interval)
            
            try:
                snapshot = {
                    "price_history": self.indicator_calc.to_dict(),
                    "active_strategies": self.active_strategies,
                    "last_check": self.last_check,
                    "timestamp": datetime.now().isoformat()
                }
                
                self.snapshot_manager.save_snapshot(snapshot)
            except Exception as e:
                logger.error(f"Error in snapshot save loop: {e}")
    
    async def listen_for_strategies(self):
        """Listen for incoming strategy configurations"""
        logger.info("Listening for strategies on 'strategy_stream'...")
        
        last_id = "0-0"
        while True:
            try:
                messages = await self.redis_client.xread(
                    {"strategy_matching": "$"},
                    count=10,
                    block=1000
                )
                
                for stream, entries in messages:
                    for entry_id, data in entries:
                        last_id = entry_id
                        await self.process_strategy(data)
                        
            except Exception as e:
                logger.error(f"Error reading strategies: {e}")
                await asyncio.sleep(1)
    
    async def process_strategy(self, data: Dict[str, str]):
        """Process incoming strategy configuration"""
        try:
            message = json.loads(data.get("message", "{}"))
            action = message.get("action")
            
            if action == "ADD_STRATEGY":
                strategy_id = message.get("requestId")
                self.active_strategies[strategy_id] = message
                logger.info(f"Added strategy: {strategy_id} for {message.get('asset')}")
                
            elif action == "REMOVE_STRATEGY":
                strategy_id = message.get("id")
                self.active_strategies.pop(strategy_id, None)
                logger.info(f"Removed strategy: {strategy_id}")
                
        except Exception as e:
            logger.error(f"Error processing strategy: {e}")
    
    async def listen_for_market_data(self):
        """Listen for price data from Redis PubSub"""
        logger.info("Subscribing to 'data' channel for market data...")
        
        await self.pubsub.subscribe("data")
        
        async for message in self.pubsub.listen():
            if message["type"] == "message":
                try:
                    await self.process_pubsub_data(message["data"])
                except Exception as e:
                    logger.error(f"Error processing pubsub message: {e}")
    
    async def process_pubsub_data(self, data: str):
        """Process incoming price data from pubsub"""
        try:
            market_data = json.loads(data)
            price_updates = market_data.get("price_updates", [])
            
            for asset_data in price_updates:
                asset = asset_data.get("asset")
                buy_price = float(asset_data.get("buy", 0))
                ask_price = float(asset_data.get("ask", 0))
                
                if not asset or (buy_price == 0 and ask_price == 0):
                    continue
                
                # Use mid price for calculations
                mid_price = (buy_price + ask_price) / 2
                
                # Add price to history
                self.indicator_calc.add_price(asset, mid_price)
                
                # Calculate indicators
                rsi = self.indicator_calc.calculate_rsi(asset, period=14)
                macd_data = self.indicator_calc.calculate_macd(asset)
                price_change = self.indicator_calc.calculate_price_change(asset, periods_ago=5)
                
                # Log indicator values occasionally
                if len(self.indicator_calc.price_history.get(asset, [])) % 80 == 0:
                    logger.info(f"{asset}: Price={mid_price:.4f}, RSI={rsi}, MACD={macd_data}")
                
                # Check strategies for this asset
                await self.check_strategies(asset, mid_price, rsi, macd_data, price_change)
                
        except Exception as e:
            logger.error(f"Error processing pubsub data: {e}")
    
    async def check_strategies(self, asset: str, price: float, rsi: Optional[float], 
                               macd_data: Optional[Dict], price_change: Optional[float]):
        """Check if any strategy conditions are met"""
        for strategy_id, strategy in list(self.active_strategies.items()):
            if strategy.get("asset") != asset:
                continue
            
            if strategy.get("status") != "active":
                continue
            
            indicator = strategy.get("indicator")
            matched = False
            
            try:
                if indicator == "RSI" and rsi is not None:
                    matched = self.check_rsi_condition(strategy, strategy_id, asset, rsi)
                    
                elif indicator == "MACD" and macd_data is not None:
                    matched = self.check_macd_condition(strategy, strategy_id, asset, macd_data)
                    
                elif indicator == "PRICE":
                    matched = self.check_price_condition(strategy, price, price_change)
                
                if matched:
                    await self.trigger_order(strategy)
                    
            except Exception as e:
                logger.error(f"Error checking strategy {strategy_id}: {e}")
    
    def check_rsi_condition(self, strategy: Dict, strategy_id: str, asset: str, rsi_value: float) -> bool:
        """Check if RSI condition is met with crossover detection"""
        condition = strategy.get("condition")
        threshold = float(strategy.get("value", 0))
        
        # Get last RSI value for crossover detection
        last_key = f"{strategy_id}_{asset}_rsi"
        last_rsi = self.last_check.get(last_key, {}).get("value")
        self.last_check[last_key] = {"value": rsi_value}
        
        if condition == "crosses_below":
            # True crossover: was above, now below
            if last_rsi is not None and last_rsi >= threshold and rsi_value < threshold:
                logger.info(f"✅ RSI crossover detected: {last_rsi} -> {rsi_value} (threshold: {threshold})")
                return True
        elif condition == "crosses_above":
            if last_rsi is not None and last_rsi <= threshold and rsi_value > threshold:
                logger.info(f"✅ RSI crossover detected: {last_rsi} -> {rsi_value} (threshold: {threshold})")
                return True
        elif condition == "less_than":
            return rsi_value < threshold
        elif condition == "greater_than":
            return rsi_value > threshold
        
        return False
    
    def check_macd_condition(self, strategy: Dict, strategy_id: str, asset: str, macd_data: Dict) -> bool:
        """Check if MACD condition is met with crossover detection"""
        condition = strategy.get("condition")
        macd = macd_data["macd"]
        signal = macd_data["signal"]
        
        # Get last values for crossover detection
        last_key = f"{strategy_id}_{asset}_macd"
        last_data = self.last_check.get(last_key, {})
        last_macd = last_data.get("macd")
        last_signal = last_data.get("signal")
        
        self.last_check[last_key] = {"macd": macd, "signal": signal}
        
        if condition == "crosses_above":
            # MACD crosses above signal (bullish)
            if last_macd is not None and last_signal is not None:
                if last_macd <= last_signal and macd > signal:
                    logger.info(f"✅ MACD bullish crossover: MACD={macd}, Signal={signal}")
                    return True
        elif condition == "crosses_below":
            # MACD crosses below signal (bearish)
            if last_macd is not None and last_signal is not None:
                if last_macd >= last_signal and macd < signal:
                    logger.info(f"✅ MACD bearish crossover: MACD={macd}, Signal={signal}")
                    return True
        
        return False
    
    def check_price_condition(self, strategy: Dict, current_price: float, price_change: Optional[float]) -> bool:
        """Check if price condition is met"""
        condition = strategy.get("condition")
        threshold = float(strategy.get("value", 0))
        
        if condition == "increases_by" and price_change is not None:
            return price_change >= threshold
        elif condition == "decreases_by" and price_change is not None:
            return price_change <= -threshold
        elif condition == "above":
            return current_price > threshold
        elif condition == "below":
            return current_price < threshold
        
        return False
    
    async def trigger_order(self, strategy: Dict):
        """Send order to engine via Redis stream"""
        try:
            strategy_id = strategy.get("id")
            
            # Mark strategy as triggered to prevent duplicate orders
            if self.active_strategies.get(strategy_id):
                self.active_strategies[strategy_id]["status"] = "triggered"
            
            order_data = {
                "action": "CREATE_ORDER",
                "userId": strategy.get("userId"),
                "requestId": f"strat_{strategy_id}_{int(datetime.now().timestamp() * 1000)}",
                "margin": strategy.get("margin", 100),
                "slippage": strategy.get("slippage", 0.5),
                "leverage": strategy.get("leverage", 1),
                "strategy": True,
                "strategyId": strategy_id,
                "asset": strategy.get("asset"),
                "type": strategy.get("action")  # BUY or SELL
            }
            
            await self.redis_client.xadd(
                "order_stream",
                {"message": json.dumps(order_data)}
            )
            
            logger.info(f"🚀 Triggered order for strategy {strategy_id}: {strategy.get('action')} {strategy.get('asset')}")
            
        except Exception as e:
            logger.error(f"Error triggering order: {e}")
    
    async def run(self):
        """Main run loop"""
        await self.connect()
        
        # Run all tasks concurrently
        await asyncio.gather(
            self.listen_for_strategies(),
            self.listen_for_market_data(),
            self.save_snapshot_periodically()
        )

async def main():
    matcher = StrategyMatcher()
    await matcher.run()

if __name__ == "__main__":
    asyncio.run(main())
