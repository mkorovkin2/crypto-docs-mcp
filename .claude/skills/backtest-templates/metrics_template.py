"""
Metrics Template for Backtesting

This template provides comprehensive performance metrics calculation
for Polymarket bot backtests.

USAGE:
    The backtest-mock-scaffolder agent can use this template directly
    or customize it based on specific strategy needs.

METRICS CALCULATED:
    - Total Return, Annualized Return
    - Sharpe Ratio, Sortino Ratio, Calmar Ratio
    - Maximum Drawdown, Average Drawdown
    - Win Rate, Profit Factor
    - Trade Statistics (avg win, avg loss, etc.)
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
import math


@dataclass
class TradeRecord:
    """Record of a single trade."""
    timestamp: datetime
    token_id: str
    side: str  # "BUY" or "SELL"
    size: float
    price: float
    fee: float
    slippage: float


@dataclass
class EquityPoint:
    """Point on the equity curve."""
    timestamp: datetime
    equity: float
    cash: float
    position_value: float


@dataclass
class BacktestMetrics:
    """Complete metrics from a backtest run."""
    # Time period
    start_date: datetime
    end_date: datetime
    trading_days: int

    # Returns
    initial_capital: float
    final_equity: float
    total_return_pct: float
    annualized_return_pct: float

    # Risk metrics
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    max_drawdown_pct: float
    avg_drawdown_pct: float
    max_drawdown_duration_days: int

    # Trade statistics
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate_pct: float
    profit_factor: float
    avg_trade_return_pct: float
    avg_winning_trade_pct: float
    avg_losing_trade_pct: float
    largest_win_pct: float
    largest_loss_pct: float

    # Volume
    total_volume: float
    total_fees: float

    # Kelly criterion
    kelly_fraction: float

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "period": {
                "start": self.start_date.isoformat(),
                "end": self.end_date.isoformat(),
                "trading_days": self.trading_days
            },
            "returns": {
                "initial_capital": round(self.initial_capital, 2),
                "final_equity": round(self.final_equity, 2),
                "total_return_pct": round(self.total_return_pct, 2),
                "annualized_return_pct": round(self.annualized_return_pct, 2)
            },
            "risk": {
                "sharpe_ratio": round(self.sharpe_ratio, 3),
                "sortino_ratio": round(self.sortino_ratio, 3),
                "calmar_ratio": round(self.calmar_ratio, 3),
                "max_drawdown_pct": round(self.max_drawdown_pct, 2),
                "avg_drawdown_pct": round(self.avg_drawdown_pct, 2),
                "max_drawdown_duration_days": self.max_drawdown_duration_days
            },
            "trades": {
                "total": self.total_trades,
                "winning": self.winning_trades,
                "losing": self.losing_trades,
                "win_rate_pct": round(self.win_rate_pct, 2),
                "profit_factor": round(self.profit_factor, 3),
                "avg_trade_return_pct": round(self.avg_trade_return_pct, 2),
                "avg_winning_trade_pct": round(self.avg_winning_trade_pct, 2),
                "avg_losing_trade_pct": round(self.avg_losing_trade_pct, 2),
                "largest_win_pct": round(self.largest_win_pct, 2),
                "largest_loss_pct": round(self.largest_loss_pct, 2)
            },
            "volume": {
                "total_volume": round(self.total_volume, 2),
                "total_fees": round(self.total_fees, 4)
            },
            "kelly_fraction": round(self.kelly_fraction, 3)
        }


class MetricsCalculator:
    """
    Calculate comprehensive backtesting metrics.

    Usage:
        calculator = MetricsCalculator(
            equity_curve=equity_points,
            trades=trade_records,
            initial_capital=10000.0,
            risk_free_rate=0.05  # 5% annual
        )
        metrics = calculator.calculate()
    """

    def __init__(
        self,
        equity_curve: List[EquityPoint],
        trades: List[TradeRecord],
        initial_capital: float,
        risk_free_rate: float = 0.05,  # Annual risk-free rate
    ):
        """
        Initialize the metrics calculator.

        Args:
            equity_curve: List of equity points over time
            trades: List of trade records
            initial_capital: Starting capital
            risk_free_rate: Annual risk-free rate for Sharpe/Sortino
        """
        self.equity_curve = sorted(equity_curve, key=lambda x: x.timestamp)
        self.trades = sorted(trades, key=lambda x: x.timestamp)
        self.initial_capital = initial_capital
        self.risk_free_rate = risk_free_rate

    def calculate(self) -> BacktestMetrics:
        """Calculate all metrics and return BacktestMetrics dataclass."""
        if not self.equity_curve:
            return self._empty_metrics()

        # Time period
        start_date = self.equity_curve[0].timestamp
        end_date = self.equity_curve[-1].timestamp
        trading_days = (end_date - start_date).days or 1

        # Returns
        final_equity = self.equity_curve[-1].equity
        total_return = (final_equity - self.initial_capital) / self.initial_capital
        annualized_return = self._annualize_return(total_return, trading_days)

        # Daily returns for risk metrics
        daily_returns = self._calculate_daily_returns()

        # Risk metrics
        sharpe = self._calculate_sharpe(daily_returns)
        sortino = self._calculate_sortino(daily_returns)
        max_dd, avg_dd, max_dd_duration = self._calculate_drawdowns()
        calmar = self._calculate_calmar(annualized_return, max_dd)

        # Trade statistics
        trade_stats = self._calculate_trade_statistics()

        # Volume and fees
        total_volume = sum(t.size * t.price for t in self.trades)
        total_fees = sum(t.fee for t in self.trades)

        # Kelly
        kelly = self._calculate_kelly(trade_stats)

        return BacktestMetrics(
            start_date=start_date,
            end_date=end_date,
            trading_days=trading_days,
            initial_capital=self.initial_capital,
            final_equity=final_equity,
            total_return_pct=total_return * 100,
            annualized_return_pct=annualized_return * 100,
            sharpe_ratio=sharpe,
            sortino_ratio=sortino,
            calmar_ratio=calmar,
            max_drawdown_pct=max_dd * 100,
            avg_drawdown_pct=avg_dd * 100,
            max_drawdown_duration_days=max_dd_duration,
            total_trades=trade_stats["total"],
            winning_trades=trade_stats["winning"],
            losing_trades=trade_stats["losing"],
            win_rate_pct=trade_stats["win_rate"] * 100,
            profit_factor=trade_stats["profit_factor"],
            avg_trade_return_pct=trade_stats["avg_return"] * 100,
            avg_winning_trade_pct=trade_stats["avg_win"] * 100,
            avg_losing_trade_pct=trade_stats["avg_loss"] * 100,
            largest_win_pct=trade_stats["largest_win"] * 100,
            largest_loss_pct=trade_stats["largest_loss"] * 100,
            total_volume=total_volume,
            total_fees=total_fees,
            kelly_fraction=kelly
        )

    def _empty_metrics(self) -> BacktestMetrics:
        """Return empty metrics when no data."""
        now = datetime.now()
        return BacktestMetrics(
            start_date=now,
            end_date=now,
            trading_days=0,
            initial_capital=self.initial_capital,
            final_equity=self.initial_capital,
            total_return_pct=0.0,
            annualized_return_pct=0.0,
            sharpe_ratio=0.0,
            sortino_ratio=0.0,
            calmar_ratio=0.0,
            max_drawdown_pct=0.0,
            avg_drawdown_pct=0.0,
            max_drawdown_duration_days=0,
            total_trades=0,
            winning_trades=0,
            losing_trades=0,
            win_rate_pct=0.0,
            profit_factor=0.0,
            avg_trade_return_pct=0.0,
            avg_winning_trade_pct=0.0,
            avg_losing_trade_pct=0.0,
            largest_win_pct=0.0,
            largest_loss_pct=0.0,
            total_volume=0.0,
            total_fees=0.0,
            kelly_fraction=0.0
        )

    def _annualize_return(self, total_return: float, days: int) -> float:
        """Annualize a return based on number of days."""
        if days <= 0:
            return 0.0
        years = days / 365.0
        if total_return <= -1:
            return -1.0
        return (1 + total_return) ** (1 / years) - 1

    def _calculate_daily_returns(self) -> List[float]:
        """Calculate daily returns from equity curve."""
        returns = []
        prev_equity = self.initial_capital

        # Group by date
        daily_equity = {}
        for point in self.equity_curve:
            date_key = point.timestamp.date()
            daily_equity[date_key] = point.equity

        for date_key in sorted(daily_equity.keys()):
            equity = daily_equity[date_key]
            if prev_equity > 0:
                daily_return = (equity - prev_equity) / prev_equity
                returns.append(daily_return)
            prev_equity = equity

        return returns

    def _calculate_sharpe(self, daily_returns: List[float]) -> float:
        """
        Calculate Sharpe ratio.

        Sharpe = (mean_return - risk_free_rate) / std_dev
        """
        if not daily_returns or len(daily_returns) < 2:
            return 0.0

        mean_return = sum(daily_returns) / len(daily_returns)
        daily_rf = self.risk_free_rate / 252  # Daily risk-free rate

        variance = sum((r - mean_return) ** 2 for r in daily_returns) / (len(daily_returns) - 1)
        std_dev = math.sqrt(variance) if variance > 0 else 0

        if std_dev == 0:
            return 0.0

        daily_sharpe = (mean_return - daily_rf) / std_dev
        annual_sharpe = daily_sharpe * math.sqrt(252)  # Annualize

        return annual_sharpe

    def _calculate_sortino(self, daily_returns: List[float]) -> float:
        """
        Calculate Sortino ratio (uses downside deviation only).

        Sortino = (mean_return - risk_free_rate) / downside_deviation
        """
        if not daily_returns or len(daily_returns) < 2:
            return 0.0

        mean_return = sum(daily_returns) / len(daily_returns)
        daily_rf = self.risk_free_rate / 252

        # Calculate downside deviation (only negative returns)
        downside_returns = [min(0, r - daily_rf) for r in daily_returns]
        downside_variance = sum(r ** 2 for r in downside_returns) / len(downside_returns)
        downside_dev = math.sqrt(downside_variance) if downside_variance > 0 else 0

        if downside_dev == 0:
            return 0.0 if mean_return <= daily_rf else float('inf')

        daily_sortino = (mean_return - daily_rf) / downside_dev
        annual_sortino = daily_sortino * math.sqrt(252)

        return min(annual_sortino, 100.0)  # Cap at reasonable value

    def _calculate_drawdowns(self) -> Tuple[float, float, int]:
        """
        Calculate maximum and average drawdown.

        Returns:
            (max_drawdown, avg_drawdown, max_drawdown_duration_days)
        """
        if not self.equity_curve:
            return 0.0, 0.0, 0

        peak = self.equity_curve[0].equity
        max_drawdown = 0.0
        drawdowns = []
        current_dd_start = None
        max_dd_duration = 0
        current_dd_duration = 0

        for point in self.equity_curve:
            if point.equity > peak:
                # New peak reached
                peak = point.equity
                if current_dd_start is not None:
                    # Recovered from drawdown
                    current_dd_duration = (point.timestamp - current_dd_start).days
                    max_dd_duration = max(max_dd_duration, current_dd_duration)
                    current_dd_start = None
            else:
                # In drawdown
                drawdown = (peak - point.equity) / peak if peak > 0 else 0
                max_drawdown = max(max_drawdown, drawdown)
                drawdowns.append(drawdown)

                if current_dd_start is None:
                    current_dd_start = point.timestamp

        # Check if still in drawdown at end
        if current_dd_start is not None:
            current_dd_duration = (self.equity_curve[-1].timestamp - current_dd_start).days
            max_dd_duration = max(max_dd_duration, current_dd_duration)

        avg_drawdown = sum(drawdowns) / len(drawdowns) if drawdowns else 0.0

        return max_drawdown, avg_drawdown, max_dd_duration

    def _calculate_calmar(self, annualized_return: float, max_drawdown: float) -> float:
        """
        Calculate Calmar ratio.

        Calmar = Annualized Return / Max Drawdown
        """
        if max_drawdown == 0:
            return 0.0 if annualized_return <= 0 else float('inf')
        return annualized_return / max_drawdown

    def _calculate_trade_statistics(self) -> dict:
        """Calculate win rate, profit factor, and trade statistics."""
        if not self.trades:
            return {
                "total": 0, "winning": 0, "losing": 0,
                "win_rate": 0.0, "profit_factor": 0.0,
                "avg_return": 0.0, "avg_win": 0.0, "avg_loss": 0.0,
                "largest_win": 0.0, "largest_loss": 0.0
            }

        # Group trades into round trips (buy followed by sell)
        round_trips = self._calculate_round_trips()

        if not round_trips:
            return {
                "total": len(self.trades), "winning": 0, "losing": 0,
                "win_rate": 0.0, "profit_factor": 0.0,
                "avg_return": 0.0, "avg_win": 0.0, "avg_loss": 0.0,
                "largest_win": 0.0, "largest_loss": 0.0
            }

        winning = [r for r in round_trips if r > 0]
        losing = [r for r in round_trips if r < 0]

        gross_profit = sum(winning) if winning else 0
        gross_loss = abs(sum(losing)) if losing else 0

        return {
            "total": len(round_trips),
            "winning": len(winning),
            "losing": len(losing),
            "win_rate": len(winning) / len(round_trips) if round_trips else 0.0,
            "profit_factor": gross_profit / gross_loss if gross_loss > 0 else float('inf'),
            "avg_return": sum(round_trips) / len(round_trips) if round_trips else 0.0,
            "avg_win": sum(winning) / len(winning) if winning else 0.0,
            "avg_loss": sum(losing) / len(losing) if losing else 0.0,
            "largest_win": max(winning) if winning else 0.0,
            "largest_loss": min(losing) if losing else 0.0
        }

    def _calculate_round_trips(self) -> List[float]:
        """
        Calculate returns from round-trip trades.

        A round trip is: BUY -> SELL (or SELL -> BUY for shorts)
        Returns list of percentage returns per round trip.
        """
        round_trips = []
        position_stack = []  # (size, price, side)

        for trade in self.trades:
            if trade.side == "BUY":
                # Opening or adding to long position
                position_stack.append((trade.size, trade.price, "BUY"))
            else:  # SELL
                if position_stack and position_stack[-1][2] == "BUY":
                    # Closing long position
                    entry_size, entry_price, _ = position_stack.pop()
                    exit_price = trade.price
                    # Calculate return percentage
                    pnl_pct = (exit_price - entry_price) / entry_price
                    round_trips.append(pnl_pct)
                else:
                    # Opening short (not typical for Polymarket, but handle)
                    position_stack.append((trade.size, trade.price, "SELL"))

        return round_trips

    def _calculate_kelly(self, trade_stats: dict) -> float:
        """
        Calculate Kelly criterion optimal bet fraction.

        Kelly = (win_rate * avg_win - (1 - win_rate) * abs(avg_loss)) / abs(avg_win)

        Capped at 0.5 for safety.
        """
        win_rate = trade_stats["win_rate"]
        avg_win = trade_stats["avg_win"]
        avg_loss = abs(trade_stats["avg_loss"])

        if avg_win == 0:
            return 0.0

        # Kelly formula
        kelly = (win_rate * avg_win - (1 - win_rate) * avg_loss) / avg_win

        # Cap at reasonable fraction and ensure non-negative
        return max(0.0, min(kelly, 0.5))


def generate_report(metrics: BacktestMetrics) -> str:
    """Generate a human-readable report from metrics."""
    report = f"""
