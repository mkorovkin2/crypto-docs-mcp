---
name: crypto-short-term-markets
description: Researches Polymarket's BTC/ETH/SOL 15-minute and 1-hour prediction markets. Gathers current market slugs, pricing, volume, liquidity, and trading characteristics. Invoke dynamically when building bots for these short-term crypto markets.
allowed-tools: Task, WebSearch, WebFetch, Read, Write, Grep, Glob, TodoWrite
---

# Crypto Short-Term Markets Research Skill

Specialized skill for gathering detailed information about Polymarket's high-frequency cryptocurrency prediction markets (Bitcoin, Ethereum, Solana) with 15-minute and 1-hour resolution windows.

## Purpose

This skill provides the coding agent with comprehensive knowledge about:
- Current market slugs and IDs for BTC/ETH/SOL short-term markets
- Market mechanics, pricing, and resolution patterns
- Volume, liquidity, and spread characteristics
- API endpoints and access patterns for these markets
- Trading considerations specific to short-duration contracts

## When to Invoke This Skill

Invoke this skill when:
- User wants to build a bot targeting 15-minute or 1-hour crypto markets
- Strategy involves rapid-resolution BTC/ETH/SOL predictions
- Need current market data to inform bot configuration
- Researching short-term crypto market mechanics for implementation

## Research Process

### Phase 1: Gather Current Market Intelligence

Use Task tool with subagent_type="web-search-researcher" to research:

```
## Research Request: Polymarket Short-Term Crypto Markets

Research the current state of Polymarket's 15-minute and 1-hour cryptocurrency prediction markets.

### Target Markets
1. **Bitcoin (BTC)**: 15-minute and hourly up/down markets
2. **Ethereum (ETH)**: 15-minute and hourly up/down markets
3. **Solana (SOL)**: 15-minute and hourly up/down markets

### Information to Gather

1. **Market Slugs**: Find the exact slug patterns used for these markets
   - 15-minute uses Unix timestamp: `btc-updown-15m-{unix_timestamp}`
   - Hourly/Daily use human-readable: `bitcoin-up-or-down-{month}-{day}-{hour}-et`
   - How slug format varies by timeframe

2. **Market Mechanics**:
   - How prices are determined (15-min: Chainlink, Hourly/Daily: Binance)
   - Resolution timing and process
   - Settlement currency (USDC on Polygon)

3. **Trading Characteristics**:
   - Typical volume ranges
   - Liquidity depth
   - Spread patterns
   - Fee structure (taker fees up to 3%)

4. **Market Categories Available**:
   - 15 Min, Hourly, 4 Hour, Daily, Weekly, Monthly
   - Which coins are supported at each timeframe

5. **API Access Patterns**:
   - Gamma API endpoints for these markets
   - CLOB API for order placement
   - Rate limits relevant to short-term markets

### Output
Write comprehensive findings to: `thoughts/shared/crypto-markets-research.md`
```

### Phase 2: Fetch Live Market Data

Use WebFetch to query Polymarket's API directly:

**Markets List Endpoint:**
```
GET https://gamma-api.polymarket.com/markets?category=crypto&limit=50
```

**Market by Slug:**
```
GET https://gamma-api.polymarket.com/markets/slug/{slug}
```

Extract:
- Current active 15-minute and hourly markets
- Volume and liquidity metrics
- Price ranges and spreads
- Market IDs and condition IDs

### Phase 3: Document Findings

Write research output to: `thoughts/shared/crypto-markets-research.md`

Use this format:

```markdown
# Polymarket Short-Term Crypto Markets Research

Generated: {timestamp}

## Market Overview

### Supported Assets
| Asset | 15-Min | Hourly | 4-Hour | Daily |
|-------|--------|--------|--------|-------|
| BTC   | Yes    | Yes    | Yes    | Yes   |
| ETH   | Yes    | Yes    | Yes    | Yes   |
| SOL   | Yes    | Yes    | Yes    | Yes   |
| XRP   | Yes    | Yes    | Yes    | Yes   |

### Market Count
- Bitcoin: ~20 active markets
- Ethereum: ~15 active markets
- Solana: ~10 active markets

## Slug Patterns

### 15-Minute Markets
Format: `{asset}-updown-15m-{unix_timestamp}`
- Uses abbreviated asset names: `btc`, `eth`, `sol`
- Unix timestamp is the **start time** of the 15-minute window
Examples:
- `btc-updown-15m-1767025800`
- `eth-updown-15m-1767025800`
- `sol-updown-15m-1767025800`

### Hourly Markets
Format: `{asset}-up-or-down-{month}-{day}-{hour}-et`
- Uses full asset names: `bitcoin`, `ethereum`, `solana`
Examples:
- `bitcoin-up-or-down-january-6-6pm-et`
- `ethereum-up-or-down-january-6-10am-et`

### Daily Markets
Format: `{asset}-up-or-down-on-{month}-{day}`
- Note the "on" keyword between "down" and date
Examples:
- `bitcoin-up-or-down-on-january-7`
- `ethereum-up-or-down-on-january-7`

## API Endpoints

### Gamma API (Market Data)
Base URL: `https://gamma-api.polymarket.com`

