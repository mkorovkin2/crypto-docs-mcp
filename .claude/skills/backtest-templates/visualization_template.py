"""
Visualization Template for Backtesting

This template provides charting and visualization functions for
backtest results, including equity curves, drawdown charts, and
trade analysis.

USAGE:
    The backtest-mock-scaffolder agent should include this in the
    generated backtesting infrastructure.

DEPENDENCIES:
    - matplotlib
    - pandas
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import os

# Handle matplotlib backend for headless environments
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.gridspec import GridSpec


@dataclass
class EquityPoint:
    """Point on the equity curve."""
    timestamp: datetime
    equity: float
    cash: float
    position_value: float


@dataclass
class TradeRecord:
    """Record of a single trade."""
    timestamp: datetime
    token_id: str
    side: str
    size: float
    price: float
    fee: float
    slippage: float


class BacktestVisualizer:
    """
    Generate visualizations for backtest results.

    Usage:
        viz = BacktestVisualizer(output_dir="backtest/results")
        viz.plot_equity_curve(equity_curve, metrics)
        viz.plot_trade_analysis(trades, equity_curve)
        viz.generate_full_report(result)
    """

    def __init__(self, output_dir: str = "backtest/results"):
        """
        Initialize the visualizer.

        Args:
            output_dir: Directory to save chart images
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

        # Style settings
        plt.style.use('seaborn-v0_8-whitegrid')
        self.colors = {
            'equity': '#2E86AB',
            'cash': '#A23B72',
            'drawdown': '#F18F01',
            'buy': '#2ECC71',
            'sell': '#E74C3C',
            'benchmark': '#95A5A6'
        }

    def plot_equity_curve(
        self,
        equity_curve: List[EquityPoint],
        metrics: Any,
        benchmark: Optional[List[Tuple[datetime, float]]] = None,
        save_path: Optional[str] = None
    ) -> str:
        """
        Plot the equity curve with drawdown overlay.

        Args:
            equity_curve: List of equity points
            metrics: BacktestMetrics object
            benchmark: Optional benchmark line (timestamps, values)
            save_path: Custom save path (default: equity_curve.png)

        Returns:
            Path to saved image
        """
        if not equity_curve:
            return ""

        fig = plt.figure(figsize=(14, 10))
        gs = GridSpec(3, 1, height_ratios=[3, 1, 1], hspace=0.1)

        # Extract data
        timestamps = [p.timestamp for p in equity_curve]
        equities = [p.equity for p in equity_curve]
        cash_values = [p.cash for p in equity_curve]

        # Calculate drawdown series
        peak = equities[0]
        drawdowns = []
        for eq in equities:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak if peak > 0 else 0
            drawdowns.append(dd * 100)  # As percentage

        # Plot 1: Equity curve
        ax1 = fig.add_subplot(gs[0])
        ax1.plot(timestamps, equities, color=self.colors['equity'],
                linewidth=2, label='Portfolio Value')
        ax1.plot(timestamps, cash_values, color=self.colors['cash'],
                linewidth=1, alpha=0.7, linestyle='--', label='Cash')

        if benchmark:
            bench_times, bench_values = zip(*benchmark)
            ax1.plot(bench_times, bench_values, color=self.colors['benchmark'],
                    linewidth=1, alpha=0.5, label='Benchmark')

        ax1.set_ylabel('Portfolio Value ($)', fontsize=12)
        ax1.set_title(f'Backtest Results: {metrics.total_return_pct:+.2f}% Return | '
                     f'Sharpe: {metrics.sharpe_ratio:.2f} | '
                     f'Max DD: {metrics.max_drawdown_pct:.1f}%',
                     fontsize=14, fontweight='bold')
        ax1.legend(loc='upper left')
        ax1.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
        ax1.tick_params(labelbottom=False)

        # Add horizontal line at initial capital
        initial = equity_curve[0].equity
        ax1.axhline(y=initial, color='gray', linestyle=':', alpha=0.5)

        # Plot 2: Drawdown
        ax2 = fig.add_subplot(gs[1], sharex=ax1)
        ax2.fill_between(timestamps, drawdowns, 0,
                        color=self.colors['drawdown'], alpha=0.3)
        ax2.plot(timestamps, drawdowns, color=self.colors['drawdown'],
                linewidth=1)
        ax2.set_ylabel('Drawdown (%)', fontsize=12)
        ax2.invert_yaxis()
        ax2.tick_params(labelbottom=False)

        # Plot 3: Rolling Sharpe (30-day)
        ax3 = fig.add_subplot(gs[2], sharex=ax1)
        rolling_sharpe = self._calculate_rolling_sharpe(equity_curve, window=30)
        if rolling_sharpe:
            rs_times, rs_values = zip(*rolling_sharpe)
            ax3.plot(rs_times, rs_values, color=self.colors['equity'],
                    linewidth=1, label='30-day Rolling Sharpe')
            ax3.axhline(y=0, color='gray', linestyle='-', alpha=0.3)
            ax3.axhline(y=1, color='green', linestyle='--', alpha=0.3)
            ax3.axhline(y=-1, color='red', linestyle='--', alpha=0.3)
        ax3.set_ylabel('Rolling Sharpe', fontsize=12)
        ax3.set_xlabel('Date', fontsize=12)
        ax3.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
        plt.xticks(rotation=45)

        plt.tight_layout()

        # Save
        save_path = save_path or os.path.join(self.output_dir, 'equity_curve.png')
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()

        return save_path

    def plot_trade_analysis(
        self,
        trades: List[TradeRecord],
        equity_curve: List[EquityPoint],
        save_path: Optional[str] = None
    ) -> str:
        """
        Plot trade analysis charts.

        Args:
            trades: List of trade records
            equity_curve: List of equity points (for context)
            save_path: Custom save path

        Returns:
            Path to saved image
        """
        if not trades:
            return ""

        fig = plt.figure(figsize=(14, 12))
        gs = GridSpec(3, 2, hspace=0.3, wspace=0.3)

        # Extract trade data
        buy_trades = [t for t in trades if t.side == "BUY"]
        sell_trades = [t for t in trades if t.side == "SELL"]

        # Plot 1: Trade distribution over time
        ax1 = fig.add_subplot(gs[0, :])
        buy_times = [t.timestamp for t in buy_trades]
        buy_sizes = [t.size * t.price for t in buy_trades]
        sell_times = [t.timestamp for t in sell_trades]
        sell_sizes = [t.size * t.price for t in sell_trades]

        ax1.scatter(buy_times, buy_sizes, color=self.colors['buy'],
                   alpha=0.6, s=30, label='Buys')
        ax1.scatter(sell_times, [-s for s in sell_sizes], color=self.colors['sell'],
                   alpha=0.6, s=30, label='Sells')
        ax1.axhline(y=0, color='gray', linestyle='-', alpha=0.3)
        ax1.set_ylabel('Trade Size ($)', fontsize=12)
        ax1.set_title('Trade Distribution Over Time', fontsize=12, fontweight='bold')
        ax1.legend()
        ax1.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
        plt.setp(ax1.xaxis.get_majorticklabels(), rotation=45)

        # Plot 2: Trade size histogram
        ax2 = fig.add_subplot(gs[1, 0])
        all_sizes = [t.size * t.price for t in trades]
        ax2.hist(all_sizes, bins=30, color=self.colors['equity'],
                edgecolor='white', alpha=0.7)
        ax2.set_xlabel('Trade Size ($)', fontsize=12)
        ax2.set_ylabel('Frequency', fontsize=12)
        ax2.set_title('Trade Size Distribution', fontsize=12, fontweight='bold')

        # Plot 3: Price distribution
        ax3 = fig.add_subplot(gs[1, 1])
        prices = [t.price for t in trades]
        ax3.hist(prices, bins=30, color=self.colors['cash'],
                edgecolor='white', alpha=0.7)
        ax3.set_xlabel('Execution Price', fontsize=12)
        ax3.set_ylabel('Frequency', fontsize=12)
        ax3.set_title('Price Distribution', fontsize=12, fontweight='bold')

        # Plot 4: Cumulative trades
        ax4 = fig.add_subplot(gs[2, 0])
        trade_times = sorted([t.timestamp for t in trades])
        cumulative = list(range(1, len(trade_times) + 1))
        ax4.plot(trade_times, cumulative, color=self.colors['equity'],
                linewidth=2)
        ax4.fill_between(trade_times, cumulative, alpha=0.3,
                        color=self.colors['equity'])
        ax4.set_xlabel('Date', fontsize=12)
        ax4.set_ylabel('Cumulative Trades', fontsize=12)
        ax4.set_title('Trading Activity', fontsize=12, fontweight='bold')
        ax4.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
        plt.setp(ax4.xaxis.get_majorticklabels(), rotation=45)

        # Plot 5: Slippage analysis
        ax5 = fig.add_subplot(gs[2, 1])
        slippages = [t.slippage * 100 for t in trades]  # As percentage
        ax5.hist(slippages, bins=30, color=self.colors['drawdown'],
                edgecolor='white', alpha=0.7)
        ax5.set_xlabel('Slippage (%)', fontsize=12)
        ax5.set_ylabel('Frequency', fontsize=12)
        ax5.set_title('Slippage Distribution', fontsize=12, fontweight='bold')
        ax5.axvline(x=sum(slippages)/len(slippages) if slippages else 0,
                   color='red', linestyle='--', label='Mean')
        ax5.legend()

        plt.tight_layout()

        save_path = save_path or os.path.join(self.output_dir, 'trade_analysis.png')
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()

        return save_path

    def plot_monthly_returns(
        self,
        equity_curve: List[EquityPoint],
        save_path: Optional[str] = None
    ) -> str:
        """
        Plot monthly returns heatmap.

        Args:
            equity_curve: List of equity points
            save_path: Custom save path

        Returns:
            Path to saved image
        """
        if not equity_curve:
            return ""

        import pandas as pd

        # Convert to DataFrame
        df = pd.DataFrame([
            {'timestamp': p.timestamp, 'equity': p.equity}
            for p in equity_curve
        ])
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df.set_index('timestamp', inplace=True)

        # Resample to monthly
        monthly = df['equity'].resample('M').last()
        monthly_returns = monthly.pct_change().dropna() * 100

        if len(monthly_returns) < 2:
            return ""

        # Create heatmap data
        years = monthly_returns.index.year.unique()
        months = range(1, 13)

        heatmap_data = []
        for year in sorted(years):
            row = []
            for month in months:
                mask = (monthly_returns.index.year == year) & (monthly_returns.index.month == month)
                if mask.any():
                    row.append(monthly_returns[mask].iloc[0])
                else:
                    row.append(None)
            heatmap_data.append(row)

        fig, ax = plt.subplots(figsize=(14, len(years) + 2))

        # Create heatmap
        import numpy as np
        data_array = np.array([[v if v is not None else np.nan for v in row] for row in heatmap_data])

        im = ax.imshow(data_array, cmap='RdYlGn', aspect='auto',
                      vmin=-10, vmax=10)

        # Labels
        month_labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        ax.set_xticks(range(12))
        ax.set_xticklabels(month_labels)
        ax.set_yticks(range(len(years)))
        ax.set_yticklabels(sorted(years))

        # Add text annotations
        for i, year in enumerate(sorted(years)):
            for j in range(12):
                val = heatmap_data[i][j]
                if val is not None:
                    text_color = 'white' if abs(val) > 5 else 'black'
                    ax.text(j, i, f'{val:.1f}%', ha='center', va='center',
                           color=text_color, fontsize=9)

        plt.colorbar(im, label='Monthly Return (%)')
        ax.set_title('Monthly Returns Heatmap', fontsize=14, fontweight='bold')

        plt.tight_layout()

        save_path = save_path or os.path.join(self.output_dir, 'monthly_returns.png')
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()

        return save_path

    def generate_full_report(
        self,
        result: Any,  # BacktestResult
        include_monthly: bool = True
    ) -> Dict[str, str]:
        """
        Generate all visualizations for a backtest result.

        Args:
            result: BacktestResult object
            include_monthly: Whether to generate monthly returns chart

        Returns:
            Dict of chart names to file paths
        """
        charts = {}

        # Equity curve
        equity_path = self.plot_equity_curve(
            result.equity_curve,
            result.metrics
        )
        if equity_path:
            charts['equity_curve'] = equity_path

        # Trade analysis
        trade_path = self.plot_trade_analysis(
            result.trades,
            result.equity_curve
        )
        if trade_path:
            charts['trade_analysis'] = trade_path

        # Monthly returns
        if include_monthly:
            monthly_path = self.plot_monthly_returns(result.equity_curve)
            if monthly_path:
                charts['monthly_returns'] = monthly_path

        return charts

    def _calculate_rolling_sharpe(
        self,
        equity_curve: List[EquityPoint],
        window: int = 30
    ) -> List[Tuple[datetime, float]]:
        """Calculate rolling Sharpe ratio."""
        import math

        rolling_sharpe = []

        # Group by date
        daily_equity = {}
        for p in equity_curve:
            date_key = p.timestamp.date()
            daily_equity[date_key] = p.equity

        dates = sorted(daily_equity.keys())

        for i in range(window, len(dates)):
            window_dates = dates[i-window:i]
            returns = []
            for j in range(1, len(window_dates)):
                prev = daily_equity[window_dates[j-1]]
                curr = daily_equity[window_dates[j]]
                if prev > 0:
                    returns.append((curr - prev) / prev)

            if len(returns) < 2:
                continue

            mean_ret = sum(returns) / len(returns)
            var = sum((r - mean_ret)**2 for r in returns) / (len(returns) - 1)
            std = math.sqrt(var) if var > 0 else 0

            if std > 0:
                daily_sharpe = mean_ret / std
                annual_sharpe = daily_sharpe * math.sqrt(252)
                timestamp = datetime.combine(dates[i], datetime.min.time())
                rolling_sharpe.append((timestamp, annual_sharpe))

        return rolling_sharpe