================================================================================
                        BACKTEST PERFORMANCE REPORT
================================================================================

PERIOD: {metrics.start_date.strftime('%Y-%m-%d')} to {metrics.end_date.strftime('%Y-%m-%d')} ({metrics.trading_days} days)

RETURNS
--------------------------------------------------------------------------------
  Initial Capital:      ${metrics.initial_capital:>14,.2f}
  Final Equity:         ${metrics.final_equity:>14,.2f}
  Total Return:         {metrics.total_return_pct:>14.2f}%
  Annualized Return:    {metrics.annualized_return_pct:>14.2f}%

RISK METRICS
--------------------------------------------------------------------------------
  Sharpe Ratio:         {metrics.sharpe_ratio:>14.3f}
  Sortino Ratio:        {metrics.sortino_ratio:>14.3f}
  Calmar Ratio:         {metrics.calmar_ratio:>14.3f}
  Max Drawdown:         {metrics.max_drawdown_pct:>14.2f}%
  Avg Drawdown:         {metrics.avg_drawdown_pct:>14.2f}%
  Max DD Duration:      {metrics.max_drawdown_duration_days:>14} days

TRADE STATISTICS
--------------------------------------------------------------------------------
  Total Trades:         {metrics.total_trades:>14}
  Winning Trades:       {metrics.winning_trades:>14}
  Losing Trades:        {metrics.losing_trades:>14}
  Win Rate:             {metrics.win_rate_pct:>14.2f}%
  Profit Factor:        {metrics.profit_factor:>14.3f}

  Avg Trade Return:     {metrics.avg_trade_return_pct:>14.2f}%
  Avg Winning Trade:    {metrics.avg_winning_trade_pct:>14.2f}%
  Avg Losing Trade:     {metrics.avg_losing_trade_pct:>14.2f}%
  Largest Win:          {metrics.largest_win_pct:>14.2f}%
  Largest Loss:         {metrics.largest_loss_pct:>14.2f}%

