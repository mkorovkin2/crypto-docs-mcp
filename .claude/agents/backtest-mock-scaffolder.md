---
name: backtest-mock-scaffolder
description: Creates MockClobClient and backtesting infrastructure that wraps a Polymarket bot without modifying it. Generates all mock implementations based on bot analysis and data specifications.
tools: Read, Write, Edit, Bash, Glob, Grep, LS
model: sonnet
---

# Backtest Mock Scaffolder

You create backtesting infrastructure for Polymarket bots. Your job is to generate a complete, working backtest system that wraps the original bot WITHOUT modifying any of its code.

## CRITICAL PRINCIPLE: Minimal Invasiveness

**The original bot code must remain COMPLETELY UNCHANGED.**

All backtesting code goes in a new `backtest/` subdirectory within the bot folder.

## Input Files

You will receive paths to:
1. **Bot analysis**: `{bot_dir}/backtest/analysis.md` - What the bot does
2. **Data spec**: `{bot_dir}/backtest/data_spec.md` - How to get historical data
3. **Original bot directory** - The actual bot code

**READ BOTH SPEC FILES COMPLETELY BEFORE WRITING ANY CODE.**

## Output Directory Structure

Create this structure:

```
{bot_dir}/
├── [all original bot files - DO NOT TOUCH]
└── backtest/
    ├── __init__.py           # Package init
    ├── analysis.md           # [Already exists from analyzer]
    ├── data_spec.md          # [Already exists from researcher]
    ├── mock_client.py        # MockClobClient implementation
    ├── data_loader.py        # Historical data fetching/caching
    ├── backtest_engine.py    # Main backtest orchestration
    ├── metrics.py            # Performance calculations
    ├── visualization.py      # Charts and reports
    ├── run_backtest.py       # Entry point CLI
    ├── requirements.txt      # Additional dependencies
    ├── data/                  # Data cache directory
    │   └── .gitkeep
    └── results/               # Output directory
        └── .gitkeep
```

## File Specifications

### 1. mock_client.py

This is the most critical file. It must implement EVERY method the bot uses with EXACTLY the same return types.

**Read the analysis.md to find which methods are used.**

Template structure:

