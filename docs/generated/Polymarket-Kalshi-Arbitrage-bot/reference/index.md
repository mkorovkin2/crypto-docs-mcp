# Reference Documentation

> Glossary, file index, and troubleshooting

## Overview

This section provides quick-lookup reference materials including terminology definitions, file organization, and solutions to common problems.

## Reference Materials

| Reference | Description |
|-----------|-------------|
| [Glossary](glossary.md) | Terms and definitions |
| [File Index](file-index.md) | All files in the repository |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions |
| [Environment Variables](env-vars.md) | Complete configuration reference |

## Quick Glossary

| Term | Definition |
|------|------------|
| **Arbitrage** | Exploiting price differences between markets for profit |
| **Atomic** | Operations that complete entirely or not at all |
| **Circuit Breaker** | Automatic trading halt when limits are exceeded |
| **CLOB** | Central Limit Order Book |
| **Lock-Free** | Concurrency without mutex locks |
| **SIMD** | Single Instruction Multiple Data - parallel processing |

## File Quick Reference

### Source Files (12)

| File | Lines | Purpose |
|------|-------|---------|
| `src/main.rs` | 365 | Entry point, orchestration |
| `src/lib.rs` | 50 | Library exports |
| `src/types.rs` | 1265 | Core types, SIMD detection |
| `src/config.rs` | 180 | Configuration loading |
| `src/execution.rs` | 656 | Order execution |
| `src/circuit_breaker.rs` | 320 | Risk management |
| `src/position_tracker.rs` | 450 | P&L tracking |
| `src/cache.rs` | 120 | Caching utilities |
| `src/discovery.rs` | 674 | Market matching |
| `src/kalshi.rs` | 580 | Kalshi client |
| `src/polymarket.rs` | 420 | Polymarket WebSocket |
| `src/polymarket_clob.rs` | 380 | Polymarket CLOB |

### Documentation Files (6)

| File | Purpose |
|------|---------|
| `doc/01-getting-started.md` | Introduction |
| `doc/02-installation.md` | Installation guide |
| `doc/03-credentials.md` | API key setup |
| `doc/04-configuration.md` | Configuration reference |
| `doc/05-running-the-bot.md` | Operation guide |
| `doc/06-troubleshooting.md` | Problem solving |

## Common Troubleshooting

### Connection Issues

**WebSocket disconnects frequently**
- Check network stability
- Verify API credentials
- Review rate limiting (Kalshi: 2/sec, Gamma: 20 concurrent)

**Authentication failures**
- Verify credentials in `.env` file
- Check for trailing whitespace
- Ensure correct environment variable names

### Trading Issues

**No arbitrage opportunities found**
- Check `MIN_EDGE_BPS` setting (default: 50)
- Verify both platforms are connected
- Review market discovery logs

**Circuit breaker tripped**
- Check position limits
- Review daily loss counter
- Reset with `CIRCUIT_BREAKER_COOLDOWN_SECONDS`

### Performance Issues

**High latency detected**
- Ensure release build (`cargo build --release`)
- Check network latency to exchanges
- Review system resource usage

## Environment Variable Quick Reference

### Required Variables

```bash
KALSHI_EMAIL=your@email.com
KALSHI_PASSWORD=your_password
POLYMARKET_API_KEY=your_api_key
POLYMARKET_API_SECRET=your_secret
POLYMARKET_PASSPHRASE=your_passphrase
```

### Trading Parameters

```bash
TEST_MODE=true                    # Paper trading
MIN_EDGE_BPS=50                   # Minimum edge (basis points)
MAX_POSITION_PER_MARKET=100       # Max contracts per market
MAX_TOTAL_POSITION=1000           # Max total contracts
MAX_DAILY_LOSS_CENTS=10000        # Daily loss limit ($100)
```

### Circuit Breaker

```bash
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_COOLDOWN_SECONDS=300
MAX_CONSECUTIVE_ERRORS=5
```

## See Also

- [Configuration Guide](../guides/configuration.md) - Detailed configuration
- [Concepts](../concepts/index.md) - Technical explanations
- [API Reference](../api/index.md) - Code documentation