VOLUME & FEES
--------------------------------------------------------------------------------
  Total Volume:         ${metrics.total_volume:>14,.2f}
  Total Fees:           ${metrics.total_fees:>14,.4f}

OPTIMAL SIZING
--------------------------------------------------------------------------------
  Kelly Fraction:       {metrics.kelly_fraction:>14.3f} (max recommended bet size)

================================================================================
"""
    return report


def calculate_rolling_sharpe(
    equity_curve: List[EquityPoint],
    window_days: int = 30
) -> List[Tuple[datetime, float]]:
    """
    Calculate rolling Sharpe ratio.

    Args:
        equity_curve: Equity points
        window_days: Rolling window in days

    Returns:
        List of (timestamp, sharpe) tuples
    """
    rolling_sharpe = []

    for i, point in enumerate(equity_curve):
        # Get window of points
        window_start = point.timestamp - timedelta(days=window_days)
        window_points = [p for p in equity_curve[:i+1]
                        if p.timestamp >= window_start]

        if len(window_points) < 5:  # Need minimum data
            continue

        # Calculate returns in window
        returns = []
        for j in range(1, len(window_points)):
            prev = window_points[j-1].equity
            curr = window_points[j].equity
            if prev > 0:
                returns.append((curr - prev) / prev)

        if len(returns) < 2:
            continue

        mean_return = sum(returns) / len(returns)
        variance = sum((r - mean_return) ** 2 for r in returns) / (len(returns) - 1)
        std_dev = math.sqrt(variance) if variance > 0 else 0

        if std_dev > 0:
            daily_sharpe = mean_return / std_dev
            annual_sharpe = daily_sharpe * math.sqrt(252)
            rolling_sharpe.append((point.timestamp, annual_sharpe))

    return rolling_sharpe
