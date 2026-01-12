# Troubleshooting Guide

> Common issues and their solutions

## Connection Issues

### WebSocket Disconnects Frequently

**Symptoms:**
- Logs show repeated "WebSocket disconnected" messages
- Prices become stale
- Missed arbitrage opportunities

**Solutions:**
1. Check network stability
2. Verify API credentials are correct
3. Check if you're being rate limited
4. Ensure firewall allows WebSocket connections
5. Try increasing reconnection delay

**Diagnostic:**
```bash
# Check network connectivity
ping api.kalshi.com
ping gamma-api.polymarket.com
```

### Authentication Failures

**Symptoms:**
- "Invalid credentials" or "Unauthorized" errors
- Bot exits immediately after starting

**Solutions:**
1. Verify `.env` file exists and is readable
2. Check for trailing whitespace in credentials
3. Ensure variable names match exactly:
   - `KALSHI_EMAIL`
   - `KALSHI_PASSWORD`
   - `POLYMARKET_API_KEY`
   - `POLYMARKET_API_SECRET`
   - `POLYMARKET_PASSPHRASE`

**Diagnostic:**
```bash
# Check env file permissions
ls -la .env

# Verify no trailing whitespace
cat -A .env | head -5
```

### Rate Limiting

**Symptoms:**
- "429 Too Many Requests" errors
- Slow market discovery
- Incomplete market list

**Solutions:**
1. Reduce discovery frequency
2. Kalshi limit: 2 requests/second
3. Polymarket Gamma limit: 20 concurrent

**Diagnostic:**
Check logs for rate limit headers:
```
X-RateLimit-Remaining: 0
Retry-After: 30
```

---

## Trading Issues

### No Arbitrage Opportunities Found

**Symptoms:**
- Bot runs but never executes trades
- "Scanning markets..." with no opportunities

**Possible Causes:**
1. `MIN_EDGE_BPS` set too high
2. Markets not matched between platforms
3. Only one platform connected
4. Markets are closed

**Solutions:**
1. Lower `MIN_EDGE_BPS` (default: 50)
2. Check discovery logs for matched markets
3. Verify both WebSockets connected
4. Check market hours

**Diagnostic:**
```bash
# Lower edge requirement temporarily
export MIN_EDGE_BPS=25
cargo run --release
```

### Circuit Breaker Tripped

**Symptoms:**
- "Circuit breaker tripped" log message
- Trading halted
- Bot continues running but not trading

**Check Trip Reason:**
| Reason | Cause | Solution |
|--------|-------|----------|
| `PositionLimitPerMarket` | Too many contracts in one market | Wait or manually close position |
| `TotalPositionLimit` | Too many total contracts | Wait or close positions |
| `DailyLossLimit` | Daily losses exceeded limit | Wait until midnight reset |
| `ConsecutiveErrors` | Multiple API failures | Check connectivity, wait for cooldown |

**Solutions:**
1. Wait for automatic cooldown (default: 5 minutes)
2. Check and resolve underlying issue
3. Increase limits if appropriate
4. Manually reset if safe

### Orders Not Filling

**Symptoms:**
- Orders submitted but not executed
- "Order pending" status persists
- Partial fills only

**Possible Causes:**
1. Price moved before order reached exchange
2. Insufficient liquidity
3. Order price not competitive

**Solutions:**
1. Check execution latency
2. Verify order prices match detected opportunity
3. Consider more aggressive pricing
4. Monitor fill rates

---

## Performance Issues

### High Latency

**Symptoms:**
- Order execution > 100ms
- Missed opportunities due to price movement
- "Stale price" warnings

**Solutions:**
1. Ensure release build:
   ```bash
   cargo build --release
   cargo run --release
   ```
2. Check network latency:
   ```bash
   ping -c 10 api.kalshi.com
   ```
3. Use closer server location
4. Reduce other network traffic

### High CPU Usage

**Symptoms:**
- CPU at 100%
- System sluggish
- Other applications affected

**Solutions:**
1. Check for runaway loops in logs
2. Verify not in debug build
3. Reduce scanning frequency
4. Check for memory leaks

**Diagnostic:**
```bash
# Check process stats
top -p $(pgrep polymarket)
```

### Memory Growth

**Symptoms:**
- Memory usage increases over time
- Eventually crashes with OOM

**Solutions:**
1. Check position tracker isn't unbounded
2. Verify cache has TTL limits
3. Review WebSocket message handling
4. Restart periodically as workaround

---

## Build Issues

### Compilation Errors

**Common errors:**

1. **Missing dependencies:**
   ```
   error: could not find `wide` crate
   ```
   Solution: `cargo update`

2. **Rust version too old:**
   ```
   error: requires rustc 1.75 or newer
   ```
   Solution: `rustup update stable`

3. **Platform-specific issues:**
   - macOS: Install Xcode Command Line Tools
   - Linux: Install build-essential
   - Windows: Install Visual Studio Build Tools

### Test Failures

**Symptoms:**
- `cargo test` fails
- Integration tests timeout

**Solutions:**
1. Run tests in release mode: `cargo test --release`
2. Increase test timeout
3. Check for port conflicts
4. Verify test credentials if using live tests

---

## Configuration Issues

### Environment Variables Not Loading

**Symptoms:**
- Default values used instead of configured
- "Variable not set" warnings

**Solutions:**
1. Verify `.env` file location (project root)
2. Check file is named exactly `.env`
3. Source the file: `source .env`
4. Use absolute paths if needed

### Invalid Configuration Values

**Symptoms:**
- "Invalid value for X" errors
- Bot exits on startup

**Solutions:**
1. Check value types (numbers vs strings)
2. Verify ranges (e.g., `MIN_EDGE_BPS` 0-10000)
3. Remove quotes from numeric values
4. Check for typos in variable names

---

## Getting Help

If these solutions don't resolve your issue:

1. Check logs for specific error messages
2. Search existing issues on GitHub
3. Collect diagnostic information:
   - OS and version
   - Rust version (`rustc --version`)
   - Full error message
   - Relevant log output
4. Open a GitHub issue with details

---

## See Also

- [Configuration Guide](../guides/configuration.md)
- [Circuit Breaker Concept](../concepts/circuit-breaker.md)
- [Running the Bot](../guides/running.md)
