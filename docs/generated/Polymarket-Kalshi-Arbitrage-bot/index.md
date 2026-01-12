# Polymarket-Kalshi Arbitrage Bot Documentation

> High-performance Rust arbitrage trading bot for prediction markets

## Overview

The Polymarket-Kalshi Arbitrage Bot is a sophisticated trading system that identifies and executes arbitrage opportunities between Polymarket and Kalshi prediction markets. Built in Rust for maximum performance, it features lock-free atomic orderbooks, SIMD-accelerated arbitrage detection, and comprehensive risk management.

## Key Features

- **Lock-Free Atomic Orderbooks** - Thread-safe price updates using bit-packed `AtomicU64` operations
- **SIMD Arbitrage Detection** - Processes 4 arbitrage types simultaneously using `wide::i16x8` vectors
- **Pre-computed Fee Tables** - O(1) Kalshi fee lookups via static 101-entry array
- **Circuit Breaker Protection** - Automatic trading halt on position limits, losses, or errors
- **Concurrent Execution** - Parallel order placement across platforms with `tokio::join!`
- **Position Tracking** - Cost basis tracking, guaranteed profit calculation, automatic exposure management

## Quick Navigation

| Section | Description |
|---------|-------------|
| [Architecture](architecture/index.md) | System design, data flow, and patterns |
| [Modules](modules/index.md) | Documentation for all 12 source modules |
| [API Reference](api/index.md) | Public types, functions, and exports |
| [Guides](guides/index.md) | Getting started, installation, configuration |
| [Concepts](concepts/index.md) | Domain and technical concepts explained |
| [Examples](examples/index.md) | Practical code examples and usage patterns |
| [Reference](reference/index.md) | Glossary, file index, troubleshooting |

## Getting Started

1. **New to the bot?** Start with [Getting Started](guides/getting-started.md)
2. **Ready to install?** See [Installation Guide](guides/installation.md)
3. **Need to configure?** Check [Configuration Guide](guides/configuration.md)
4. **Having issues?** Visit [Troubleshooting](reference/troubleshooting.md)

## Supported Markets

The bot monitors these market categories across both platforms:
- NFL, NBA, MLB, NHL, NCAAF, NCAAB
- Soccer (MLS, EPL, La Liga)
- Tennis, Golf

## Safety Notice

This bot executes real trades with real money. Always:
- Start with `TEST_MODE=true` to validate without trading
- Use conservative position limits initially
- Monitor the circuit breaker status
- Never trade more than you can afford to lose

---

*Documentation generated with `/generate_repo_docs` - Standard Mode*