def create_summary_image(
    metrics: Any,
    output_path: str = "backtest/results/summary.png"
) -> str:
    """
    Create a summary image with key metrics.

    Args:
        metrics: BacktestMetrics object
        output_path: Where to save the image

    Returns:
        Path to saved image
    """
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.axis('off')

    # Create text content
    summary_text = f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║                    BACKTEST SUMMARY                          ║
    ╠══════════════════════════════════════════════════════════════╣
    ║  Period: {metrics.start_date.strftime('%Y-%m-%d')} to {metrics.end_date.strftime('%Y-%m-%d')} ({metrics.trading_days} days)
    ╠══════════════════════════════════════════════════════════════╣
    ║  RETURNS                                                     ║
    ║    Initial Capital:     ${metrics.initial_capital:>12,.2f}          ║
    ║    Final Equity:        ${metrics.final_equity:>12,.2f}          ║
    ║    Total Return:        {metrics.total_return_pct:>12.2f}%          ║
    ║    Annualized Return:   {metrics.annualized_return_pct:>12.2f}%          ║
    ╠══════════════════════════════════════════════════════════════╣
    ║  RISK METRICS                                                ║
    ║    Sharpe Ratio:        {metrics.sharpe_ratio:>12.3f}           ║
    ║    Sortino Ratio:       {metrics.sortino_ratio:>12.3f}           ║
    ║    Max Drawdown:        {metrics.max_drawdown_pct:>12.2f}%          ║
    ╠══════════════════════════════════════════════════════════════╣
    ║  TRADE STATISTICS                                            ║
    ║    Total Trades:        {metrics.total_trades:>12}           ║
    ║    Win Rate:            {metrics.win_rate_pct:>12.2f}%          ║
    ║    Profit Factor:       {metrics.profit_factor:>12.3f}           ║
    ╚══════════════════════════════════════════════════════════════╝
    """

    ax.text(0.5, 0.5, summary_text, transform=ax.transAxes,
            fontsize=11, fontfamily='monospace',
            verticalalignment='center', horizontalalignment='center',
            bbox=dict(boxstyle='round', facecolor='white', edgecolor='gray'))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    plt.savefig(output_path, dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()

    return output_path
