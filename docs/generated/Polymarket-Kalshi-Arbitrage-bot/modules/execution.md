# execution.rs - Order Execution Module

> Concurrent order execution, deduplication, and exposure management

**Location**: `src/execution.rs`  
**Lines**: 656  
**Dependencies**: `tokio`, `reqwest`, circuit_breaker, position_tracker

## Overview

The `execution.rs` module handles all order placement logic, including concurrent execution across both platforms, in-flight deduplication, and automatic exposure management.

## Key Components

### ExecutionEngine

Main execution handler:

```rust
pub struct ExecutionEngine {
    kalshi_client: KalshiClient,
    polymarket_client: PolymarketClobClient,
    circuit_breaker: Arc<CircuitBreaker>,
    position_tracker: Arc<PositionTracker>,
    in_flight: [AtomicU64; 8],  // 512 market bitmask
}
```

**Key Methods**:
- `new()` - Create with clients and risk controls
- `execute()` - Execute arbitrage opportunity
- `is_in_flight(market_id)` - Check if order pending
- `mark_in_flight(market_id)` - Set in-flight flag
- `clear_in_flight(market_id)` - Clear after completion

### Concurrent Execution

Orders are placed simultaneously on both platforms:

```rust
let (kalshi_result, poly_result) = tokio::join!(
    self.kalshi_client.place_order(&kalshi_order),
    self.polymarket_client.place_order(&poly_order),
);
```

### In-Flight Deduplication

Prevents duplicate orders using atomic bitmask:

```rust
// 8 × u64 = 512 bits = 512 markets
in_flight: [AtomicU64; 8]

pub fn is_in_flight(&self, market_id: usize) -> bool {
    let word = market_id / 64;
    let bit = market_id % 64;
    (self.in_flight[word].load(Ordering::Acquire) & (1 << bit)) != 0
}
```

### Automatic Exposure Management

Background task manages partial fills:

```rust
pub async fn auto_close_background(
    engine: Arc<ExecutionEngine>,
    interval: Duration,
) {
    loop {
        tokio::time::sleep(interval).await;
        engine.check_and_close_exposures().await;
    }
}
```

## ExecutionResult

Order execution outcome:

```rust
pub struct ExecutionResult {
    pub success: bool,
    pub kalshi_fill: Option<FillRecord>,
    pub polymarket_fill: Option<FillRecord>,
    pub error: Option<String>,
    pub latency_ns: u64,
}
```

## NanoClock

High-precision timing for latency measurement:

```rust
pub struct NanoClock {
    start: Instant,
}

impl NanoClock {
    pub fn now() -> Self;
    pub fn elapsed_ns(&self) -> u64;
}
```

## Error Handling

- Failed orders trigger circuit breaker error count
- Partial fills are tracked for exposure management
- Network errors are retried with exponential backoff

## See Also

- [Circuit Breaker Module](circuit_breaker.md)
- [Position Tracker Module](position_tracker.md)
- [Concurrent Execution Concept](../concepts/concurrent-execution.md)
