# main.rs - Application Entry Point

> Orchestration, WebSocket spawning, and heartbeat monitoring

**Location**: `src/main.rs`  
**Lines**: 365  
**Dependencies**: `tokio`, all internal modules

## Overview

The `main.rs` module is the application entry point and orchestration hub. It initializes all components, spawns WebSocket connections, and coordinates the main trading loop.

## Key Responsibilities

1. **Configuration Loading** - Load environment variables and config
2. **Component Initialization** - Create all system components
3. **WebSocket Spawning** - Start Kalshi and Polymarket feeds
4. **Market Discovery** - Match markets across platforms
5. **Main Loop** - Coordinate arbitrage detection and execution
6. **Heartbeat Monitoring** - Detect stale connections

## Initialization Flow

```rust
#[tokio::main]
async fn main() -> Result<()> {
    // 1. Load configuration
    let config = Config::from_env()?;
    
    // 2. Initialize components
    let circuit_breaker = Arc::new(CircuitBreaker::new(config.circuit_breaker));
    let position_tracker = Arc::new(PositionTracker::new());
    let global_state = Arc::new(GlobalState::new());
    
    // 3. Run market discovery
    let discovery = DiscoveryClient::new(&config);
    let market_pairs = discovery.discover_markets().await?;
    global_state.set_market_pairs(market_pairs);
    
    // 4. Spawn WebSocket handlers
    let kalshi_handle = spawn_kalshi_websocket(global_state.clone());
    let poly_handle = spawn_polymarket_websocket(global_state.clone());
    
    // 5. Start execution engine
    let engine = ExecutionEngine::new(...);
    
    // 6. Run main loop
    run_main_loop(global_state, engine).await
}
```

## WebSocket Spawning

### Kalshi WebSocket

```rust
fn spawn_kalshi_websocket(state: Arc<GlobalState>) -> JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            match kalshi::connect_and_subscribe(&state).await {
                Ok(_) => info!("Kalshi WebSocket completed"),
                Err(e) => error!("Kalshi WebSocket error: {}", e),
            }
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    })
}
```

### Polymarket WebSocket

```rust
fn spawn_polymarket_websocket(state: Arc<GlobalState>) -> JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            match polymarket::connect_and_subscribe(&state).await {
                Ok(_) => info!("Polymarket WebSocket completed"),
                Err(e) => error!("Polymarket WebSocket error: {}", e),
            }
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    })
}
```

## Main Trading Loop

```rust
async fn run_main_loop(
    state: Arc<GlobalState>,
    engine: Arc<ExecutionEngine>,
) -> Result<()> {
    let mut interval = tokio::time::interval(Duration::from_millis(10));
    
    loop {
        interval.tick().await;
        
        // Check heartbeats
        if !state.is_kalshi_connected() || !state.is_polymarket_connected() {
            continue;
        }
        
        // Scan for arbitrage opportunities
        for (idx, pair) in state.market_pairs.iter().enumerate() {
            let kalshi_book = state.kalshi_books[idx].get();
            let poly_book = state.polymarket_books[idx].get();
            
            if let Some(arb) = check_arbs(kalshi_book, poly_book, config.min_edge_bps) {
                engine.execute(idx, arb).await;
            }
        }
    }
}
```

## Test Mode Injection

When `TEST_MODE=true`, the main loop logs opportunities without executing:

```rust
if config.test_mode {
    info!("TEST MODE: Would execute {:?} on market {}", arb, pair.event_name);
    continue;
}
```

## Graceful Shutdown

```rust
tokio::select! {
    _ = run_main_loop(...) => {},
    _ = tokio::signal::ctrl_c() => {
        info!("Shutting down...");
        // Cleanup code
    }
}
```

## See Also

- [Architecture Overview](../architecture/index.md)
- [Configuration Guide](../guides/configuration.md)
- [Running the Bot](../guides/running.md)
