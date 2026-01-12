# types.rs - Core Types Module

> Core type definitions, atomic orderbooks, and SIMD arbitrage detection

**Location**: `src/types.rs`  
**Lines**: 1,265  
**Dependencies**: `wide`, `fxhash`, `parking_lot`

## Overview

The `types.rs` module is the heart of the codebase, containing all core type definitions, the lock-free atomic orderbook implementation, SIMD-accelerated arbitrage detection, and pre-computed fee tables.

## Key Components

### AtomicOrderbook

Lock-free orderbook using bit-packed `AtomicU64`:

```rust
#[repr(align(64))]  // Cache-line aligned
pub struct AtomicOrderbook {
    /// Packed: [bid_yes:16][ask_yes:16][bid_no:16][ask_no:16]
    data: AtomicU64,
}
```

**Methods**:
- `new()` - Create empty orderbook
- `update(bid_yes, ask_yes, bid_no, ask_no)` - Atomic update
- `get()` - Returns `(bid_yes, ask_yes, bid_no, ask_no)`
- `compare_and_swap()` - CAS for partial updates

### GlobalState

Central application state container:

```rust
pub struct GlobalState {
    pub market_pairs: Vec<MarketPair>,
    pub kalshi_books: Vec<AtomicOrderbook>,
    pub polymarket_books: Vec<AtomicOrderbook>,
    pub market_lookup: FxHashMap<String, usize>,
    // ... additional fields
}
```

### MarketPair

Matched market across platforms:

```rust
pub struct MarketPair {
    pub id: usize,
    pub kalshi_ticker: String,
    pub polymarket_token_id: String,
    pub market_type: MarketType,
    pub event_name: String,
    // ... additional fields
}
```

### ArbType Enum

```rust
pub enum ArbType {
    KalshiYes,      // Buy YES on Kalshi
    KalshiNo,       // Buy NO on Kalshi
    PolymarketYes,  // Buy YES on Polymarket
    PolymarketNo,   // Buy NO on Polymarket
}
```

## SIMD Arbitrage Detection

The `check_arbs()` function uses SIMD to check all four arbitrage types in parallel:

```rust
pub fn check_arbs(
    k_bid_yes: u16, k_ask_yes: u16, k_bid_no: u16, k_ask_no: u16,
    p_bid_yes: u16, p_ask_yes: u16, p_bid_no: u16, p_ask_no: u16,
    min_edge_bps: u16,
) -> Option<ArbType>
```

**Performance**: < 0.5ms for 4 simultaneous comparisons using `wide::i16x8` vectors.

## Pre-computed Fee Table

O(1) Kalshi fee lookup:

```rust
static KALSHI_FEE_TABLE: [u8; 101] = [
    0, 0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, // ... continues
];

pub fn kalshi_fee_cents(price_cents: u8) -> u8 {
    KALSHI_FEE_TABLE[price_cents as usize]
}
```

**Formula**: `ceil(7 × p × (100-p) / 10000)` where p is price in cents.

## Utility Functions

### Price Conversion

```rust
pub fn price_to_cents(price: f64) -> u16;    // 0.45 → 45
pub fn cents_to_price(cents: u16) -> f64;    // 45 → 0.45
pub fn parse_price(s: &str) -> Option<u16>;  // "0.45" → Some(45)
```

### Orderbook Packing

```rust
pub fn pack_orderbook(bid_yes: u16, ask_yes: u16, bid_no: u16, ask_no: u16) -> u64;
pub fn unpack_orderbook(packed: u64) -> (u16, u16, u16, u16);
```

## See Also

- [Atomic Orderbook Concept](../concepts/atomic-orderbook.md)
- [SIMD Detection Concept](../concepts/simd-detection.md)
- [API Reference](../api/index.md)
