# src.strategy

Of course. Here is the comprehensive documentation for the `src.strategy` module.

---

## src.strategy

### Overview

The `src.strategy` module is the decision-making core of the trading system. It provides a standardized framework for creating and managing trading algorithms through the abstract `BaseStrategy` class. This ensures all strategies, regardless of their internal logic, present a consistent interface to the rest of the application for evaluation and execution. The module also includes concrete implementations for specific trading approaches, such as momentum and arbitrage.

### Key Components

*   **`BaseStrategy`** (`baseStrategy.ts`): An abstract class that serves as the foundational blueprint for all trading strategies. It defines the essential properties (e.g., `name`, `marketId`) and methods (e.g., `evaluate`) that every concrete strategy must implement. This enforces a uniform contract, allowing the system's strategy runner to interact with any strategy in a generic way.

*   **`MomentumStrategy`** (`momentum.ts`): A concrete implementation of `BaseStrategy` that identifies trading opportunities based on strong price movements combined with significant trading volume. It analyzes historical and real-time market data to detect breakouts or trend continuations, generating signals to buy or sell accordingly.

*   **`SpreadArbitrageStrategy`** (`spreadArb.ts`): A concrete implementation of `BaseStrategy` designed to capitalize on price inefficiencies in prediction markets. It specifically monitors complementary "YES" and "NO" tokens for a single market, executing trades when the combined price deviates significantly from a total value of 1, thereby locking in a risk-free profit.

### Usage

Strategies are designed to be instantiated by a higher-level service, such as a "Strategy Runner" or "Market Monitor," which then feeds them market data. The strategy's `evaluate` method is called to produce a `TradeSignal`.

#### Example 1: Using the MomentumStrategy

This example shows how to set up and run a `MomentumStrategy` to watch for a 5% price change over the last hour.

```typescript
import { MomentumStrategy } from './src/strategy/momentum';
import { MarketData, TradeSignal } from './src/types'; // Assuming types are defined elsewhere

// 1. Define the configuration for the strategy
const momentumConfig = {
  marketId: '0x123abc...',
  priceChangeThreshold: 0.05, // 5% price change
  volumeThreshold: 1000,      // Minimum volume of 1000 units
  timePeriod: 3600 * 1000,    // 1 hour in milliseconds
};

// 2. Instantiate the strategy
const momentumStrategy = new MomentumStrategy(momentumConfig);

// 3. In a market data processing loop, feed data to the strategy
async function onNewMarketData(marketData: MarketData) {
  console.log(`Evaluating ${momentumStrategy.name} for market ${momentumStrategy.marketId}`);

  // The evaluate method contains the core logic
  const signal: TradeSignal | null = await momentumStrategy.evaluate(marketData);

  if (signal) {
    console.log('Trade signal generated!', signal);
    // Pass the signal to an execution engine
    // executeTrade(signal);
  } else {
    console.log('No trade signal generated. Conditions not met.');
  }
}

// Example market data object (structure is hypothetical)
const sampleMarketData: MarketData = {
  timestamp: Date.now(),
  latestPrice: 105.0,
  historicalPrices: [{ timestamp: Date.now() - 3600 * 1000, price: 100.0 }],
  volumeLastHour: 1500,
  // ... other relevant data
};

onNewMarketData(sampleMarketData);
```

#### Example 2: Using the SpreadArbitrageStrategy

This example demonstrates setting up a strategy to find arbitrage opportunities where the combined price of YES and NO tokens is less than 0.98.

```typescript
import { SpreadArbitrageStrategy } from './src/strategy/spreadArb';
import { MarketData, TradeSignal } from './src/types';

// 1. Define the configuration
const arbConfig = {
  marketId: '0x456def...',
  yesTokenId: 'token-yes',
  noTokenId: 'token-no',
  minProfitThreshold: 0.02, // Look for a combined price < 0.98 (1.00 - 0.02)
};

// 2. Instantiate the strategy
const arbStrategy = new SpreadArbitrageStrategy(arbConfig);

// 3. Feed market data containing prices for both tokens
async function checkForArbitrage(marketData: MarketData) {
  console.log(`Evaluating ${arbStrategy.name} for market ${arbStrategy.marketId}`);

  const signal: TradeSignal | null = await arbStrategy.evaluate(marketData);

  if (signal) {
    console.log('Arbitrage opportunity found!', signal);
    // This signal would likely contain two opposing orders (buy YES, buy NO)
    // executeArbitrage(signal);
  } else {
    console.log('No arbitrage opportunity found.');
  }
}

// Example market data for an arbitrage strategy
const sampleArbData: MarketData = {
  timestamp: Date.now(),
  tokenPrices: {
    'token-yes': 0.65,
    'token-no': 0.32, // 0.65 + 0.32 = 0.97, which is < 0.98
  },
  // ... other data
};

checkForArbitrage(sampleArbData);
```

### API Reference

#### `BaseStrategy` (Abstract Class)

The foundational interface for all strategies. It cannot be instantiated directly.

**Properties:**

*   `name: string`: The unique name of the strategy (e.g., "Momentum").
*   `marketId: string`: The identifier for the market this strategy instance is targeting.

**Methods:**

*   `abstract evaluate(marketData: MarketData): Promise<TradeSignal | null>`
    *   The core logic method for the strategy. It processes incoming market data and decides whether to generate a trade signal.
    *   **Parameters:**
        *   `marketData: MarketData`: An object containing the latest market state, including prices, volume, order book depth, etc.
    *   **Returns:** A `Promise` that resolves to a `TradeSignal` object if trading conditions are met, or `null` otherwise.

---

#### `MomentumStrategy` (Class)

`extends BaseStrategy`

Implements a trading strategy based on price and volume momentum.

**Constructor:**

*   `constructor(config: MomentumStrategyConfig)`
    *   **Parameters:**
        *   `config: MomentumStrategyConfig`: An object containing strategy parameters.
            *   `marketId: string`: The target market ID.
            *   `priceChangeThreshold: number`: The minimum fractional price change required to trigger a signal (e.g., `0.05` for 5%).
            *   `volumeThreshold: number`: The minimum trading volume over the period to validate the price move.
            *   `timePeriod: number`: The lookback period in milliseconds for calculating price/volume changes.

---

#### `SpreadArbitrageStrategy` (

