# Architecture Documentation

> System design, data flow, and architectural patterns

## Overview

The Polymarket-Kalshi Arbitrage Bot uses an event-driven architecture optimized for low-latency trading. This section documents the system design, component interactions, and key patterns.

## Contents

- [System Overview](overview.md) - High-level architecture and component diagram
- [Data Flow](data-flow.md) - Request path from WebSocket to execution
- [Dependency Graph](dependencies.md) - Module dependencies and relationships
- [Patterns](patterns.md) - Design patterns used throughout the codebase

## Architecture Highlights

### Event-Driven Design

```
WebSocket Streams → Atomic Updates → Arb Detection → Execution → Position Tracking
```

### Key Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **Orchestrator** | `main.rs` | WebSocket spawning, heartbeat monitoring |
| **State Manager** | `types.rs` | Global state, atomic orderbooks, market pairs |
| **Execution Engine** | `execution.rs` | Order placement, deduplication, exposure management |
| **Circuit Breaker** | `circuit_breaker.rs` | Risk limits, automatic trading halts |
| **Position Tracker** | `position_tracker.rs` | Cost basis, P&L calculation, fill tracking |
| **Discovery Client** | `discovery.rs` | Market matching, caching, rate limiting |

### Performance Characteristics

- **Orderbook Updates**: < 1ms via lock-free atomics
- **Arbitrage Detection**: < 0.5ms using SIMD operations
- **Order Execution**: Concurrent across both platforms
- **Memory Efficiency**: Bit-packed orderbook representation (8 bytes per book)

### Technology Stack

- **Language**: Rust 1.75+
- **Runtime**: Tokio async runtime
- **SIMD**: `wide` crate for vectorized operations
- **Hashing**: `FxHash` for fast non-cryptographic lookups
- **Serialization**: `serde` with JSON for API communication

## Design Principles

1. **Lock-Free Where Possible** - Atomic operations over mutexes
2. **Pre-compute Over Runtime** - Fee tables, hash lookups
3. **Fail-Safe Default** - Circuit breaker trips on unknown errors
4. **Zero-Copy Updates** - In-place atomic orderbook modifications

## See Also

- [Modules Overview](../modules/index.md) - Individual module documentation
- [API Reference](../api/index.md) - Public exports and types
- [Lock-Free Atomics](../concepts/lock-free-atomics.md) - Concurrency patterns explained