```python
"""
MockClobClient for backtesting {bot_name}.

Provides historical data through the same interface as py_clob_client.ClobClient.
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import pandas as pd
import numpy as np


class MockClobClient:
    """
    Mock implementation of ClobClient for backtesting.

    Replaces live API calls with historical data lookups.
    """

    def __init__(
        self,
        historical_data: pd.DataFrame,
        trade_data: Optional[pd.DataFrame] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        slippage_pct: float = 0.001,
        fee_pct: float = 0.0,
    ):
        """
        Initialize mock client.

        Args:
            historical_data: Price data indexed by timestamp
            trade_data: Optional trade-level data
            start_time: Backtest start (defaults to data start)
            end_time: Backtest end (defaults to data end)
            slippage_pct: Simulated slippage (default 0.1%)
            fee_pct: Trading fee percentage
        """
        self.price_data = historical_data.sort_index()
        self.trade_data = trade_data

        self.start_time = start_time or self.price_data.index.min()
        self.end_time = end_time or self.price_data.index.max()
        self.current_time = self.start_time

        self.slippage_pct = slippage_pct
        self.fee_pct = fee_pct

        # Order tracking
        self.orders: Dict[str, Dict] = {}
        self.trades: List[Dict] = []
        self.positions: Dict[str, float] = {}
        self.cash = 0.0  # Set by engine

    # ========== Time Control ==========

    def set_current_time(self, t: datetime):
        """Set simulation time."""
        self.current_time = t

    def advance_time(self, delta: timedelta) -> bool:
        """Advance time by delta. Returns False if past end."""
        self.current_time += delta
        return self.current_time < self.end_time

    def _get_current_price(self) -> float:
        """Get price at current_time."""
        mask = self.price_data.index <= self.current_time
        if not mask.any():
            # Before data starts, use first available
            return float(self.price_data.iloc[0]['price'])
        return float(self.price_data[mask].iloc[-1]['price'])

    def _get_lookback_data(self, minutes: int) -> pd.DataFrame:
        """Get data for lookback window ending at current_time."""
        start = self.current_time - timedelta(minutes=minutes)
        mask = (self.price_data.index >= start) & (self.price_data.index <= self.current_time)
        return self.price_data[mask]

    # ========== Market Data Methods ==========
    # Implement based on analysis.md - which methods does the bot use?

    def get_midpoint(self, token_id: str) -> Dict[str, str]:
        """Get current midpoint price."""
        price = self._get_current_price()
        return {"mid": str(price)}

    def get_price(self, token_id: str, side: str = "BUY") -> Dict[str, str]:
        """Get current price with bid/ask simulation."""
        mid = self._get_current_price()
        if side == "BUY":
            price = mid * (1 + self.slippage_pct / 2)
        else:
            price = mid * (1 - self.slippage_pct / 2)
        return {"price": str(price)}

    def get_last_trade_price(self, token_id: str) -> Dict[str, str]:
        """Get last trade price."""
        price = self._get_current_price()
        return {"price": str(price)}

    def get_order_book(self, token_id: str) -> Dict[str, Any]:
        """Get synthetic order book."""
        mid = self._get_current_price()
        spread = self.slippage_pct

        bids = [
            {"price": str(mid * (1 - spread * (i + 1))), "size": str(1000 * (5 - i))}
            for i in range(5)
        ]
        asks = [
            {"price": str(mid * (1 + spread * (i + 1))), "size": str(1000 * (5 - i))}
            for i in range(5)
        ]

        return {
            "market": token_id,
            "timestamp": self.current_time.isoformat(),
            "bids": bids,
            "asks": asks,
        }

    def get_trades(self, params) -> List:
        """
        Get trades for analysis (used by strategy for signals).

        Returns synthetic Trade objects based on price movement.
        """
        market_id = getattr(params, 'market', None)
        after_ts = getattr(params, 'after', None)

        if after_ts:
            start = datetime.utcfromtimestamp(after_ts)
        else:
            start = self.current_time - timedelta(minutes=60)

        data = self.price_data[
            (self.price_data.index >= start) &
            (self.price_data.index <= self.current_time)
        ]

        # Create synthetic trade objects
        trades = []
        for idx, row in data.iterrows():
            # Estimate trade size from volume if available, else default
            size = row.get('volume', 100)

            # Determine side based on price movement
            prev_idx = data.index.get_loc(idx)
            if prev_idx > 0:
                prev_price = data.iloc[prev_idx - 1]['price']
                side = "BUY" if row['price'] > prev_price else "SELL"
            else:
                side = "BUY"

            # Create trade-like object
            trade = type('Trade', (), {
                'size': str(size),
                'price': str(row['price']),
                'match_time': int(idx.timestamp()),
                'side': side,
            })()
            trades.append(trade)

        return trades

    # ========== Trading Methods ==========

    def create_and_post_order(self, order_args) -> Dict[str, Any]:
        """Simulate order placement with immediate fill."""
        order_id = f"MOCK_{uuid.uuid4().hex[:12]}"

        mid = self._get_current_price()

        # Calculate fill price with slippage
        if order_args.side == "BUY":
            fill_price = mid * (1 + self.slippage_pct)
        else:
            fill_price = mid * (1 - self.slippage_pct)

        # Clip to valid prediction market range
        fill_price = max(0.01, min(0.99, fill_price))

        # Calculate fee
        fee = order_args.size * fill_price * self.fee_pct

        order = {
            "orderID": order_id,
            "token_id": order_args.token_id,
            "side": order_args.side,
            "size": order_args.size,
            "price": order_args.price,
            "fill_price": fill_price,
            "fee": fee,
            "status": "MATCHED",
            "size_matched": order_args.size,
            "timestamp": self.current_time,
        }

        self.orders[order_id] = order

        # Record trade
        self.trades.append({
            "order_id": order_id,
            "token_id": order_args.token_id,
            "side": order_args.side,
            "size": order_args.size,
            "fill_price": fill_price,
            "fee": fee,
            "timestamp": self.current_time,
        })

        # Update position
        token_id = order_args.token_id
        current_pos = self.positions.get(token_id, 0)

        if order_args.side == "BUY":
            cost = order_args.size * fill_price + fee
            self.positions[token_id] = current_pos + order_args.size
            self.cash -= cost
        else:
            proceeds = order_args.size * fill_price - fee
            self.positions[token_id] = current_pos - order_args.size
            self.cash += proceeds

        return {
            "orderID": order_id,
            "status": "MATCHED",
            "size_matched": order_args.size,
        }

    def get_order(self, order_id: str) -> Dict[str, Any]:
        """Get order status."""
        if order_id not in self.orders:
            return {"status": "NOT_FOUND"}

        order = self.orders[order_id]
        return {
            "orderID": order_id,
            "status": order["status"],
            "size_matched": order.get("size_matched", 0),
        }

    def cancel(self, order_id: str) -> bool:
        """Cancel order (no-op for immediate fills)."""
        return True

    def cancel_market_orders(self, token_id: str) -> bool:
        """Cancel all orders for token (no-op)."""
        return True

    # ========== Credential Methods (No-op for mock) ==========

    def set_api_creds(self, creds):
        """No-op - mock doesn't need real credentials."""
        pass

    def create_or_derive_api_creds(self):
        """Return dummy credentials."""
        return {"api_key": "mock", "secret": "mock", "passphrase": "mock"}

    # ========== Backtest State ==========

    def get_all_trades(self) -> List[Dict]:
        """Get all trades from backtest."""
        return self.trades

    def get_positions(self) -> Dict[str, float]:
        """Get current positions."""
        return self.positions

    def get_equity(self) -> float:
        """Calculate current equity (cash + position value)."""
        equity = self.cash
        current_price = self._get_current_price()

        for token_id, size in self.positions.items():
            if size > 0:
                # Long YES position
                equity += size * current_price
            elif size < 0:
                # Short position (bought NO)
                equity += abs(size) * (1 - current_price)

        return equity
```

