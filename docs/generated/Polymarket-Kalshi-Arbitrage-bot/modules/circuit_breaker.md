# circuit_breaker.rs - Risk Management Module

> Automatic trading halts, position limits, and error tracking

**Location**: `src/circuit_breaker.rs`  
**Lines**: 320  
**Dependencies**: `parking_lot`, `chrono`

## Overview

The `circuit_breaker.rs` module implements risk management controls that automatically halt trading when predefined limits are exceeded. This protects against runaway losses, excessive positions, and system errors.

## Key Components

### CircuitBreaker

Main risk controller:

```rust
pub struct CircuitBreaker {
    config: CircuitBreakerConfig,
    status: RwLock<CircuitBreakerStatus>,
    market_positions: RwLock<FxHashMap<usize, MarketPosition>>,
    total_position: AtomicI64,
    daily_pnl: AtomicI64,
    consecutive_errors: AtomicU32,
    tripped: AtomicBool,
    trip_reason: RwLock<Option<TripReason>>,
}
```

**Key Methods**:
- `new(config)` - Create with configuration
- `can_trade(market_id, quantity)` - Check if trade allowed
- `record_fill(market_id, quantity, pnl)` - Update after fill
- `record_error()` - Increment error count
- `trip(reason)` - Manually trip breaker
- `reset()` - Reset after cooldown

### CircuitBreakerConfig

Configuration options:

```rust
pub struct CircuitBreakerConfig {
    pub max_position_per_market: u32,  // Default: 100
    pub max_total_position: u32,        // Default: 1000
    pub max_daily_loss_cents: i64,      // Default: 10000 ($100)
    pub max_consecutive_errors: u32,    // Default: 5
    pub cooldown_seconds: u64,          // Default: 300
    pub enabled: bool,                  // Default: true
}
```

### TripReason Enum

Why the circuit breaker tripped:

```rust
pub enum TripReason {
    PositionLimitPerMarket(usize),  // Market ID
    TotalPositionLimit,
    DailyLossLimit,
    ConsecutiveErrors,
    ManualTrip,
    UnknownError(String),
}
```

### MarketPosition

Per-market position tracking:

```rust
pub struct MarketPosition {
    pub market_id: usize,
    pub net_position: i32,      // Positive = long, negative = short
    pub cost_basis_cents: i64,
}
```

## Risk Checks

### Pre-Trade Validation

```rust
pub fn can_trade(&self, market_id: usize, quantity: u32) -> Result<(), TripReason> {
    if !self.config.enabled { return Ok(()); }
    if self.tripped.load(Ordering::Acquire) { 
        return Err(self.trip_reason()); 
    }
    
    // Check per-market limit
    let market_pos = self.get_market_position(market_id);
    if market_pos + quantity > self.config.max_position_per_market {
        return Err(TripReason::PositionLimitPerMarket(market_id));
    }
    
    // Check total position limit
    // Check daily loss limit
    // ...
}
```

### Post-Trade Updates

```rust
pub fn record_fill(&self, market_id: usize, quantity: i32, pnl_cents: i64) {
    // Update market position
    // Update total position
    // Update daily P&L
    // Reset consecutive errors on success
}
```

## Auto-Reset Behavior

The circuit breaker automatically resets after `cooldown_seconds`:

```rust
pub fn check_cooldown(&self) -> bool {
    if let Some(trip_time) = self.status.read().trip_time {
        if Utc::now() - trip_time > Duration::seconds(self.config.cooldown_seconds) {
            self.reset();
            return true;
        }
    }
    false
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_POSITION_PER_MARKET` | 100 | Max contracts per market |
| `MAX_TOTAL_POSITION` | 1000 | Max total contracts |
| `MAX_DAILY_LOSS_CENTS` | 10000 | Daily loss limit |
| `MAX_CONSECUTIVE_ERRORS` | 5 | Error threshold |
| `CIRCUIT_BREAKER_COOLDOWN_SECONDS` | 300 | Reset wait time |
| `CIRCUIT_BREAKER_ENABLED` | true | Enable/disable |

## See Also

- [Circuit Breaker Concept](../concepts/circuit-breaker.md)
- [Position Tracker Module](position_tracker.md)
- [Configuration Guide](../guides/configuration.md)
