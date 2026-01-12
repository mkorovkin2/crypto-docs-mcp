# Circuit Breaker Pattern

> Automatic risk management and trading halts

## Overview

The circuit breaker pattern protects against cascading failures by automatically halting trading when predefined risk limits are exceeded. This is essential for preventing runaway losses in automated trading systems.

## Why Circuit Breakers?

Automated trading can fail in dangerous ways:
- **API errors** causing repeated failed orders
- **Price feed issues** showing stale or incorrect prices
- **Position buildup** exceeding risk tolerance
- **Runaway losses** from bad market conditions

A circuit breaker detects these conditions and halts trading before damage escalates.

## Monitored Conditions

### Position Limits

```rust
// Per-market limit
if market_position + quantity > config.max_position_per_market {
    trip(TripReason::PositionLimitPerMarket(market_id));
}

// Total position limit
if total_position + quantity > config.max_total_position {
    trip(TripReason::TotalPositionLimit);
}
```

### Loss Limits

```rust
// Daily loss limit
if daily_pnl < -config.max_daily_loss_cents {
    trip(TripReason::DailyLossLimit);
}
```

### Error Tracking

```rust
// Consecutive error limit
if consecutive_errors >= config.max_consecutive_errors {
    trip(TripReason::ConsecutiveErrors);
}
```

## State Machine

```
     ┌─────────────────────────────────────┐
     │                                     │
     ▼                                     │
 ┌──────┐    limit exceeded    ┌────────┐ │
 │ Open ├─────────────────────►│Tripped │ │
 └──┬───┘                      └────┬───┘ │
    │                               │     │
    │     successful trades         │     │
    │     reset error count         │     │
    │                               │     │
    │                          cooldown   │
    │                          expires    │
    │                               │     │
    │                               ▼     │
    │                          ┌────────┐ │
    └──────────────────────────│ Reset  ├─┘
                               └────────┘
```

## Trip Reasons

| Reason | Trigger | Severity |
|--------|---------|----------|
| `PositionLimitPerMarket` | Single market position too large | Medium |
| `TotalPositionLimit` | Total exposure too large | High |
| `DailyLossLimit` | Daily losses exceed threshold | Critical |
| `ConsecutiveErrors` | Multiple API failures | Medium |
| `ManualTrip` | Operator intervention | Varies |
| `UnknownError` | Unexpected error | Critical |

## Configuration

```rust
pub struct CircuitBreakerConfig {
    pub max_position_per_market: u32,  // Default: 100 contracts
    pub max_total_position: u32,        // Default: 1000 contracts
    pub max_daily_loss_cents: i64,      // Default: 10000 ($100)
    pub max_consecutive_errors: u32,    // Default: 5
    pub cooldown_seconds: u64,          // Default: 300 (5 minutes)
    pub enabled: bool,                  // Default: true
}
```

## Pre-Trade Check Flow

```rust
pub fn can_trade(&self, market_id: usize, quantity: u32) -> Result<(), TripReason> {
    // 1. Check if breaker is enabled
    if !self.config.enabled {
        return Ok(());
    }
    
    // 2. Check if already tripped
    if self.tripped.load(Ordering::Acquire) {
        return Err(self.get_trip_reason());
    }
    
    // 3. Check position limits
    self.check_position_limits(market_id, quantity)?;
    
    // 4. Check loss limits
    self.check_loss_limits()?;
    
    Ok(())
}
```

## Recovery Behavior

### Automatic Cooldown Reset

```rust
pub fn check_cooldown(&self) -> bool {
    if let Some(trip_time) = self.get_trip_time() {
        let elapsed = Utc::now() - trip_time;
        if elapsed > Duration::seconds(self.config.cooldown_seconds as i64) {
            self.reset();
            return true;  // Breaker is now open
        }
    }
    false  // Still in cooldown
}
```

### Manual Reset

```rust
pub fn manual_reset(&self) {
    self.tripped.store(false, Ordering::Release);
    self.consecutive_errors.store(0, Ordering::Release);
    // Note: daily_pnl is NOT reset - only resets at midnight
}
```

## Error Recovery

Successful trades reset the consecutive error count:

```rust
pub fn record_success(&self) {
    self.consecutive_errors.store(0, Ordering::Release);
}
```

## Best Practices

1. **Start Conservative** - Use tight limits initially, loosen as confidence grows
2. **Monitor Trips** - Log all trip events for post-mortem analysis
3. **Don't Disable** - Even in testing, keep the breaker enabled
4. **Daily Reset** - Ensure daily loss counter resets at midnight
5. **Alert on Trip** - Set up notifications when circuit breaker trips

## See Also

- [circuit_breaker.rs Module](../modules/circuit_breaker.md)
- [Configuration Guide](../guides/configuration.md)
- [Position Tracking Concept](position-tracking.md)
