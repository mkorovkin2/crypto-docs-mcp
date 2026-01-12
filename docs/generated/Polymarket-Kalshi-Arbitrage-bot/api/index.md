# API Reference

> Public types, functions, and exports

## Overview

This section documents all public APIs exported by the Polymarket-Kalshi Arbitrage Bot library. The API is organized by module.

## Quick Reference

### Most-Used Types

| Type | Module | Description |
|------|--------|-------------|
| `GlobalState` | types.rs | Central state container with market pairs and orderbooks |
| `MarketPair` | types.rs | Matched Kalshi/Polymarket market with metadata |
| `AtomicOrderbook` | types.rs | Lock-free orderbook with atomic updates |
| `ExecutionEngine` | execution.rs | Handles order placement and tracking |
| `CircuitBreaker` | circuit_breaker.rs | Risk management and trading halts |
| `PositionTracker` | position_tracker.rs | Cost basis and P&L tracking |

### Most-Used Functions

| Function | Module | Description |
|----------|--------|-------------|
| `check_arbs()` | types.rs | SIMD-accelerated arbitrage detection |
| `kalshi_fee_cents()` | types.rs | Pre-computed fee lookup |
| `pack_orderbook()` | types.rs | Pack prices into `u64` |
| `unpack_orderbook()` | types.rs | Unpack `u64` into prices |

## API by Module

### types.rs - Core Types

#### Enums

- [`MarketType`](types/market-type.md) - Market category (NFL, NBA, etc.)
- [`ArbType`](types/arb-type.md) - Arbitrage opportunity types

#### Structs

- [`MarketPair`](types/market-pair.md) - Matched market across platforms
- [`AtomicOrderbook`](types/atomic-orderbook.md) - Lock-free price storage
- [`AtomicMarketState`](types/atomic-market-state.md) - Combined orderbook state
- [`GlobalState`](types/global-state.md) - Application state container
- [`FastExecutionRequest`](types/fast-execution-request.md) - Order execution request

#### Functions

- [`check_arbs()`](types/check-arbs.md) - SIMD arbitrage detection
- [`kalshi_fee_cents()`](types/kalshi-fee-cents.md) - Fee lookup
- [`pack_orderbook()`](types/pack-orderbook.md) - Pack prices to u64
- [`unpack_orderbook()`](types/unpack-orderbook.md) - Unpack u64 to prices
- [`price_to_cents()`](types/price-to-cents.md) - Float to cents conversion
- [`cents_to_price()`](types/cents-to-price.md) - Cents to float conversion

### execution.rs - Order Execution

#### Structs

- [`ExecutionEngine`](execution/execution-engine.md) - Main execution handler
- [`ExecutionResult`](execution/execution-result.md) - Order result
- [`NanoClock`](execution/nano-clock.md) - High-precision timing

#### Functions

- [`create_execution_channel()`](execution/create-execution-channel.md) - Channel factory

### circuit_breaker.rs - Risk Management

#### Structs

- [`CircuitBreaker`](circuit-breaker/circuit-breaker.md) - Risk controller
- [`CircuitBreakerConfig`](circuit-breaker/circuit-breaker-config.md) - Configuration
- [`CircuitBreakerStatus`](circuit-breaker/circuit-breaker-status.md) - Current state
- [`MarketPosition`](circuit-breaker/market-position.md) - Per-market position

#### Enums

- [`TripReason`](circuit-breaker/trip-reason.md) - Why circuit breaker tripped

### position_tracker.rs - Position Tracking

#### Structs

- [`PositionTracker`](position-tracker/position-tracker.md) - Main tracker
- [`ArbPosition`](position-tracker/arb-position.md) - Arbitrage position
- [`PositionLeg`](position-tracker/position-leg.md) - Single leg of position
- [`PositionSummary`](position-tracker/position-summary.md) - P&L summary
- [`FillRecord`](position-tracker/fill-record.md) - Trade fill record

### discovery.rs - Market Discovery

#### Structs

- [`DiscoveryClient`](discovery/discovery-client.md) - Market matcher

## Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TEST_MODE` | bool | false | Enable paper trading |
| `MIN_EDGE_BPS` | u16 | 50 | Minimum edge in basis points |
| `MAX_POSITION_PER_MARKET` | u32 | 100 | Max contracts per market |
| `MAX_TOTAL_POSITION` | u32 | 1000 | Max total contracts |
| `MAX_DAILY_LOSS_CENTS` | i64 | 10000 | Daily loss limit (cents) |
| `CIRCUIT_BREAKER_ENABLED` | bool | true | Enable circuit breaker |

See [Configuration Guide](../guides/configuration.md) for complete list.

## See Also

- [Modules Overview](../modules/index.md) - Module documentation
- [Examples](../examples/index.md) - Usage examples
- [Concepts](../concepts/index.md) - Technical concepts explained