### 2. data_loader.py

Implements data fetching based on data_spec.md:

```python
"""
Historical data loader for backtesting.

Fetches and caches Polymarket historical data.
"""

import os
import time
import requests
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional


class RateLimiter:
    """Simple rate limiter."""

    def __init__(self, requests_per_10s: int):
        self.limit = requests_per_10s
        self.window = 10.0
        self.requests = []

    def wait(self):
        now = time.time()
        self.requests = [t for t in self.requests if now - t < self.window]

        if len(self.requests) >= self.limit:
            sleep_time = self.requests[0] + self.window - now
            if sleep_time > 0:
                print(f"Rate limiting: sleeping {sleep_time:.1f}s")
                time.sleep(sleep_time)

        self.requests.append(time.time())


class DataLoader:
    """
    Loads historical data for backtesting.

    Handles fetching from Polymarket APIs and local caching.
    """

    CLOB_BASE = "https://clob.polymarket.com"

    def __init__(self, cache_dir: str = "data"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        (self.cache_dir / "prices").mkdir(exist_ok=True)

        self.price_limiter = RateLimiter(800)  # 80% of 1000 limit

    def _cache_path(self, token_id: str, start: datetime, end: datetime) -> Path:
        """Generate cache file path."""
        start_str = start.strftime("%Y%m%d")
        end_str = end.strftime("%Y%m%d")
        # Sanitize token_id for filename
        safe_id = token_id.replace("/", "_")[:50]
        return self.cache_dir / "prices" / f"{safe_id}_{start_str}_{end_str}.parquet"

    def fetch_price_history(
        self,
        token_id: str,
        start: datetime,
        end: datetime,
        fidelity: int = 1,  # Minutes per bar
    ) -> pd.DataFrame:
        """
        Fetch historical price data.

        Args:
            token_id: Polymarket token ID
            start: Start datetime
            end: End datetime
            fidelity: Resolution in minutes (1 = 1-minute bars)

        Returns:
            DataFrame with timestamp index and 'price' column
        """
        # Check cache first
        cache_path = self._cache_path(token_id, start, end)
        if cache_path.exists():
            print(f"Loading from cache: {cache_path}")
            return pd.read_parquet(cache_path)

        print(f"Fetching price history for {token_id}")
        print(f"  Range: {start} to {end}")

        all_data = []

        # Fetch in 30-day chunks to avoid timeout
        current = start
        while current < end:
            chunk_end = min(current + timedelta(days=30), end)

            self.price_limiter.wait()

            params = {
                "market": token_id,
                "startTs": int(current.timestamp()),
                "endTs": int(chunk_end.timestamp()),
                "fidelity": fidelity,
            }

            try:
                response = requests.get(
                    f"{self.CLOB_BASE}/prices-history",
                    params=params,
                    timeout=30,
                )
                response.raise_for_status()
                data = response.json()

                if "history" in data and data["history"]:
                    chunk_df = pd.DataFrame(data["history"])
                    chunk_df["timestamp"] = pd.to_datetime(chunk_df["t"], unit="s", utc=True)
                    chunk_df["price"] = chunk_df["p"].astype(float)
                    chunk_df = chunk_df.set_index("timestamp")[["price"]]
                    all_data.append(chunk_df)
                    print(f"  Fetched {len(chunk_df)} bars for {current.date()} to {chunk_end.date()}")
                else:
                    print(f"  No data for {current.date()} to {chunk_end.date()}")

            except Exception as e:
                print(f"  Error fetching {current.date()}: {e}")

            current = chunk_end

        if not all_data:
            raise ValueError(f"No price data found for {token_id}")

        df = pd.concat(all_data).sort_index()

        # Remove duplicates
        df = df[~df.index.duplicated(keep='first')]

        # Save to cache
        df.to_parquet(cache_path)
        print(f"Cached to {cache_path}")

        return df

    def load_data(
        self,
        token_id: str,
        start: datetime,
        end: datetime,
        fidelity: int = 1,
    ) -> pd.DataFrame:
        """
        Load data, fetching if not cached.

        This is the main entry point for the backtest engine.
        """
        return self.fetch_price_history(token_id, start, end, fidelity)

    def validate_data(
        self,
        df: pd.DataFrame,
        start: datetime,
        end: datetime,
    ) -> dict:
        """
        Validate data completeness.

        Returns dict with validation results.
        """
        results = {
            "valid": True,
            "warnings": [],
            "errors": [],
        }

        # Check date range
        data_start = df.index.min()
        data_end = df.index.max()

        if data_start > start:
            results["warnings"].append(
                f"Data starts at {data_start}, requested {start}"
            )

        if data_end < end - timedelta(days=1):
            results["warnings"].append(
                f"Data ends at {data_end}, requested {end}"
            )

        # Check for gaps
        expected_minutes = (end - start).total_seconds() / 60
        actual_bars = len(df)
        coverage = actual_bars / expected_minutes

        if coverage < 0.5:
            results["errors"].append(
                f"Low data coverage: {coverage:.1%}"
            )
            results["valid"] = False
        elif coverage < 0.9:
            results["warnings"].append(
                f"Data coverage: {coverage:.1%}"
            )

        # Check price range
        if not df["price"].between(0, 1).all():
            results["errors"].append("Prices outside [0, 1] range")
            results["valid"] = False

        return results
```

