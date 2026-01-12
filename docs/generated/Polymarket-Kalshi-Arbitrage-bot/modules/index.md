# Module Documentation

> Documentation for all 12 source modules

## Overview

The codebase consists of 12 Rust source files organized by responsibility. This section provides detailed documentation for each module.

## Module Hierarchy

```
lib.rs (entry point - re-exports)
├── types.rs (core types, atomics, SIMD)
├── config.rs (configuration loading)
├── execution.rs (order execution)
│   └── circuit_breaker.rs (risk management)
│   └── position_tracker.rs (P&L tracking)
├── cache.rs (caching utilities)
├── discovery.rs (market matching)
├── kalshi.rs (Kalshi API client)
├── polymarket.rs (Polymarket WebSocket)
└── polymarket_clob.rs (Polymarket CLOB client)

main.rs (application entry point)
```

## Module Index

| Module | Lines | Description |
|--------|-------|-------------|
| [main.rs](main.md) | 365 | Entry point, orchestration, WebSocket spawning |
| [lib.rs](lib.md) | 50 | Library entry point, re-exports |
| [types.rs](types.md) | 1265 | Core types, `AtomicOrderbook`, SIMD detection |
| [config.rs](config.md) | 180 | Configuration loading, environment variables |
| [execution.rs](execution.md) | 656 | `ExecutionEngine`, concurrent order placement |
| [circuit_breaker.rs](circuit_breaker.md) | 320 | `CircuitBreaker`, risk limits, trip handling |
| [position_tracker.rs](position_tracker.md) | 450 | `PositionTracker`, cost basis, P&L |
| [cache.rs](cache.md) | 120 | Caching utilities, TTL management |
| [discovery.rs](discovery.md) | 674 | `DiscoveryClient`, market matching |
| [kalshi.rs](kalshi.md) | 580 | Kalshi REST/WebSocket client |
| [polymarket.rs](polymarket.md) | 420 | Polymarket WebSocket handler |
| [polymarket_clob.rs](polymarket_clob.md) | 380 | Polymarket CLOB order client |

**Total**: ~5,460 lines of Rust code

## Performance-Critical Modules

These modules are on the hot path and use specialized optimizations:

### types.rs - Core Types
- `AtomicOrderbook` with bit-packed `u64` representation
- `check_arbs()` with SIMD `i16x8` vectorization
- Pre-computed `KALSHI_FEE_TABLE` (101 entries)

### execution.rs - Order Execution
- In-flight deduplication using 8×`u64` bitmask (512 markets)
- Concurrent execution with `tokio::join!`
- Automatic exposure management via `auto_close_background`

### circuit_breaker.rs - Risk Management
- Per-market and total position limits
- Daily loss limits with atomic tracking
- Consecutive error counting

## Module Dependencies

```
types.rs ← (all modules)
config.rs ← main.rs, execution.rs
execution.rs ← main.rs
circuit_breaker.rs ← execution.rs, main.rs
position_tracker.rs ← execution.rs, main.rs
discovery.rs ← main.rs
kalshi.rs ← execution.rs, main.rs
polymarket.rs ← main.rs
polymarket_clob.rs ← execution.rs
cache.rs ← discovery.rs
```

## See Also

- [Architecture Overview](../architecture/index.md) - System design
- [API Reference](../api/index.md) - Public exports
- [Data Flow](../architecture/data-flow.md) - How data moves through modules
