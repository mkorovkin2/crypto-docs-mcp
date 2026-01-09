"""
Mock ClobClient Template for Backtesting

This template provides a MockClobClient that implements the same interface as
py_clob_client.ClobClient but returns historical data based on the current
simulated time.

USAGE:
    The backtest-mock-scaffolder agent should customize this template based on
    the specific methods used by the bot being backtested.

CRITICAL PRINCIPLES:
    1. Never return data from the future (current_time is the simulation boundary)
    2. Return types must EXACTLY match what ClobClient returns
    3. All prices/amounts should be strings (Polymarket convention)
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
import pandas as pd


@dataclass
class MockPosition:
    """Tracks a position in a token."""
    token_id: str
    size: float = 0.0
    avg_entry_price: float = 0.0
    realized_pnl: float = 0.0


@dataclass
class MockOrder:
    """Represents an order in the mock system."""
    order_id: str
    token_id: str
    side: str  # "BUY" or "SELL"
    size: float
    price: float
    status: str = "LIVE"  # LIVE, FILLED, CANCELLED
    filled_size: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class TradeRecord:
    """Records a completed trade for analysis."""
    timestamp: datetime
    token_id: str
    side: str
    size: float
    price: float
    fee: float
    slippage: float


class MockClobClient:
    """
    Mock implementation of ClobClient for backtesting.

    This class wraps historical data and simulates ClobClient behavior.
    The `current_time` attribute controls what data is "visible" - simulating
    how the real client would behave at that point in time.

    Key Methods (customize based on bot analysis):
    - get_midpoint(token_id) -> {"mid": "0.55"}
    - get_price(token_id, side) -> {"price": "0.55"}
    - get_order_book(token_id) -> {"bids": [...], "asks": [...]}
    - get_trades(params) -> [Trade, ...]
    - create_and_post_order(order_args) -> {"orderID": "...", "status": "MATCHED"}
    - cancel(order_id) -> {"canceled": "order_id"}
    - get_order(order_id) -> Order
    """

    def __init__(
        self,
        price_data: pd.DataFrame,
        trade_data: Optional[pd.DataFrame] = None,
        initial_capital: float = 10000.0,
        slippage_pct: float = 0.001,  # 0.1%
        maker_fee: float = 0.0,
        taker_fee: float = 0.0,
    ):
        """
        Initialize the mock client.

        Args:
            price_data: DataFrame with DatetimeIndex and 'price' column
            trade_data: Optional DataFrame with trade history
            initial_capital: Starting capital in USD
            slippage_pct: Slippage percentage applied to market orders
            maker_fee: Fee for maker orders (usually 0 on Polymarket)
            taker_fee: Fee for taker orders (usually 0 on Polymarket)
        """
        self.price_data = price_data.sort_index()
        self.trade_data = trade_data
        self.initial_capital = initial_capital
        self.slippage_pct = slippage_pct
        self.maker_fee = maker_fee
        self.taker_fee = taker_fee

        # Simulation state
        self.current_time: datetime = price_data.index.min()
        self.cash: float = initial_capital
        self.positions: Dict[str, MockPosition] = {}
        self.orders: Dict[str, MockOrder] = {}
        self.trade_history: List[TradeRecord] = []
        self._order_counter: int = 0

        # Synthetic orderbook parameters
        self.default_spread = 0.02  # 2% spread
        self.default_depth = 1000   # $1000 at each level

    def set_time(self, timestamp: datetime) -> None:
        """Advance simulation time. Called by backtest engine."""
        self.current_time = timestamp

    def _get_current_price(self, token_id: str) -> Optional[float]:
        """Get price at or before current_time (no lookahead)."""
        valid_data = self.price_data[self.price_data.index <= self.current_time]
        if valid_data.empty:
            return None
        return float(valid_data.iloc[-1]["price"])

    def _get_price_with_slippage(self, token_id: str, side: str, size: float) -> float:
        """Calculate execution price including slippage."""
        base_price = self._get_current_price(token_id)
        if base_price is None:
            raise ValueError(f"No price data available for {token_id} at {self.current_time}")

        # Apply slippage based on side
        if side == "BUY":
            return base_price * (1 + self.slippage_pct)
        else:
            return base_price * (1 - self.slippage_pct)

    # =========================================================================
    # PRICE METHODS
    # =========================================================================

    def get_midpoint(self, token_id: str) -> Dict[str, str]:
        """
        Get current midpoint price for a token.

        Returns:
            {"mid": "0.55"} - Price as string
        """
        price = self._get_current_price(token_id)
        if price is None:
            return {"mid": "0"}
        return {"mid": str(price)}

    def get_price(self, token_id: str, side: str) -> Dict[str, str]:
        """
        Get current price for a specific side.

        Args:
            token_id: Token to get price for
            side: "BUY" or "SELL"

        Returns:
            {"price": "0.55"} - Price as string
        """
        base_price = self._get_current_price(token_id)
        if base_price is None:
            return {"price": "0"}

        # Apply half spread based on side
        half_spread = self.default_spread / 2
        if side == "BUY":
            price = base_price * (1 + half_spread)
        else:
            price = base_price * (1 - half_spread)

        return {"price": str(price)}

    def get_last_trade_price(self, token_id: str) -> Dict[str, str]:
        """Get last traded price."""
        price = self._get_current_price(token_id)
        return {"price": str(price) if price else "0"}

    # =========================================================================
    # ORDERBOOK METHODS
    # =========================================================================

    def get_order_book(self, token_id: str) -> Dict[str, Any]:
        """
        Get synthetic orderbook based on current price.

        Returns:
            {
                "market": token_id,
                "asset_id": token_id,
                "bids": [{"price": "0.54", "size": "1000"}, ...],
                "asks": [{"price": "0.56", "size": "1000"}, ...],
                "hash": "synthetic"
            }
        """
        base_price = self._get_current_price(token_id)
        if base_price is None:
            return {"market": token_id, "bids": [], "asks": [], "hash": "synthetic"}

        # Generate synthetic levels
        bids = []
        asks = []

        for i in range(5):  # 5 levels each side
            bid_price = base_price * (1 - self.default_spread/2 - i*0.01)
            ask_price = base_price * (1 + self.default_spread/2 + i*0.01)

            bids.append({
                "price": str(round(bid_price, 4)),
                "size": str(self.default_depth / (i + 1))
            })
            asks.append({
                "price": str(round(ask_price, 4)),
                "size": str(self.default_depth / (i + 1))
            })

        return {
            "market": token_id,
            "asset_id": token_id,
            "bids": bids,
            "asks": asks,
            "hash": "synthetic"
        }

    def get_order_books(self, token_ids: List[str]) -> List[Dict[str, Any]]:
        """Get orderbooks for multiple tokens."""
        return [self.get_order_book(tid) for tid in token_ids]

    # =========================================================================
    # TRADE HISTORY METHODS
    # =========================================================================

    def get_trades(self, params: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """
        Get historical trades up to current_time.

        Args:
            params: Optional TradeParams-like dict with filters

        Returns:
            List of trade dicts
        """
        if self.trade_data is None:
            # Synthesize trades from price data
            return self._synthesize_trades(params)

        # Filter trade data to current_time
        valid_trades = self.trade_data[self.trade_data.index <= self.current_time]

        # Apply additional filters from params
        if params:
            if "maker_address" in params:
                valid_trades = valid_trades[
                    valid_trades["maker_address"] == params["maker_address"]
                ]
            if "market" in params:
                valid_trades = valid_trades[
                    valid_trades["market"] == params["market"]
                ]

        return valid_trades.to_dict("records")

    def _synthesize_trades(self, params: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Synthesize trades from price changes."""
        valid_data = self.price_data[self.price_data.index <= self.current_time]
        if valid_data.empty:
            return []

        trades = []
        prev_price = None

        for idx, row in valid_data.tail(100).iterrows():  # Last 100 price points
            price = row["price"]
            if prev_price is not None and price != prev_price:
                trades.append({
                    "id": f"synthetic_{idx.timestamp()}",
                    "price": str(price),
                    "size": "100",  # Synthetic size
                    "side": "BUY" if price > prev_price else "SELL",
                    "match_time": int(idx.timestamp()),
                    "timestamp": idx.isoformat(),
                })
            prev_price = price

        return trades[-50:]  # Return last 50 trades

    # =========================================================================
    # ORDER METHODS
    # =========================================================================

    def create_and_post_order(self, order_args: Any) -> Dict[str, Any]:
        """
        Create and execute an order.

        In backtesting, market orders are filled immediately at current price
        plus slippage. Limit orders are tracked and filled when price crosses.

        Args:
            order_args: OrderArgs object with token_id, side, size, price, etc.

        Returns:
            {"orderID": "...", "status": "MATCHED|LIVE", ...}
        """
        self._order_counter += 1
        order_id = f"backtest_order_{self._order_counter}"

        # Extract order details (handle both dict and object)
        if isinstance(order_args, dict):
            token_id = order_args.get("token_id")
            side = order_args.get("side", "BUY")
            size = float(order_args.get("size", 0))
            limit_price = order_args.get("price")
            order_type = order_args.get("order_type", "GTC")
        else:
            token_id = getattr(order_args, "token_id", None)
            side = getattr(order_args, "side", "BUY")
            size = float(getattr(order_args, "size", 0))
            limit_price = getattr(order_args, "price", None)
            order_type = getattr(order_args, "order_type", "GTC")

        # Market order (FOK) - fill immediately
        if order_type == "FOK" or limit_price is None:
            return self._execute_market_order(order_id, token_id, side, size)

        # Limit order - check if fills immediately, otherwise track
        current_price = self._get_current_price(token_id)
        limit_price = float(limit_price)

        can_fill = (
            (side == "BUY" and current_price <= limit_price) or
            (side == "SELL" and current_price >= limit_price)
        )

        if can_fill:
            return self._execute_limit_order(order_id, token_id, side, size, limit_price)
        else:
            # Track limit order for later
            order = MockOrder(
                order_id=order_id,
                token_id=token_id,
                side=side,
                size=size,
                price=limit_price,
                status="LIVE",
                created_at=self.current_time
            )
            self.orders[order_id] = order
            return {
                "orderID": order_id,
                "status": "LIVE",
                "takingAmount": "0",
                "makingAmount": "0"
            }

    def _execute_market_order(
        self,
        order_id: str,
        token_id: str,
        side: str,
        size: float
    ) -> Dict[str, Any]:
        """Execute a market order with slippage."""
        exec_price = self._get_price_with_slippage(token_id, side, size)
        return self._fill_order(order_id, token_id, side, size, exec_price, is_taker=True)

    def _execute_limit_order(
        self,
        order_id: str,
        token_id: str,
        side: str,
        size: float,
        price: float
    ) -> Dict[str, Any]:
        """Execute a limit order at the limit price."""
        return self._fill_order(order_id, token_id, side, size, price, is_taker=False)

    def _fill_order(
        self,
        order_id: str,
        token_id: str,
        side: str,
        size: float,
        price: float,
        is_taker: bool
    ) -> Dict[str, Any]:
        """Fill an order and update positions."""
        # Calculate fee
        fee_rate = self.taker_fee if is_taker else self.maker_fee
        fee = size * price * fee_rate

        # Calculate cost/proceeds
        if side == "BUY":
            cost = size * price + fee
            if cost > self.cash:
                return {"orderID": order_id, "status": "REJECTED", "reason": "Insufficient funds"}
            self.cash -= cost
        else:
            proceeds = size * price - fee
            self.cash += proceeds

        # Update position
        if token_id not in self.positions:
            self.positions[token_id] = MockPosition(token_id=token_id)

        pos = self.positions[token_id]
        if side == "BUY":
            # Update average entry price
            total_cost = pos.avg_entry_price * pos.size + price * size
            pos.size += size
            if pos.size > 0:
                pos.avg_entry_price = total_cost / pos.size
        else:
            # Realize PnL on sells
            if pos.size > 0:
                realized = (price - pos.avg_entry_price) * min(size, pos.size)
                pos.realized_pnl += realized
            pos.size -= size

        # Calculate slippage for record
        base_price = self._get_current_price(token_id) or price
        slippage = abs(price - base_price) / base_price if base_price > 0 else 0

        # Record trade
        self.trade_history.append(TradeRecord(
            timestamp=self.current_time,
            token_id=token_id,
            side=side,
            size=size,
            price=price,
            fee=fee,
            slippage=slippage
        ))

        return {
            "orderID": order_id,
            "status": "MATCHED",
            "takingAmount": str(size),
            "makingAmount": str(size * price),
            "transactTime": int(self.current_time.timestamp() * 1000)
        }

    def cancel(self, order_id: str) -> Dict[str, str]:
        """Cancel an open order."""
        if order_id in self.orders:
            self.orders[order_id].status = "CANCELLED"
            return {"canceled": order_id}
        return {"error": "Order not found"}

    def cancel_all(self) -> Dict[str, List[str]]:
        """Cancel all open orders."""
        cancelled = []
        for order_id, order in self.orders.items():
            if order.status == "LIVE":
                order.status = "CANCELLED"
                cancelled.append(order_id)
        return {"canceled": cancelled}

    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Get order status."""
        if order_id in self.orders:
            order = self.orders[order_id]
            return {
                "id": order.order_id,
                "status": order.status,
                "side": order.side,
                "size": str(order.size),
                "price": str(order.price),
                "filledSize": str(order.filled_size),
                "createdAt": order.created_at.isoformat()
            }
        return None

    def get_orders(self, params: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Get all orders matching params."""
        orders = []
        for order in self.orders.values():
            order_dict = {
                "id": order.order_id,
                "status": order.status,
                "side": order.side,
                "size": str(order.size),
                "price": str(order.price),
                "filledSize": str(order.filled_size)
            }
            orders.append(order_dict)
        return orders

    # =========================================================================
    # EQUITY AND METRICS
    # =========================================================================

    def get_equity(self) -> float:
        """Calculate current total equity (cash + position value)."""
        equity = self.cash
        for pos in self.positions.values():
            if pos.size != 0:
                current_price = self._get_current_price(pos.token_id) or 0
                equity += pos.size * current_price
        return equity

    def get_portfolio_summary(self) -> Dict[str, Any]:
        """Get summary of current portfolio state."""
        return {
            "cash": self.cash,
            "equity": self.get_equity(),
            "positions": {
                tid: {
                    "size": pos.size,
                    "avg_entry": pos.avg_entry_price,
                    "realized_pnl": pos.realized_pnl,
                    "current_price": self._get_current_price(tid),
                }
                for tid, pos in self.positions.items()
            },
            "open_orders": len([o for o in self.orders.values() if o.status == "LIVE"]),
            "total_trades": len(self.trade_history)
        }

    # =========================================================================
    # MARKET INFO METHODS (often needed by bots)
    # =========================================================================

    def get_market(self, condition_id: str) -> Dict[str, Any]:
        """Get market info. Returns synthetic data for backtesting."""
        return {
            "condition_id": condition_id,
            "question": "Backtesting Market",
            "outcomes": ["Yes", "No"],
            "active": True,
            "closed": False,
            "tokens": [
                {"token_id": f"{condition_id}_yes", "outcome": "Yes"},
                {"token_id": f"{condition_id}_no", "outcome": "No"}
            ]
        }

    def get_markets(self, params: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Get list of markets. Returns synthetic data."""
        return []  # Customize based on bot needs

    # =========================================================================
    # LIMIT ORDER CHECKING (called by backtest engine)
    # =========================================================================

    def check_limit_orders(self) -> List[str]:
        """
        Check if any limit orders can be filled at current price.
        Called by backtest engine after time advances.

        Returns:
            List of filled order IDs
        """
        filled = []
        for order_id, order in list(self.orders.items()):
            if order.status != "LIVE":
                continue

            current_price = self._get_current_price(order.token_id)
            if current_price is None:
                continue

            can_fill = (
                (order.side == "BUY" and current_price <= order.price) or
                (order.side == "SELL" and current_price >= order.price)
            )

            if can_fill:
                self._fill_order(
                    order_id,
                    order.token_id,
                    order.side,
                    order.size - order.filled_size,
                    order.price,
                    is_taker=False
                )
                order.status = "FILLED"
                order.filled_size = order.size
                filled.append(order_id)

        return filled
