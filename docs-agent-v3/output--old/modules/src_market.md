# src.market

Of course. Here is the comprehensive documentation for the `src.market` module.

***

## src.market

### Overview

The `src.market` module is the application's primary interface for market data acquisition, analysis, and intelligence from Polymarket. It is responsible for discovering potentially profitable markets and performing deep, real-time analysis on them. This is achieved through a two-tiered approach: a broad, periodic scanner to identify opportunities (`MarketScanner`) and a focused, real-time engine for in-depth orderbook analysis (`OrderbookEngine`).

### Key Components

*   **`MarketScanner` (`marketScanner.ts`)**
    This class periodically fetches all active markets from the Polymarket API. It then applies a series of configurable filters (e.g., volume, liquidity, time to resolution) and a scoring algorithm to identify and rank the most promising trading opportunities. The results are cached internally for efficient access by other parts of the system.

*   **`OrderbookEngine` (`orderbook.ts`)**
    This class provides continuous, real-time analysis of a single market's orderbook. It connects to a WebSocket data stream, processes raw order updates, and calculates key financial metrics like bid-ask spread, market depth, price momentum, and volatility. It emits structured `OrderbookSnapshot` events for consumers, such as a trading strategy module.

### Usage

The typical workflow involves using the `MarketScanner` to discover a high-potential market, and then instantiating an `OrderbookEngine` to monitor that specific market in real-time for an entry or exit signal.

```typescript
import { MarketScanner } from './market/marketScanner';
import { OrderbookEngine } from './market/orderbook';
import { Market, OrderbookSnapshot } from '../types'; // Assuming shared types

// 1. Define configuration for the scanner
const scannerConfig = {
  // Hypothetical filters and scorer configuration
  filters: [
    { type: 'volume', min: 10000 },
    { type: 'liquidity', min: 5000 },
    { type: 'daysRemaining', max: 30 },
  ],
  scorer: {
    weights: { volume: 0.5, liquidity: 0.3, volatility: 0.2 },
  },
  scanInterval: 60000, // Scan every 60 seconds
};

async function main() {
  // 2. Initialize and start the MarketScanner
  const scanner = new MarketScanner(scannerConfig);
  await scanner.start();
  console.log('MarketScanner started. Periodically searching for opportunities...');

  // 3. Periodically check the scanner's results for the top market
  setInterval(() => {
    const scoredMarkets: Market[] = scanner.getScoredMarkets();
    if (scoredMarkets.length > 0) {
      const topMarket = scoredMarkets[0];
      console.log(`Top ranked market found: "${topMarket.question}" (Score: ${topMarket.score})`);
      
      // 4. Once a top market is found, start a dedicated OrderbookEngine for it
      // (In a real app, you'd manage engine instances to avoid duplicates)
      startOrderbookAnalysis(topMarket.conditionId);
    } else {
      console.log('No markets passed the filters in the last scan.');
    }
  }, 10000); // Check for new top markets every 10 seconds
}

async function startOrderbookAnalysis(conditionId: string) {
  console.log(`Starting real-time analysis for market: ${conditionId}`);
  const engine = new OrderbookEngine({ conditionId });

  // 5. Listen for real-time snapshot events from the engine
  engine.on('snapshot', (snapshot: OrderbookSnapshot) => {
    // A trading strategy would consume this data to make decisions
    console.log(`[${conditionId}] Snapshot Update:`);
    console.log(`  Spread: ${snapshot.spread.toFixed(4)}`);
    console.log(`  Best Bid: ${snapshot.bestBid.price} | Best Ask: ${snapshot.bestAsk.price}`);
    console.log(`  1-min Momentum: ${snapshot.momentum['1m'].toFixed(5)}`);
  });

  engine.on('error', (err) => {
    console.error(`OrderbookEngine for ${conditionId} encountered an error:`, err);
  });

  await engine.start();
}

main().catch(console.error);
```

### API Reference

#### `class MarketScanner`

Responsible for discovering and ranking markets based on predefined criteria.

*   **`constructor(config: MarketScannerConfig)`**
    Creates an instance of the `MarketScanner`.
    *   `config`: An object containing configuration.
        *   `apiClient`: An instance of the Polymarket API client.
        *   `filters`: An array of filter objects to apply to the market list.
        *   `scorer`: A scoring configuration object.
        *   `scanInterval` (optional): The interval in milliseconds for periodic scanning