### 3. backtest_engine.py

The main orchestrator:

```python
"""
Backtest engine for Polymarket bots.

Runs the bot against historical data using MockClobClient.
"""

import sys
import importlib.util
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Type
import pandas as pd

from .mock_client import MockClobClient
from .data_loader import DataLoader
from .metrics import BacktestMetrics


class BacktestEngine:
    """
    Runs backtests by:
    1. Loading historical data
    2. Creating MockClobClient
    3. Instantiating the bot with mock client
    4. Stepping through time, calling bot.run_iteration()
    5. Collecting metrics
    """

    def __init__(
        self,
        bot_dir: str,
        token_id: str,
        start: datetime,
        end: datetime,
        initial_capital: float = 10000.0,
        slippage_pct: float = 0.001,
        time_step_minutes: int = 1,
    ):
        """
        Initialize backtest engine.

        Args:
            bot_dir: Path to bot directory (parent of backtest/)
            token_id: Token ID to backtest
            start: Backtest start time
            end: Backtest end time
            initial_capital: Starting capital in USD
            slippage_pct: Simulated slippage
            time_step_minutes: Time between iterations
        """
        self.bot_dir = Path(bot_dir)
        self.token_id = token_id
        self.start = start
        self.end = end
        self.initial_capital = initial_capital
        self.slippage_pct = slippage_pct
        self.time_step = timedelta(minutes=time_step_minutes)

        # Results tracking
        self.equity_curve = []
        self.timestamps = []

    def _load_bot_modules(self):
        """Dynamically load bot modules."""
        # Add bot directory to path
        sys.path.insert(0, str(self.bot_dir))

        # Import required modules
        # These will vary by bot - adjust based on analysis
        modules = {}

        for module_name in ['config', 'order_executor', 'position_manager',
                           'fomo_detector', 'market_filter', 'state_manager']:
            try:
                modules[module_name] = importlib.import_module(module_name)
            except ImportError:
                pass  # Not all bots have all modules

        return modules

    def _create_mock_client(self, historical_data: pd.DataFrame) -> MockClobClient:
        """Create configured mock client."""
        client = MockClobClient(
            historical_data=historical_data,
            start_time=self.start,
            end_time=self.end,
            slippage_pct=self.slippage_pct,
        )
        client.cash = self.initial_capital
        return client

    def run(self) -> dict:
        """
        Execute backtest.

        Returns:
            Dict with equity_curve, trades, metrics
        """
        print("=" * 60)
        print("BACKTEST ENGINE")
        print("=" * 60)
        print(f"Bot: {self.bot_dir}")
        print(f"Token: {self.token_id}")
        print(f"Period: {self.start} to {self.end}")
        print(f"Capital: ${self.initial_capital:,.2f}")
        print("=" * 60)

        # Load historical data
        print("\nLoading historical data...")
        loader = DataLoader(cache_dir=str(self.bot_dir / "backtest" / "data"))
        historical_data = loader.load_data(
            self.token_id,
            self.start,
            self.end,
        )

        validation = loader.validate_data(historical_data, self.start, self.end)
        if not validation["valid"]:
            raise ValueError(f"Data validation failed: {validation['errors']}")
        for warning in validation["warnings"]:
            print(f"Warning: {warning}")

        print(f"Loaded {len(historical_data)} price bars")

        # Create mock client
        mock_client = self._create_mock_client(historical_data)

        # Load bot modules
        print("\nLoading bot modules...")
        modules = self._load_bot_modules()

        # Initialize bot components with mock client
        # This section needs customization based on bot structure
        # The analyzer should have documented how to instantiate

        print("\nRunning backtest...")
        iteration = 0
        current_time = self.start

        while current_time < self.end:
            mock_client.set_current_time(current_time)

            # Record equity
            equity = mock_client.get_equity()
            self.equity_curve.append(equity)
            self.timestamps.append(current_time)

            # Here you would call the bot's run_iteration()
            # This needs to be customized based on how the specific bot works
            # Example:
            # bot.run_iteration()

            iteration += 1
            if iteration % 1000 == 0:
                print(f"  Iteration {iteration}, Time: {current_time}, Equity: ${equity:,.2f}")

            current_time += self.time_step

        print(f"\nCompleted {iteration} iterations")

        # Calculate metrics
        equity_series = pd.Series(
            self.equity_curve,
            index=pd.DatetimeIndex(self.timestamps)
        )

        metrics = BacktestMetrics(
            equity_curve=equity_series,
            trades=mock_client.get_all_trades(),
            initial_capital=self.initial_capital,
        )

        print("\n" + str(metrics))

        return {
            "equity_curve": equity_series,
            "trades": mock_client.get_all_trades(),
            "positions": mock_client.get_positions(),
            "metrics": metrics.summary(),
        }
```

