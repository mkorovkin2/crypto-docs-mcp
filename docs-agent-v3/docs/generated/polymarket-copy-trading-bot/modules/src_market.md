# src.market

Of course. Here is comprehensive documentation for the `src.market` module, based on the provided analysis.

---

## src.market

### Overview

The `src.market` module is the system's primary market intelligence and analysis engine. It continuously scans the Polymarket platform to discover and prioritize tradable opportunities (`MarketScanner`) and performs deep, real-time analysis on the orderbooks of specific markets (`OrderbookEngine`). Together, these components translate raw market data into structured, actionable insights for trading or monitoring.

### Key Components

*   **`MarketScanner`**
    The 'macro' component responsible for broad market discovery. It scans all available markets on the platform, filters them based on criteria like trading volume, liquidity, and time to resolution, and then applies a scoring algorithm to rank the most promising opportunities. Its primary output is a prioritized list of markets that meet predefined tradability criteria.

*   **`OrderbookEngine`**
    The 'micro' component for in-depth analysis of a single market's orderbook. After a market is identified by the `MarketScanner`, the `OrderbookEngine` connects to its real-time WebSocket data stream. It maintains the live orderbook, calculates critical metrics like Volume-Weighted Average Price (VWAP) and liquidity imbalance, and emits a continuous stream of detailed analytics.

### Usage

The typical workflow involves using the `MarketScanner` to identify interesting markets and then passing a specific market's ID to an `OrderbookEngine` instance for detailed, real-time analysis.

```typescript
import { MarketScanner, OrderbookEngine } from './market';
import { Market, OrderbookAnalytics } from './market/types'; // Assuming types are defined

// 1. Define criteria for the market scanner
const scannerConfig = {
  minDailyVolume: 5000,   // Minimum $5,000 in 24h volume
  maxDaysToResolution: 30, // Markets resolving in the next 30 days
  minLiquidity: 1000,      // Minimum $1,000 in liquidity
};

async function findAndAnalyzeMarkets() {
  console.log("Starting market scan...");
  
  // 2. Instantiate and run the scanner to find top markets
  const scanner = new MarketScanner(scannerConfig);
  const topMarkets: Market[] = await scanner.findTradableMarkets();

  if (topMarkets.length === 0) {
    console.log("No tradable markets found matching the criteria.");
    return;
  }

  console.log(`Scan complete. Found ${topMarkets.length} potential markets.`);

  // 3. Select the highest-scoring market to analyze
  const marketToAnalyze = topMarkets[0];
  console.log(`\nInitializing orderbook analysis for market: "${marketToAnalyze.question}"`);
  console.log(`Condition ID: ${marketToAnalyze.conditionId}`);

  // 4. Instantiate the OrderbookEngine for the selected market
  const engine = new OrderbookEngine(marketToAnalyze.conditionId);

  // 5. Set up a listener to receive real-time analytics updates
  engine.on('update', (analytics: OrderbookAnalytics) => {
    console.clear(); // Clear console for a live view
    console.log(`--- Live Analytics for: "${marketToAnalyze.question}" ---`);
    console.log(`Timestamp: ${new Date(analytics.timestamp).toISOString()}`);
    console.log(`Best Bid: $${analytics.bestBid.toFixed(2)}`);
    console.log(`Best Ask: $${analytics.bestAsk.toFixed(2)}`);
    console.log(`Spread: $${analytics.spread.toFixed(4)}`);
    console.log(`1-Hour VWAP (Yes

