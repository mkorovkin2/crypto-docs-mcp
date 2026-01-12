# Concepts Documentation

> Domain and technical concepts explained

## Overview

This section explains the key concepts used throughout the Polymarket-Kalshi Arbitrage Bot, from trading fundamentals to advanced implementation techniques.

## Concept Categories

### Trading Concepts

| Concept | Description |
|---------|-------------|
| [Arbitrage](arbitrage.md) | Exploiting price differences between markets |
| [Prediction Markets](prediction-markets.md) | How Polymarket and Kalshi work |
| [Orderbook Mechanics](orderbook-mechanics.md) | Bids, asks, and spreads |
| [Fee Structures](fee-structures.md) | Platform fees and calculations |

### Arbitrage Types

The bot detects four types of arbitrage opportunities:

| Type | Description | Example |
|------|-------------|---------|
| **Kalshi Yes** | Buy YES on Kalshi, sell YES on Polymarket | Kalshi YES cheaper |
| **Kalshi No** | Buy NO on Kalshi, sell NO on Polymarket | Kalshi NO cheaper |
| **Polymarket Yes** | Buy YES on Polymarket, sell YES on Kalshi | Polymarket YES cheaper |
| **Polymarket No** | Buy NO on Polymarket, sell NO on Kalshi | Polymarket NO cheaper |

### Technical Concepts

| Concept | Description |
|---------|-------------|
| [Lock-Free Atomics](lock-free-atomics.md) | Concurrent updates without mutexes |
| [SIMD Detection](simd-detection.md) | Vectorized arbitrage checking |
| [Circuit Breaker Pattern](circuit-breaker.md) | Automatic risk management |
| [Position Tracking](position-tracking.md) | Cost basis and P&L calculation |

### Implementation Concepts

| Concept | Description |
|---------|-------------|
| [Atomic Orderbook](atomic-orderbook.md) | Bit-packed price representation |
| [Fee Pre-computation](fee-precomputation.md) | Static lookup table optimization |
| [Compare-and-Swap](compare-and-swap.md) | Optimistic concurrency pattern |
| [In-flight Deduplication](deduplication.md) | Preventing duplicate orders |

## Key Technical Details

### Lock-Free Atomic Orderbook

The `AtomicOrderbook` stores bid/ask prices in a single `AtomicU64`:

```rust
// Bit layout: [bid_yes:16][ask_yes:16][bid_no:16][ask_no:16]
pub fn pack_orderbook(bid_yes: u16, ask_yes: u16, bid_no: u16, ask_no: u16) -> u64 {
    ((bid_yes as u64) << 48) | ((ask_yes as u64) << 32) |
    ((bid_no as u64) << 16) | (ask_no as u64)
}
```

### SIMD Arbitrage Detection

The `check_arbs()` function uses SIMD to check all four arbitrage types simultaneously:

```rust
// Processes 4 checks in parallel using i16x8 vectors
let prices = i16x8::from([k_bid_yes, k_ask_yes, k_bid_no, k_ask_no,
                          p_bid_yes, p_ask_yes, p_bid_no, p_ask_no]);
```

### Pre-computed Fee Table

Kalshi fees are looked up in O(1) time:

```rust
static KALSHI_FEE_TABLE: [u8; 101] = [
    0, 0, 1, 2, 2, 3, 3, 4, 4, 5, ...  // ceil(7 × p × (100-p) / 10000)
];
```

### Circuit Breaker Limits

| Limit | Default | Description |
|-------|---------|-------------|
| Max Position/Market | 100 | Maximum contracts per market |
| Max Total Position | 1000 | Maximum total contracts |
| Max Daily Loss | $100 | Daily loss limit |
| Max Consecutive Errors | 5 | Error threshold before trip |

## Concept Map

```
Arbitrage Trading
├── Price Discovery
│   ├── Kalshi WebSocket
│   └── Polymarket WebSocket
├── Opportunity Detection
│   ├── SIMD check_arbs()
│   └── Fee Calculation
├── Execution
│   ├── Concurrent Orders
│   └── In-flight Dedup
└── Risk Management
    ├── Circuit Breaker
    └── Position Tracking
```

## See Also

- [Architecture Overview](../architecture/index.md) - System design
- [API Reference](../api/index.md) - Implementation details
- [Examples](../examples/index.md) - Practical usage patterns
