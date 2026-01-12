# Code Examples

> Practical usage patterns and code examples

## Overview

This section provides practical examples extracted from the test suite and generated for common use cases.

## Example Categories

### Quick Start Examples

| Example | Description |
|---------|-------------|
| [Basic Setup](basic-setup.md) | Minimal configuration to run |
| [Test Mode](test-mode.md) | Paper trading without real orders |
| [First Trade](first-trade.md) | Understanding your first arbitrage |

### Configuration Examples

| Example | Description |
|---------|-------------|
| [Conservative Config](conservative-config.md) | Low-risk settings |
| [Aggressive Config](aggressive-config.md) | Higher-risk, higher-reward |
| [Production Config](production-config.md) | Production-ready settings |

### API Usage Examples

| Example | Description |
|---------|-------------|
| [Reading Orderbooks](reading-orderbooks.md) | Accessing price data |
| [Checking Arbitrage](checking-arbitrage.md) | Using `check_arbs()` |
| [Position Tracking](position-tracking.md) | Monitoring positions |
| [Circuit Breaker](circuit-breaker-usage.md) | Risk management |

### Integration Examples

| Example | Description |
|---------|-------------|
| [Kalshi Client](kalshi-client.md) | Kalshi API integration |
| [Polymarket Client](polymarket-client.md) | Polymarket integration |
| [Discovery Client](discovery-client.md) | Market matching |

## Quick Examples

### Minimum Viable Configuration

```bash
# .env file
KALSHI_EMAIL=your@email.com
KALSHI_PASSWORD=your_password
POLYMARKET_API_KEY=your_api_key
POLYMARKET_API_SECRET=your_secret
POLYMARKET_PASSPHRASE=your_passphrase
TEST_MODE=true
```

### Running in Test Mode

```bash
export TEST_MODE=true
cargo run --release
```

### Conservative Settings

```bash
export MIN_EDGE_BPS=100           # Require 1% edge minimum
export MAX_POSITION_PER_MARKET=50 # Max 50 contracts per market
export MAX_TOTAL_POSITION=200     # Max 200 total contracts
export MAX_DAILY_LOSS_CENTS=5000  # Stop at $50 loss
```

### Checking for Arbitrage (from tests)

```rust
use polymarket_kalshi_arb::{check_arbs, ArbType};

let arbs = check_arbs(
    kalshi_bid_yes, kalshi_ask_yes, kalshi_bid_no, kalshi_ask_no,
    poly_bid_yes, poly_ask_yes, poly_bid_no, poly_ask_no,
    min_edge_bps
);

match arbs {
    Some(ArbType::KalshiYes) => println!("Buy YES on Kalshi"),
    Some(ArbType::KalshiNo) => println!("Buy NO on Kalshi"),
    Some(ArbType::PolymarketYes) => println!("Buy YES on Polymarket"),
    Some(ArbType::PolymarketNo) => println!("Buy NO on Polymarket"),
    None => println!("No arbitrage opportunity"),
}
```

### Position Tracking (from tests)

```rust
let tracker = PositionTracker::new();

// Record a fill
tracker.record_fill(FillRecord {
    market_pair_id: 1,
    arb_type: ArbType::KalshiYes,
    kalshi_side: Side::Yes,
    kalshi_price_cents: 45,
    kalshi_quantity: 10,
    polymarket_side: Side::Yes,
    polymarket_price_cents: 48,
    polymarket_quantity: 10,
    timestamp: Utc::now(),
});

// Get summary
let summary = tracker.get_summary();
println!("Guaranteed profit: {} cents", summary.guaranteed_profit_cents);
```

### Circuit Breaker Configuration

```rust
let config = CircuitBreakerConfig {
    max_position_per_market: 100,
    max_total_position: 1000,
    max_daily_loss_cents: 10000,
    max_consecutive_errors: 5,
    cooldown_seconds: 300,
    enabled: true,
    ..Default::default()
};

let circuit_breaker = CircuitBreaker::new(config);
```

## Examples from Test Suite

The integration test file (`tests/integration_tests.rs`, 2046 lines) contains comprehensive examples:

- Position tracking with multiple fills
- Circuit breaker trip scenarios
- Arbitrage detection edge cases
- Fee calculation verification
- Concurrent execution patterns

## See Also

- [API Reference](../api/index.md) - Full API documentation
- [Guides](../guides/index.md) - Step-by-step tutorials
- [Concepts](../concepts/index.md) - Technical concepts explained