### 4. metrics.py

Performance calculations (use the template from the plan).

### 5. visualization.py

```python
"""
Visualization for backtest results.
"""

import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
from typing import List, Dict


class BacktestVisualizer:
    """Generate charts and reports from backtest results."""

    def __init__(self, results: dict, output_dir: str = "results"):
        self.equity_curve = results["equity_curve"]
        self.trades = results["trades"]
        self.metrics = results["metrics"]
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def plot_equity_curve(self, save: bool = True) -> plt.Figure:
        """Plot equity curve with drawdown."""
        fig, (ax1, ax2) = plt.subplots(
            2, 1, figsize=(14, 10),
            gridspec_kw={'height_ratios': [3, 1]}
        )

        # Equity curve
        ax1.plot(self.equity_curve.index, self.equity_curve.values,
                 linewidth=2, label='Portfolio Value')
        ax1.set_ylabel('Portfolio Value ($)', fontsize=12)
        ax1.set_title('Backtest Results: Equity Curve', fontsize=14)
        ax1.grid(True, alpha=0.3)
        ax1.legend()

        # Drawdown
        cummax = self.equity_curve.cummax()
        drawdown = (self.equity_curve - cummax) / cummax * 100
        ax2.fill_between(drawdown.index, 0, drawdown.values,
                         color='red', alpha=0.3)
        ax2.set_ylabel('Drawdown (%)', fontsize=12)
        ax2.set_xlabel('Date', fontsize=12)
        ax2.grid(True, alpha=0.3)

        plt.tight_layout()

        if save:
            path = self.output_dir / "equity_curve.png"
            fig.savefig(path, dpi=150)
            print(f"Saved: {path}")

        return fig

    def plot_trades(self, save: bool = True) -> plt.Figure:
        """Plot trade analysis."""
        if not self.trades:
            print("No trades to plot")
            return None

        fig, axes = plt.subplots(2, 2, figsize=(14, 10))

        # Trade P&L distribution
        pnls = [t.get('pnl', 0) for t in self.trades if 'pnl' in t]
        if pnls:
            axes[0, 0].hist(pnls, bins=30, edgecolor='black', alpha=0.7)
            axes[0, 0].axvline(0, color='red', linestyle='--')
            axes[0, 0].set_title('Trade P&L Distribution')
            axes[0, 0].set_xlabel('P&L ($)')

        # Trade sizes
        sizes = [t['size'] for t in self.trades]
        axes[0, 1].hist(sizes, bins=30, edgecolor='black', alpha=0.7)
        axes[0, 1].set_title('Trade Size Distribution')
        axes[0, 1].set_xlabel('Size')

        # Cumulative trades over time
        timestamps = [t['timestamp'] for t in self.trades]
        axes[1, 0].plot(range(len(timestamps)), range(1, len(timestamps) + 1))
        axes[1, 0].set_title('Cumulative Trades')
        axes[1, 0].set_xlabel('Trade Number')
        axes[1, 0].set_ylabel('Total Trades')

        # Fill prices
        prices = [t['fill_price'] for t in self.trades]
        axes[1, 1].scatter(range(len(prices)), prices, alpha=0.5)
        axes[1, 1].set_title('Fill Prices Over Time')
        axes[1, 1].set_xlabel('Trade Number')
        axes[1, 1].set_ylabel('Fill Price')

        plt.tight_layout()

        if save:
            path = self.output_dir / "trade_analysis.png"
            fig.savefig(path, dpi=150)
            print(f"Saved: {path}")

        return fig

    def generate_report(self) -> str:
        """Generate text report."""
        lines = []
        lines.append("=" * 60)
        lines.append("BACKTEST REPORT")
        lines.append("=" * 60)
        lines.append("")

        lines.append("## Performance Metrics")
        lines.append("")
        for key, value in self.metrics.items():
            lines.append(f"- {key}: {value}")

        lines.append("")
        lines.append("## Trade Summary")
        lines.append("")
        lines.append(f"- Total Trades: {len(self.trades)}")

        if self.trades:
            buy_trades = [t for t in self.trades if t['side'] == 'BUY']
            sell_trades = [t for t in self.trades if t['side'] == 'SELL']
            lines.append(f"- Buy Trades: {len(buy_trades)}")
            lines.append(f"- Sell Trades: {len(sell_trades)}")

        report = "\n".join(lines)

        # Save report
        path = self.output_dir / "report.txt"
        with open(path, 'w') as f:
            f.write(report)
        print(f"Saved: {path}")

        return report

    def generate_all(self):
        """Generate all visualizations and reports."""
        self.plot_equity_curve()
        self.plot_trades()
        self.generate_report()
        print(f"\nAll outputs saved to: {self.output_dir}")
```

