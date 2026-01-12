# position_tracker.rs - Position Tracking Module

> Cost basis tracking, P&L calculation, and fill management

**Location**: `src/position_tracker.rs`  
**Lines**: 450  
**Dependencies**: `parking_lot`, `chrono`, `tokio`

## Overview

The `position_tracker.rs` module tracks all positions, calculates realized and unrealized P&L, maintains cost basis, and records fill history for audit purposes.

## Key Components

### PositionTracker

Main tracking structure:

```rust
pub struct PositionTracker {
    positions: RwLock<FxHashMap<usize, ArbPosition>>,
    fill_history: RwLock<Vec<FillRecord>>,
    write_buffer: Mutex<Vec<FillRecord>>,
    summary: RwLock<PositionSummary>,
}
```

**Key Methods**:
- `new()` - Create empty tracker
- `record_fill(fill)` - Record new fill
- `get_position(market_id)` - Get current position
- `get_summary()` - Get P&L summary
- `close_position(market_id)` - Mark position closed

### ArbPosition

Single arbitrage position:

```rust
pub struct ArbPosition {
    pub market_pair_id: usize,
    pub arb_type: ArbType,
    pub kalshi_leg: PositionLeg,
    pub polymarket_leg: PositionLeg,
    pub opened_at: DateTime<Utc>,
    pub status: PositionStatus,
}
```

**Key Methods**:
- `guaranteed_profit_cents()` - Calculate locked-in profit
- `max_profit_cents()` - Calculate best-case outcome
- `max_loss_cents()` - Calculate worst-case outcome
- `is_fully_hedged()` - Check if position is balanced

### PositionLeg

Single side of a position:

```rust
pub struct PositionLeg {
    pub side: Side,          // Yes or No
    pub quantity: u32,
    pub avg_price_cents: u16,
    pub total_cost_cents: i64,
    pub fills: Vec<FillRecord>,
}
```

### FillRecord

Individual trade fill:

```rust
pub struct FillRecord {
    pub market_pair_id: usize,
    pub arb_type: ArbType,
    pub kalshi_side: Side,
    pub kalshi_price_cents: u16,
    pub kalshi_quantity: u32,
    pub kalshi_fees_cents: u16,
    pub polymarket_side: Side,
    pub polymarket_price_cents: u16,
    pub polymarket_quantity: u32,
    pub polymarket_fees_cents: u16,
    pub timestamp: DateTime<Utc>,
}
```

### PositionSummary

Aggregate P&L view:

```rust
pub struct PositionSummary {
    pub total_positions: u32,
    pub open_positions: u32,
    pub closed_positions: u32,
    pub guaranteed_profit_cents: i64,
    pub realized_pnl_cents: i64,
    pub unrealized_pnl_cents: i64,
}
```

## Guaranteed Profit Calculation

For a fully hedged arbitrage position:

```rust
impl ArbPosition {
    pub fn guaranteed_profit_cents(&self) -> i64 {
        // Buy YES at X, sell YES at Y (where Y > X after fees)
        // Profit = (sell_price - buy_price - fees) × quantity
        
        let kalshi_cost = self.kalshi_leg.total_cost_cents;
        let poly_cost = self.polymarket_leg.total_cost_cents;
        
        // One side pays $1, other side pays $0
        // Guaranteed profit = 100 cents × min_quantity - total_cost
        let min_qty = self.kalshi_leg.quantity.min(self.polymarket_leg.quantity);
        (100 * min_qty as i64) - kalshi_cost - poly_cost
    }
}
```

## Batched Async Writes

Fill records are batched for efficient I/O:

```rust
impl PositionTracker {
    pub async fn flush_writes(&self) {
        let fills = {
            let mut buffer = self.write_buffer.lock();
            std::mem::take(&mut *buffer)
        };
        
        if !fills.is_empty() {
            self.append_to_log(&fills).await;
        }
    }
}

// Background task flushes every 100ms
pub async fn position_writer_background(tracker: Arc<PositionTracker>) {
    let mut interval = tokio::time::interval(Duration::from_millis(100));
    loop {
        interval.tick().await;
        tracker.flush_writes().await;
    }
}
```

## Position Status

```rust
pub enum PositionStatus {
    Open,           // Active position
    Closing,        // Close order pending
    Closed,         // Fully closed
    Expired,        // Market expired
}
```

## See Also

- [Circuit Breaker Module](circuit_breaker.md)
- [Execution Module](execution.md)
- [Position Tracking Concept](../concepts/position-tracking.md)