| Endpoint | Purpose |
|----------|---------|
| GET /markets | List markets with filters |
| GET /markets/slug/{slug} | Get market by slug |
| GET /markets/{id} | Get market by ID |

### Query Parameters for Crypto Markets
```
?category=crypto
?tag_id=crypto
?volume_num_min=1000
?liquidity_num_min=500
?closed=false
```

### CLOB API (Trading)
Base URL: `https://clob.polymarket.com`

| Endpoint | Purpose | Auth Level |
|----------|---------|------------|
| GET /book | Get order book | L0 |
| GET /tick-size | Get tick size | L0 |
| POST /order | Place order | L2 |
| DELETE /order | Cancel order | L2 |

## Market Mechanics

### Price Oracle (DIFFERENT BY TIMEFRAME)
- **15-minute markets**: Chainlink BTC/USD (or ETH/USD, SOL/USD) data stream
- **Hourly/Daily markets**: Binance BTC/USDT (or ETH/USDT, SOL/USDT) 1-hour/daily candle data
- Resolution: "Up" if closing price >= opening price for the window

### Resolution Timing
- **15-minute**: Resolves every :00, :15, :30, :45
- **Hourly**: Resolves on the hour
- Settlement in USDC on Polygon

### Fee Structure
- **Maker**: 0% (rebates available)
- **Taker**: Up to 3% on 15-minute markets
- Fee varies by probability range

## Trading Characteristics

### Typical Metrics (15-minute BTC)
| Metric | Typical Range |
|--------|---------------|
| Volume per market | $500 - $5,000 |
| Liquidity | $200 - $2,000 |
| Spread | 2-5 cents |
| YES+NO sum | ~$1.02-1.05 |

### Bot-Relevant Considerations
1. **High frequency**: New markets every 15 minutes
2. **Short windows**: Must act quickly after market opens
3. **Liquidity competition**: Algorithmic traders dominate
4. **Fee impact**: 3% taker fee affects profitability
5. **Spread capture**: Market making viable due to consistent volume

## Implementation Considerations

### For Spike Detector Bots
- Monitor crypto price feeds (Binance, Coinbase)
- Compare to current Polymarket prices
- Act within seconds of price movement
- Account for oracle lag vs exchange prices

### For Market Maker Bots
- Target spread capture between YES and NO
- Manage inventory as resolution approaches
- Adjust quotes based on time-to-resolution
- Consider maker rebates

### For Arbitrage Bots
- YES + NO should sum to ~$1.00
- Exploit deviations > $1.02 (after fees)
- Speed critical - inefficiencies close quickly
- Consider cross-market opportunities

## Sample Market Responses

### 15-Minute Market (uses Unix timestamp slug)
```json
{
  "id": "1047724",
  "question": "Bitcoin Up or Down - December 29, 11:30AM-11:45AM ET",
  "slug": "btc-updown-15m-1767025800",
  "conditionId": "0xa1c53c9bb2bd04c05b74cc6d53ec9d70c361930286352f59d4b8ee8bb7066a49",
  "category": "crypto",
  "endDate": "2025-12-29T16:45:00Z",
  "outcomes": ["Up", "Down"],
  "outcomePrices": ["0.52", "0.48"],
  "volume": "180282.25",
  "liquidity": "1200.00",
  "bestBid": "0.90",
  "bestAsk": "0.92",
  "clobTokenIds": [
    "36633332835139630294037225909071043774489968070493217979750527896571064084826",
    "105598657857922108568963102828661075611859944150047654501560097026807336845983"
  ]
}
```

### Hourly Market (uses human-readable slug)
```json
{
  "id": "...",
  "question": "Bitcoin Up or Down - January 6, 6PM ET",
  "slug": "bitcoin-up-or-down-january-6-6pm-et",
  "category": "crypto",
  "endDate": "2026-01-06T23:00:00Z",
  "outcomes": ["Up", "Down"],
  "outcomePrices": ["0.51", "0.49"],
  "recurrence": "hourly"
}
```

## Configuration Recommendations

### Environment Variables
```env
# Market Selection
TARGET_ASSETS=BTC,ETH,SOL
TARGET_TIMEFRAMES=15min,1hour
MIN_LIQUIDITY=500
MIN_VOLUME=1000

# Trading Parameters
MAX_POSITION_PER_MARKET=100
SLIPPAGE_TOLERANCE=0.02
TAKER_FEE_BUFFER=0.03

# API Configuration
GAMMA_API_BASE=https://gamma-api.polymarket.com
CLOB_API_BASE=https://clob.polymarket.com
POLLING_INTERVAL_MS=5000
```
```

## Output

After completing research, this skill provides:

1. **Written Research File**: `thoughts/shared/crypto-markets-research.md`
2. **Summary to Calling Agent**: Key findings for immediate use
3. **Configuration Recommendations**: Ready-to-use parameters for bot configuration

## Integration with create_single_strategy_bot

This skill is invoked by the `/create_single_strategy_bot` command when:
- User selects a strategy targeting 15-minute or hourly crypto markets
- User mentions BTC/ETH/SOL short-term trading
- Strategy requires understanding of rapid-resolution market mechanics

The research output informs:
- Strategy specification (market selection, timing)
- Bot scaffolding (API endpoints, configuration)
- Risk management (fees, liquidity, speed requirements)
