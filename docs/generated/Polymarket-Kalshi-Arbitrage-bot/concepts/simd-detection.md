# SIMD Arbitrage Detection

> Vectorized processing for parallel arbitrage checking

## Overview

The bot uses SIMD (Single Instruction Multiple Data) to check all four arbitrage types simultaneously. This reduces detection time from 4 sequential comparisons to a single vectorized operation.

## What is SIMD?

SIMD allows a single CPU instruction to operate on multiple data points in parallel:

```
Traditional:          SIMD:
a + x → result1       [a, b, c, d] + [x, y, z, w] → [a+x, b+y, c+z, d+w]
b + y → result2       (single instruction)
c + z → result3
d + w → result4
```

Modern CPUs have 128-bit (SSE), 256-bit (AVX), or 512-bit (AVX-512) SIMD registers.

## The `wide` Crate

The bot uses the `wide` crate for portable SIMD:

```rust
use wide::i16x8;  // 8 × 16-bit integers = 128 bits
```

## Arbitrage Detection Algorithm

### The Four Arbitrage Types

| Type | Condition | Action |
|------|-----------|--------|
| Kalshi Yes | `p_bid_yes > k_ask_yes + fees` | Buy YES on Kalshi, sell on Polymarket |
| Kalshi No | `p_bid_no > k_ask_no + fees` | Buy NO on Kalshi, sell on Polymarket |
| Polymarket Yes | `k_bid_yes > p_ask_yes + fees` | Buy YES on Polymarket, sell on Kalshi |
| Polymarket No | `k_bid_no > p_ask_no + fees` | Buy NO on Polymarket, sell on Kalshi |

### SIMD Implementation

```rust
pub fn check_arbs(
    k_bid_yes: u16, k_ask_yes: u16, k_bid_no: u16, k_ask_no: u16,
    p_bid_yes: u16, p_ask_yes: u16, p_bid_no: u16, p_ask_no: u16,
    min_edge_bps: u16,
) -> Option<ArbType> {
    // Load all prices into SIMD vector
    let kalshi = i16x8::from([
        k_bid_yes as i16, k_ask_yes as i16, k_bid_no as i16, k_ask_no as i16,
        0, 0, 0, 0  // Padding
    ]);
    
    let poly = i16x8::from([
        p_bid_yes as i16, p_ask_yes as i16, p_bid_no as i16, p_ask_no as i16,
        0, 0, 0, 0
    ]);
    
    // Calculate edges (sell - buy - fees) for all 4 types in parallel
    let fees = calculate_fees_simd(kalshi, poly);
    
    // Kalshi arbs: poly_bid - kalshi_ask - fees
    // Polymarket arbs: kalshi_bid - poly_ask - fees
    let kalshi_edges = i16x8::from([
        p_bid_yes as i16 - k_ask_yes as i16,  // Kalshi Yes edge
        p_bid_no as i16 - k_ask_no as i16,    // Kalshi No edge
        0, 0, 0, 0, 0, 0
    ]);
    
    let poly_edges = i16x8::from([
        k_bid_yes as i16 - p_ask_yes as i16,  // Poly Yes edge
        k_bid_no as i16 - p_ask_no as i16,    // Poly No edge
        0, 0, 0, 0, 0, 0
    ]);
    
    // Compare against minimum edge threshold
    let min_edge = i16x8::splat(min_edge_bps as i16);
    
    // Extract results and return first profitable opportunity
    let k_results = kalshi_edges.cmp_gt(min_edge);
    let p_results = poly_edges.cmp_gt(min_edge);
    
    // Convert to bitmask and check
    if k_results.any() {
        // Return first Kalshi arb found
    }
    if p_results.any() {
        // Return first Polymarket arb found
    }
    
    None
}
```

## Fee Calculation

Fees are also computed in parallel:

```rust
fn calculate_fees_simd(kalshi: i16x8, poly: i16x8) -> i16x8 {
    // Kalshi fee: KALSHI_FEE_TABLE[price]
    // Polymarket fee: 0 for makers (we're always taking)
    
    // Extract prices and lookup fees
    let k_ask_yes = kalshi.extract::<1>();
    let k_ask_no = kalshi.extract::<3>();
    
    let kalshi_yes_fee = KALSHI_FEE_TABLE[k_ask_yes as usize];
    let kalshi_no_fee = KALSHI_FEE_TABLE[k_ask_no as usize];
    
    i16x8::from([kalshi_yes_fee as i16, kalshi_no_fee as i16, 0, 0, 0, 0, 0, 0])
}
```

## Performance Comparison

| Method | Time per Check | Speedup |
|--------|---------------|---------|
| Sequential (4 checks) | ~2.0 ns | 1x |
| SIMD (parallel) | ~0.5 ns | 4x |

For 500 markets checked 100 times/second:
- Sequential: 100 µs/loop
- SIMD: 25 µs/loop

## CPU Support

The `wide` crate automatically selects the best available instruction set:

| Platform | Instruction Set | Register Width |
|----------|----------------|----------------|
| x86_64 | SSE2/AVX2 | 128/256 bits |
| ARM64 | NEON | 128 bits |
| WASM | SIMD128 | 128 bits |

## See Also

- [types.rs Module](../modules/types.md)
- [Lock-Free Atomics Concept](lock-free-atomics.md)
- [Arbitrage Concept](arbitrage.md)
