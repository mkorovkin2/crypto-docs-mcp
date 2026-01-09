"""
Data Loader Template for Backtesting

This template provides historical data fetching and caching for
Polymarket backtests.

USAGE:
    The backtest-mock-scaffolder agent should customize this based
    on the specific data requirements identified by the data researcher.

DATA SOURCES:
    - CLOB /prices-history: Historical price bars
    - CLOB /data/trades: Historical trades (requires auth)
    - Synthetic trade generation from price data
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import json
import os
import time
import requests
import pandas as pd
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class DataLoaderConfig:
    """Configuration for the data loader."""
    cache_dir: str = "backtest/data"
    clob_base_url: str = "https://clob.polymarket.com"
    requests_per_10s: int = 800  # Stay under 1000 limit
    default_fidelity: int = 1  # 1-minute bars


class RateLimiter:
    """Simple rate limiter for API calls."""

    def __init__(self, requests_per_10s: int):
        self.limit = requests_per_10s
        self.window = 10.0
        self.requests: List[float] = []

    def wait(self) -> None:
        """Wait if necessary to stay under rate limit."""
        now = time.time()
        self.requests = [t for t in self.requests if now - t < self.window]

        if len(self.requests) >= self.limit:
            sleep_time = self.requests[0] + self.window - now
            if sleep_time > 0:
                logger.debug(f"Rate limiting: sleeping {sleep_time:.2f}s")
                time.sleep(sleep_time)

        self.requests.append(time.time())


class DataLoader:
    """
    Historical data loader for Polymarket backtesting.

    Usage:
        loader = DataLoader(cache_dir="backtest/data")

        # Load price data
        prices = loader.load_price_data(
            token_id="TOKEN_ID",
            start=datetime(2024, 1, 1),
            end=datetime(2024, 12, 31)
        )

        # Load trade data (synthetic if auth not available)
        trades = loader.load_trade_data(token_id, start, end)
    """

    def __init__(self, config: Optional[DataLoaderConfig] = None):
        """
        Initialize the data loader.

        Args:
            config: DataLoaderConfig instance (uses defaults if None)
        """
        self.config = config or DataLoaderConfig()
        self.rate_limiter = RateLimiter(self.config.requests_per_10s)

        # Create cache directories
        os.makedirs(self.config.cache_dir, exist_ok=True)
        os.makedirs(os.path.join(self.config.cache_dir, "prices"), exist_ok=True)
        os.makedirs(os.path.join(self.config.cache_dir, "trades"), exist_ok=True)

        # Session for connection pooling
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "User-Agent": "polymarket-backtest/1.0"
        })

    def load_price_data(
        self,
        token_id: str,
        start: datetime,
        end: datetime,
        fidelity: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Load historical price data for a token.

        Args:
            token_id: The token ID to fetch prices for
            start: Start datetime
            end: End datetime
            fidelity: Price bar resolution in minutes (default: 1)

        Returns:
            DataFrame with DatetimeIndex and 'price' column
        """
        fidelity = fidelity or self.config.default_fidelity

        # Check cache first
        cache_path = self._get_price_cache_path(token_id, start, end, fidelity)
        if os.path.exists(cache_path):
            logger.info(f"Loading cached price data: {cache_path}")
            return pd.read_parquet(cache_path)

        # Fetch from API
        logger.info(f"Fetching price data for {token_id} ({start} to {end})")
        df = self._fetch_prices(token_id, start, end, fidelity)

        if not df.empty:
            # Cache the data
            df.to_parquet(cache_path)
            logger.info(f"Cached {len(df)} price bars to {cache_path}")

        return df

    def load_trade_data(
        self,
        token_id: str,
        start: datetime,
        end: datetime,
        synthesize: bool = True
    ) -> pd.DataFrame:
        """
        Load historical trade data.

        Note: Real trade data requires L2 authentication.
        If not available, can synthesize from price data.

        Args:
            token_id: The token ID
            start: Start datetime
            end: End datetime
            synthesize: If True, synthesize trades from price data when API fails

        Returns:
            DataFrame with trade records
        """
        cache_path = self._get_trade_cache_path(token_id, start, end)
        if os.path.exists(cache_path):
            logger.info(f"Loading cached trade data: {cache_path}")
            return pd.read_parquet(cache_path)

        # Try to fetch real trade data
        try:
            df = self._fetch_trades(token_id, start, end)
            if not df.empty:
                df.to_parquet(cache_path)
                return df
        except Exception as e:
            logger.warning(f"Could not fetch trade data: {e}")

        # Synthesize from price data if requested
        if synthesize:
            logger.info("Synthesizing trade data from prices")
            price_data = self.load_price_data(token_id, start, end)
            df = self._synthesize_trades(price_data)
            df.to_parquet(cache_path)
            return df

        return pd.DataFrame()

    def _fetch_prices(
        self,
        token_id: str,
        start: datetime,
        end: datetime,
        fidelity: int
    ) -> pd.DataFrame:
        """Fetch price history from CLOB API."""
        all_data = []

        # Fetch in chunks to handle large date ranges
        chunk_days = 30
        current = start

        while current < end:
            chunk_end = min(current + timedelta(days=chunk_days), end)

            self.rate_limiter.wait()

            url = f"{self.config.clob_base_url}/prices-history"
            params = {
                "market": token_id,
                "startTs": int(current.timestamp()),
                "endTs": int(chunk_end.timestamp()),
                "fidelity": fidelity
            }

            try:
                response = self.session.get(url, params=params, timeout=30)
                response.raise_for_status()
                data = response.json()

                if "history" in data:
                    all_data.extend(data["history"])
                    logger.debug(f"Fetched {len(data['history'])} bars for {current.date()} - {chunk_end.date()}")

            except requests.RequestException as e:
                logger.error(f"API error fetching prices: {e}")
                # Continue with partial data

            current = chunk_end

        if not all_data:
            return pd.DataFrame()

        # Convert to DataFrame
        df = pd.DataFrame(all_data)
        df["timestamp"] = pd.to_datetime(df["t"], unit="s")
        df["price"] = df["p"].astype(float)
        df = df.set_index("timestamp")
        df = df[["price"]].sort_index()

        # Remove duplicates
        df = df[~df.index.duplicated(keep='last')]

        return df

    def _fetch_trades(
        self,
        token_id: str,
        start: datetime,
        end: datetime
    ) -> pd.DataFrame:
        """Fetch trade history from CLOB API (requires auth)."""
        # Note: This endpoint requires L2 authentication
        # For now, return empty and let caller use synthetic trades

        url = f"{self.config.clob_base_url}/data/trades"
        params = {
            "market": token_id,
            "after": int(start.timestamp()),
            "before": int(end.timestamp())
        }

        self.rate_limiter.wait()

        try:
            response = self.session.get(url, params=params, timeout=30)
            if response.status_code == 401:
                raise PermissionError("Trade data requires L2 authentication")
            response.raise_for_status()
            data = response.json()

            if not data:
                return pd.DataFrame()

            df = pd.DataFrame(data)
            df["timestamp"] = pd.to_datetime(df["match_time"], unit="s")
            df = df.set_index("timestamp")
            return df

        except requests.RequestException as e:
            logger.error(f"API error fetching trades: {e}")
            raise

    def _synthesize_trades(
        self,
        price_data: pd.DataFrame,
        base_size: float = 100.0,
        volatility_factor: float = 2.0
    ) -> pd.DataFrame:
        """
        Synthesize trades from price data.

        Creates realistic-looking trade data based on price movements.
        More volatile periods generate more/larger trades.

        Args:
            price_data: DataFrame with price column
            base_size: Base trade size
            volatility_factor: Multiplier for volatility-based sizing

        Returns:
            DataFrame with synthetic trade records
        """
        if price_data.empty:
            return pd.DataFrame()

        trades = []
        prev_price = None

        for idx, row in price_data.iterrows():
            price = row["price"]

            if prev_price is not None:
                # Calculate price change
                pct_change = (price - prev_price) / prev_price if prev_price > 0 else 0

                # Generate trade based on price movement
                if abs(pct_change) > 0.0001:  # Filter out tiny changes
                    # Size varies with volatility
                    size = base_size * (1 + abs(pct_change) * volatility_factor * 100)

                    # Side based on direction
                    side = "BUY" if pct_change > 0 else "SELL"

                    trades.append({
                        "timestamp": idx,
                        "price": str(price),
                        "size": str(size),
                        "side": side,
                        "synthetic": True
                    })

            prev_price = price

        if not trades:
            return pd.DataFrame()

        df = pd.DataFrame(trades)
        df = df.set_index("timestamp")
        return df

    def _get_price_cache_path(
        self,
        token_id: str,
        start: datetime,
        end: datetime,
        fidelity: int
    ) -> str:
        """Generate cache file path for price data."""
        # Use hash of token_id to handle long IDs
        token_hash = str(hash(token_id))[:12]
        filename = f"{token_hash}_{start.date()}_{end.date()}_f{fidelity}.parquet"
        return os.path.join(self.config.cache_dir, "prices", filename)

    def _get_trade_cache_path(
        self,
        token_id: str,
        start: datetime,
        end: datetime
    ) -> str:
        """Generate cache file path for trade data."""
        token_hash = str(hash(token_id))[:12]
        filename = f"{token_hash}_{start.date()}_{end.date()}_trades.parquet"
        return os.path.join(self.config.cache_dir, "trades", filename)

    def validate_data(
        self,
        df: pd.DataFrame,
        start: datetime,
        end: datetime,
        expected_freq: str = "1T"  # 1-minute
    ) -> Dict[str, any]:
        """
        Validate data quality and return statistics.

        Args:
            df: DataFrame to validate
            start: Expected start time
            end: Expected end time
            expected_freq: Expected data frequency

        Returns:
            Dict with validation results
        """
        if df.empty:
            return {
                "valid": False,
                "error": "Empty DataFrame",
                "coverage": 0.0
            }

        # Check date range coverage
        actual_start = df.index.min()
        actual_end = df.index.max()

        # Calculate coverage
        expected_duration = (end - start).total_seconds()
        actual_duration = (actual_end - actual_start).total_seconds()
        coverage = actual_duration / expected_duration if expected_duration > 0 else 0

        # Check for gaps
        expected_rows = expected_duration / 60  # Assuming 1-minute bars
        actual_rows = len(df)
        completeness = actual_rows / expected_rows if expected_rows > 0 else 0

        # Check price validity (should be between 0 and 1)
        if "price" in df.columns:
            invalid_prices = ~df["price"].between(0, 1)
            price_valid = not invalid_prices.any()
        else:
            price_valid = True

        return {
            "valid": coverage >= 0.5 and price_valid,
            "coverage": coverage,
            "completeness": completeness,
            "actual_start": actual_start,
            "actual_end": actual_end,
            "row_count": actual_rows,
            "price_valid": price_valid,
            "warnings": self._generate_warnings(coverage, completeness, price_valid)
        }

    def _generate_warnings(
        self,
        coverage: float,
        completeness: float,
        price_valid: bool
    ) -> List[str]:
        """Generate warning messages based on validation results."""
        warnings = []

        if coverage < 0.9:
            warnings.append(f"Data coverage is only {coverage:.1%}")

        if completeness < 0.8:
            warnings.append(f"Data completeness is only {completeness:.1%}")

        if not price_valid:
            warnings.append("Some prices are outside valid range [0, 1]")

        return warnings

    def clear_cache(self, token_id: Optional[str] = None) -> int:
        """
        Clear cached data.

        Args:
            token_id: If provided, only clear cache for this token.
                     If None, clear all cached data.

        Returns:
            Number of files deleted
        """
        deleted = 0

        for subdir in ["prices", "trades"]:
            cache_dir = os.path.join(self.config.cache_dir, subdir)
            if not os.path.exists(cache_dir):
                continue

            for filename in os.listdir(cache_dir):
                filepath = os.path.join(cache_dir, filename)

                if token_id is not None:
                    token_hash = str(hash(token_id))[:12]
                    if not filename.startswith(token_hash):
                        continue

                os.remove(filepath)
                deleted += 1

        logger.info(f"Cleared {deleted} cached files")
        return deleted

    def get_cache_stats(self) -> Dict[str, any]:
        """Get statistics about cached data."""
        stats = {
            "price_files": 0,
            "trade_files": 0,
            "total_size_mb": 0.0
        }

        for subdir in ["prices", "trades"]:
            cache_dir = os.path.join(self.config.cache_dir, subdir)
            if not os.path.exists(cache_dir):
                continue

            for filename in os.listdir(cache_dir):
                filepath = os.path.join(cache_dir, filename)
                size = os.path.getsize(filepath)
                stats["total_size_mb"] += size / (1024 * 1024)

                if subdir == "prices":
                    stats["price_files"] += 1
                else:
                    stats["trade_files"] += 1

        return stats


def create_sample_data(
    output_path: str,
    days: int = 90,
    start_price: float = 0.5
) -> pd.DataFrame:
    """
    Create sample price data for testing.

    This generates synthetic price data following a random walk
    with mean-reversion to test backtesting infrastructure.

    Args:
        output_path: Where to save the data
        days: Number of days of data
        start_price: Starting price

    Returns:
        Generated DataFrame
    """
    import random

    timestamps = []
    prices = []

    current_price = start_price
    current_time = datetime.now() - timedelta(days=days)
    end_time = datetime.now()

    while current_time < end_time:
        timestamps.append(current_time)
        prices.append(current_price)

        # Random walk with mean reversion
        drift = 0.0001 * (0.5 - current_price)  # Pull toward 0.5
        volatility = 0.001
        change = drift + volatility * random.gauss(0, 1)

        current_price = max(0.01, min(0.99, current_price + change))
        current_time += timedelta(minutes=1)

    df = pd.DataFrame({
        "timestamp": timestamps,
        "price": prices
    })
    df = df.set_index("timestamp")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_parquet(output_path)

    return df