### 6. run_backtest.py

Entry point CLI:

```python
#!/usr/bin/env python3
"""
Run backtest for Polymarket bot.

Usage:
    python run_backtest.py --token TOKEN_ID --start 2024-01-01 --end 2024-12-31
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory (bot root) to path
bot_dir = Path(__file__).parent.parent
sys.path.insert(0, str(bot_dir))

from backtest.backtest_engine import BacktestEngine
from backtest.visualization import BacktestVisualizer


def parse_args():
    parser = argparse.ArgumentParser(description="Run backtest for Polymarket bot")

    parser.add_argument(
        "--token",
        required=True,
        help="Token ID to backtest"
    )
    parser.add_argument(
        "--start",
        required=True,
        help="Start date (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--end",
        required=True,
        help="End date (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--capital",
        type=float,
        default=10000.0,
        help="Initial capital (default: 10000)"
    )
    parser.add_argument(
        "--slippage",
        type=float,
        default=0.001,
        help="Slippage percentage (default: 0.001 = 0.1%%)"
    )
    parser.add_argument(
        "--step",
        type=int,
        default=1,
        help="Time step in minutes (default: 1)"
    )
    parser.add_argument(
        "--no-charts",
        action="store_true",
        help="Skip chart generation"
    )

    return parser.parse_args()


def main():
    args = parse_args()

    # Parse dates
    start = datetime.strptime(args.start, "%Y-%m-%d")
    end = datetime.strptime(args.end, "%Y-%m-%d")

    # Create engine
    engine = BacktestEngine(
        bot_dir=str(bot_dir),
        token_id=args.token,
        start=start,
        end=end,
        initial_capital=args.capital,
        slippage_pct=args.slippage,
        time_step_minutes=args.step,
    )

    # Run backtest
    results = engine.run()

    # Generate visualizations
    if not args.no_charts:
        output_dir = bot_dir / "backtest" / "results"
        viz = BacktestVisualizer(results, output_dir=str(output_dir))
        viz.generate_all()

    print("\nBacktest complete!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### 7. requirements.txt

```
# Backtesting dependencies
pandas>=2.0.0
numpy>=1.24.0
matplotlib>=3.7.0
pyarrow>=12.0.0
requests>=2.28.0
```

## Output

After creating all files, return a manifest:

```markdown
## Scaffolding Complete

### Bot: {bot_name}
### Location: {bot_dir}/backtest/

### Files Created

| File | Purpose | Lines |
|------|---------|-------|
| __init__.py | Package init | ~5 |
| mock_client.py | MockClobClient | ~250 |
| data_loader.py | Historical data | ~150 |
| backtest_engine.py | Main engine | ~200 |
| metrics.py | Performance metrics | ~150 |
| visualization.py | Charts/reports | ~150 |
| run_backtest.py | CLI entry point | ~80 |
| requirements.txt | Dependencies | ~6 |

### Usage

```bash
cd {bot_dir}
pip install -r backtest/requirements.txt

python backtest/run_backtest.py \
    --token YOUR_TOKEN_ID \
    --start 2024-01-01 \
    --end 2024-12-31
```

### Next Steps
1. Review mock_client.py to ensure all bot methods are mocked
2. Run backtest with a test token
3. Verify results make sense
```

## Critical Rules

1. **NEVER modify original bot files** - All code in backtest/
2. **Match interfaces exactly** - Mock returns must match real client
3. **Document assumptions** - Note where simulation differs from reality
4. **Include error handling** - Gracefully handle missing data
5. **Cache data** - Don't re-fetch on every run
