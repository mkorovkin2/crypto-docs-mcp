# discovery.rs - Market Discovery Module

> Market matching, caching, and rate-limited API calls

**Location**: `src/discovery.rs`  
**Lines**: 674  
**Dependencies**: `reqwest`, `tokio`, `serde`, cache module

## Overview

The `discovery.rs` module handles matching markets between Kalshi and Polymarket. It fetches active markets from both platforms, matches them by event name/type, and maintains a cache to reduce API calls.

## Key Components

### DiscoveryClient

Main discovery handler:

```rust
pub struct DiscoveryClient {
    kalshi_client: reqwest::Client,
    polymarket_client: reqwest::Client,
    cache: RwLock<DiscoveryCache>,
    rate_limiter: RateLimiter,
}
```

**Key Methods**:
- `new(config)` - Create with configuration
- `discover_markets()` - Full discovery scan
- `refresh_incremental()` - Update changed markets only
- `get_cached()` - Return cached market pairs

### Discovery Flow

```rust
pub async fn discover_markets(&self) -> Result<Vec<MarketPair>> {
    // 1. Fetch Kalshi markets (rate limited: 2/sec)
    let kalshi_markets = self.fetch_kalshi_markets().await?;
    
    // 2. Fetch Polymarket markets (rate limited: 20 concurrent)
    let poly_markets = self.fetch_polymarket_markets().await?;
    
    // 3. Match by event name and market type
    let pairs = self.match_markets(kalshi_markets, poly_markets);
    
    // 4. Cache results
    self.cache.write().update(pairs.clone());
    
    Ok(pairs)
}
```

### Market Matching Logic

```rust
fn match_markets(
    &self,
    kalshi: Vec<KalshiMarket>,
    poly: Vec<PolymarketMarket>,
) -> Vec<MarketPair> {
    let mut pairs = Vec::new();
    let poly_map: FxHashMap<String, _> = poly.into_iter()
        .map(|m| (normalize_name(&m.question), m))
        .collect();
    
    for km in kalshi {
        let normalized = normalize_name(&km.title);
        if let Some(pm) = poly_map.get(&normalized) {
            pairs.push(MarketPair {
                kalshi_ticker: km.ticker,
                polymarket_token_id: pm.token_id.clone(),
                market_type: detect_market_type(&km.title),
                event_name: km.title.clone(),
                // ...
            });
        }
    }
    
    pairs
}
```

### Rate Limiting

```rust
struct RateLimiter {
    kalshi_semaphore: Semaphore,      // 2 concurrent requests
    gamma_semaphore: Semaphore,        // 20 concurrent requests
    kalshi_interval: Duration,         // 500ms between requests
}
```

### Caching

Cache with 2-hour TTL:

```rust
struct DiscoveryCache {
    market_pairs: Vec<MarketPair>,
    last_updated: DateTime<Utc>,
    ttl: Duration,  // 2 hours
}

impl DiscoveryCache {
    fn is_stale(&self) -> bool {
        Utc::now() - self.last_updated > self.ttl
    }
}
```

### Incremental Refresh

```rust
pub async fn refresh_incremental(&self) -> Result<Vec<MarketPair>> {
    // Only fetch markets updated since last refresh
    let since = self.cache.read().last_updated;
    
    let kalshi_updates = self.fetch_kalshi_updates_since(since).await?;
    let poly_updates = self.fetch_poly_updates_since(since).await?;
    
    // Merge with existing cache
    let mut pairs = self.cache.read().market_pairs.clone();
    self.merge_updates(&mut pairs, kalshi_updates, poly_updates);
    
    self.cache.write().update(pairs.clone());
    Ok(pairs)
}
```

## Supported Market Types

The discovery module matches these market types:

| Type | Kalshi Pattern | Polymarket Pattern |
|------|----------------|-------------------|
| NFL | `NFL-*` | Contains "NFL" |
| NBA | `NBA-*` | Contains "NBA" |
| MLB | `MLB-*` | Contains "MLB" |
| NHL | `NHL-*` | Contains "NHL" |
| NCAAF | `NCAAF-*` | Contains "college football" |
| NCAAB | `NCAAB-*` | Contains "college basketball" |
| Soccer | `SOCCER-*` | Contains team names |
| Tennis | `TENNIS-*` | Contains player names |
| Golf | `GOLF-*` | Contains tournament names |

## Team Mapping Cache

Pre-loaded team name mappings for matching:

```rust
// Stored in cache/team_mappings.json
{
    "Lakers": ["Los Angeles Lakers", "LA Lakers", "LAL"],
    "Celtics": ["Boston Celtics", "BOS"],
    // ...
}
```

## See Also

- [Cache Module](cache.md)
- [Market Pair Type](../api/types/market-pair.md)
- [Architecture Overview](../architecture/index.md)
