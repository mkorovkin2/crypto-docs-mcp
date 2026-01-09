"""
Backtest Engine Template

This template provides the main backtest orchestration logic that:
1. Loads historical data
2. Advances time through the simulation
3. Calls the bot's strategy at each time step
4. Tracks equity and records results

USAGE:
    The backtest-mock-scaffolder agent should customize the strategy
    integration based on the specific bot being backtested.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional
import pandas as pd
import logging

# These would be imported from the generated files
# from mock_client import MockClobClient
# from data_loader import DataLoader
# from metrics import MetricsCalculator, EquityPoint, BacktestMetrics


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class BacktestConfig:
    """Configuration for a backtest run."""
    token_id: str
    start_date: datetime
    end_date: datetime
    initial_capital: float = 10000.0
    slippage_pct: float = 0.001  # 0.1%
    maker_fee: float = 0.0
    taker_fee: float = 0.0
    time_step: timedelta = timedelta(minutes=1)
    warmup_periods: int = 60  # Number of periods before trading starts


@dataclass
class BacktestResult:
    """Results from a backtest run."""
    config: BacktestConfig
    metrics: Any  # BacktestMetrics
    equity_curve: List[Any]  # List[EquityPoint]
    trades: List[Any]  # List[TradeRecord]
    final_portfolio: Dict[str, Any]
    warnings: List[str]


class BacktestEngine:
    """
    Main backtest orchestration engine.

    Usage:
        # Initialize
        engine = BacktestEngine(config)

        # Load data
        engine.load_data(data_loader)

        # Register strategy callback
        engine.set_strategy(my_strategy_func)

        # Run
        result = engine.run()
    """

    def __init__(self, config: BacktestConfig):
        """
        Initialize the backtest engine.

        Args:
            config: Backtest configuration
        """
        self.config = config
        self.price_data: Optional[pd.DataFrame] = None
        self.trade_data: Optional[pd.DataFrame] = None
        self.mock_client: Optional[Any] = None  # MockClobClient
        self.strategy_func: Optional[Callable] = None
        self.equity_curve: List[Any] = []
        self.warnings: List[str] = []

    def load_data(self, data_loader: Any) -> None:
        """
        Load historical data using the data loader.

        Args:
            data_loader: DataLoader instance
        """
        logger.info(f"Loading data for {self.config.token_id}")
        logger.info(f"Period: {self.config.start_date} to {self.config.end_date}")

        # Add warmup period to start date
        warmup_time = self.config.time_step * self.config.warmup_periods
        fetch_start = self.config.start_date - warmup_time

        self.price_data = data_loader.load_price_data(
            token_id=self.config.token_id,
            start=fetch_start,
            end=self.config.end_date
        )

        if self.price_data.empty:
            raise ValueError(f"No price data available for {self.config.token_id}")

        # Validate data coverage
        data_start = self.price_data.index.min()
        data_end = self.price_data.index.max()
        expected_periods = (self.config.end_date - self.config.start_date) / self.config.time_step
        actual_periods = len(self.price_data)

        coverage = actual_periods / expected_periods if expected_periods > 0 else 0
        logger.info(f"Data coverage: {coverage:.1%} ({actual_periods} periods)")

        if coverage < 0.8:
            self.warnings.append(f"Low data coverage: {coverage:.1%}")

        # Optionally load trade data
        try:
            self.trade_data = data_loader.load_trade_data(
                token_id=self.config.token_id,
                start=fetch_start,
                end=self.config.end_date
            )
        except Exception as e:
            logger.warning(f"Could not load trade data: {e}")
            self.trade_data = None

        logger.info(f"Loaded {len(self.price_data)} price bars")

    def set_strategy(self, strategy_func: Callable[[Any, datetime], None]) -> None:
        """
        Set the strategy function to call at each time step.

        The strategy function should have signature:
            def strategy(mock_client: MockClobClient, current_time: datetime) -> None

        It should use the mock_client to:
            - Get prices/orderbook
            - Make trading decisions
            - Place orders

        Args:
            strategy_func: Strategy callback function
        """
        self.strategy_func = strategy_func

    def run(self) -> BacktestResult:
        """
        Run the backtest simulation.

        Returns:
            BacktestResult with metrics and equity curve
        """
        if self.price_data is None:
            raise ValueError("Data not loaded. Call load_data() first.")
        if self.strategy_func is None:
            raise ValueError("Strategy not set. Call set_strategy() first.")

        logger.info("Starting backtest simulation")

        # Initialize mock client
        # Import here to avoid circular imports in template
        from mock_client import MockClobClient
        from metrics import MetricsCalculator, EquityPoint, TradeRecord

        self.mock_client = MockClobClient(
            price_data=self.price_data,
            trade_data=self.trade_data,
            initial_capital=self.config.initial_capital,
            slippage_pct=self.config.slippage_pct,
            maker_fee=self.config.maker_fee,
            taker_fee=self.config.taker_fee
        )

        # Get time steps
        timestamps = self.price_data.index.tolist()

        # Filter to simulation period (after warmup)
        sim_timestamps = [
            ts for ts in timestamps
            if ts >= self.config.start_date and ts <= self.config.end_date
        ]

        logger.info(f"Simulating {len(sim_timestamps)} time steps")

        # Main simulation loop
        for i, timestamp in enumerate(sim_timestamps):
            # Advance mock client time
            self.mock_client.set_time(timestamp)

            # Check and fill any pending limit orders
            filled_orders = self.mock_client.check_limit_orders()
            if filled_orders:
                logger.debug(f"Filled orders at {timestamp}: {filled_orders}")

            # Call strategy
            try:
                self.strategy_func(self.mock_client, timestamp)
            except Exception as e:
                logger.error(f"Strategy error at {timestamp}: {e}")
                self.warnings.append(f"Strategy error at {timestamp}: {str(e)}")

            # Record equity
            equity = self.mock_client.get_equity()
            self.equity_curve.append(EquityPoint(
                timestamp=timestamp,
                equity=equity,
                cash=self.mock_client.cash,
                position_value=equity - self.mock_client.cash
            ))

            # Progress logging
            if i > 0 and i % 1000 == 0:
                logger.info(f"Progress: {i}/{len(sim_timestamps)} ({i/len(sim_timestamps)*100:.1f}%)")

        logger.info("Simulation complete")

        # Calculate metrics
        calculator = MetricsCalculator(
            equity_curve=self.equity_curve,
            trades=self.mock_client.trade_history,
            initial_capital=self.config.initial_capital
        )
        metrics = calculator.calculate()

        # Build result
        result = BacktestResult(
            config=self.config,
            metrics=metrics,
            equity_curve=self.equity_curve,
            trades=self.mock_client.trade_history,
            final_portfolio=self.mock_client.get_portfolio_summary(),
            warnings=self.warnings
        )

        return result


def run_strategy_backtest(
    strategy_module: Any,
    config: BacktestConfig,
    data_loader: Any
) -> BacktestResult:
    """
    Convenience function to run a backtest on a strategy module.

    This function expects the strategy module to have:
    - A `run_iteration(client, timestamp)` function or
    - A class with `execute(client, timestamp)` method

    Args:
        strategy_module: Module containing strategy logic
        config: Backtest configuration
        data_loader: Data loader instance

    Returns:
        BacktestResult
    """
    engine = BacktestEngine(config)
    engine.load_data(data_loader)

    # Detect strategy interface
    if hasattr(strategy_module, 'run_iteration'):
        engine.set_strategy(strategy_module.run_iteration)
    elif hasattr(strategy_module, 'Strategy'):
        strategy_instance = strategy_module.Strategy()
        engine.set_strategy(strategy_instance.execute)
    else:
        raise ValueError(
            "Strategy module must have run_iteration() function or Strategy class"
        )

    return engine.run()


class WalkForwardAnalyzer:
    """
    Walk-forward analysis for more robust backtesting.

    Splits data into train/test windows and runs multiple backtests
    to avoid overfitting.
    """

    def __init__(
        self,
        full_config: BacktestConfig,
        train_days: int = 60,
        test_days: int = 30,
        step_days: int = 30
    ):
        """
        Initialize walk-forward analyzer.

        Args:
            full_config: Base backtest configuration
            train_days: Days in training window
            test_days: Days in test window
            step_days: Days to step forward between windows
        """
        self.base_config = full_config
        self.train_days = train_days
        self.test_days = test_days
        self.step_days = step_days
        self.results: List[BacktestResult] = []

    def run(
        self,
        strategy_func: Callable,
        data_loader: Any,
        optimize_func: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Run walk-forward analysis.

        Args:
            strategy_func: Strategy function
            data_loader: Data loader
            optimize_func: Optional function to optimize parameters on train data

        Returns:
            Aggregated results across all windows
        """
        current_start = self.base_config.start_date
        window_num = 0

        while current_start + timedelta(days=self.train_days + self.test_days) <= self.base_config.end_date:
            window_num += 1
            train_end = current_start + timedelta(days=self.train_days)
            test_start = train_end
            test_end = test_start + timedelta(days=self.test_days)

            logger.info(f"Window {window_num}: Train {current_start.date()} - {train_end.date()}, "
                       f"Test {test_start.date()} - {test_end.date()}")

            # Create test config
            test_config = BacktestConfig(
                token_id=self.base_config.token_id,
                start_date=test_start,
                end_date=test_end,
                initial_capital=self.base_config.initial_capital,
                slippage_pct=self.base_config.slippage_pct
            )

            # Run backtest on test period
            engine = BacktestEngine(test_config)
            engine.load_data(data_loader)
            engine.set_strategy(strategy_func)
            result = engine.run()

            self.results.append(result)
            current_start += timedelta(days=self.step_days)

        return self._aggregate_results()

    def _aggregate_results(self) -> Dict[str, Any]:
        """Aggregate results across all walk-forward windows."""
        if not self.results:
            return {"error": "No results"}

        total_returns = [r.metrics.total_return_pct for r in self.results]
        sharpes = [r.metrics.sharpe_ratio for r in self.results]
        max_dds = [r.metrics.max_drawdown_pct for r in self.results]

        return {
            "num_windows": len(self.results),
            "avg_return_pct": sum(total_returns) / len(total_returns),
            "avg_sharpe": sum(sharpes) / len(sharpes),
            "avg_max_drawdown_pct": sum(max_dds) / len(max_dds),
            "min_return_pct": min(total_returns),
            "max_return_pct": max(total_returns),
            "profitable_windows": sum(1 for r in total_returns if r > 0),
            "individual_results": [
                {
                    "period": f"{r.config.start_date.date()} - {r.config.end_date.date()}",
                    "return_pct": r.metrics.total_return_pct,
                    "sharpe": r.metrics.sharpe_ratio,
                    "max_dd_pct": r.metrics.max_drawdown_pct
                }
                for r in self.results
            ]
        }
