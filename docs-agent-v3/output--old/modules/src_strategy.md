# src.strategy

Of course. Here is the comprehensive documentation for the `src.strategy` module.

---

## src.strategy

### Overview

The `src.strategy` module is the analytical core of the trading system, responsible for encapsulating the logic that generates trading signals. It establishes a robust, extensible framework through an abstract base class, `BaseStrategy`, ensuring that all concrete trading strategies adhere to a consistent interface. This design allows the system to easily switch between or run multiple strategies, such as momentum-following or arbitrage, in a plug-and-play manner.

### Key Components

*   **`BaseStrategy`** (`src/strategy/baseStrategy.ts`)
    An abstract class that serves as the foundational blueprint for all trading strategies. It defines the required methods and properties, such as `evaluate()`, that any concrete strategy must implement. This ensures that the main trading engine can interact with any strategy uniformly without needing to know its internal logic.

*   **`MomentumStrategy`** (`src/strategy/momentum.ts`)
    A concrete implementation of `BaseStrategy`. This strategy is designed to identify and act on market trends by analyzing price momentum, typically confirmed by significant changes in trading volume. It includes logic for entering positions when momentum is strong and managing those positions, often with trailing stops to lock in profits or limit losses.

*   **`SpreadArbitrageStrategy`** (`src/strategy/spreadArb.ts`)
    Another concrete implementation of `BaseStrategy`. This strategy focuses on exploiting price discrepancies for the same or related assets across different markets or exchanges. It simultaneously buys the asset where it is cheaper and sells it where it is more expensive, aiming to profit from the "spread" between the two prices.

### Usage

The primary way to use this module is to import a specific strategy, instantiate it with the required configuration, and then feed it market data within a trading loop. The trading engine receives a `TradeSignal` object from the strategy's `evaluate` method and can then act on it.

**Example 1: Initializing and Using a Strategy**

This example shows how a trading engine might initialize and use the `MomentumStrategy`.

```typescript
import { MomentumStrategy } from './strategy/momentum';
import { BaseStrategy } from './strategy/baseStrategy';
import { MarketData, TradeSignal, SignalType } from '../core/types';

// Configuration for our strategy instance
const momentumConfig = {
  symbol: 'BTC/USD',
  lookbackPeriod: 14,
  volumeThreshold: 1.5, // 50% above average
};

// The engine can hold any strategy that extends BaseStrategy
let activeStrategy: BaseStrategy = new MomentumStrategy(momentumConfig);

// Simulate receiving a market data tick
const currentMarketData: MarketData = {
  symbol: 'BTC/USD',
  timestamp: Date.now(),
  price: 50000,
  volume: 120,
  // ... other data like indicators
};

// The engine asks the strategy to evaluate the data
const signal: TradeSignal = activeStrategy.evaluate(currentMarketData);

// The engine acts on the returned signal
switch (signal.type) {
  case SignalType.BUY:
    console.log(`Executing BUY order: ${signal.reason}`);
    // executeBuyOrder(signal.price);
    break;
  case SignalType.SELL:
    console.log(`Executing SELL order: ${signal.reason}`);
    // executeSellOrder(signal.price);
    break;
  case SignalType.HOLD:
    console.log(`No action taken: ${signal.reason}`);
    break;
}
```

**Example 2: Polymorphism with Different Strategies**

This example demonstrates how the `BaseStrategy` abstraction allows the system to handle different strategies interchangeably.

```typescript
import { BaseStrategy } from './strategy/baseStrategy';
import { MomentumStrategy } from './strategy/momentum';
import { SpreadArbitrageStrategy } from './strategy/spreadArb';
import { MarketData, TradeSignal } from '../core/types';

function initializeStrategy(strategyType: 'momentum' | 'arbitrage'): BaseStrategy {
  if (strategyType === 'momentum') {
    return new MomentumStrategy({ symbol: 'ETH/USD', lookbackPeriod: 20 });
  } else {
    return new SpreadArbitrageStrategy({
      symbolA: 'BTC/USD_EXCHANGE_A',
      symbolB: 'BTC/USD_EXCHANGE_B',
      spreadThreshold: 50.0, // $50 difference
    });
  }
}

// Initialize a strategy without needing to know the concrete type
const strategy: BaseStrategy = initializeStrategy('arbitrage');

// The rest of the logic remains the same, regardless of the strategy
const marketData: MarketData = { /* ... */ };
const signal: TradeSignal = strategy.evaluate(marketData);
console.log(`Received signal: ${signal.type}`);
```

### API Reference

#### Class: `BaseStrategy`

The abstract base class for all strategies.

*   **`constructor(config: StrategyConfig)`**
    Initializes the strategy with its specific configuration.
    *   `config`: `object` - A configuration object containing parameters like symbol, lookback periods, or thresholds.

*   **`abstract evaluate(data: MarketData): TradeSignal`**
    The core method of the strategy. It analyzes the provided market data and returns a trading decision.
    *   `data`: `MarketData` - An object containing the latest market information (price, volume, indicators, etc.).
    *   **Returns**: `TradeSignal` - An object indicating the action to take (`BUY`, `SELL`, or `HOLD`), along with a reason.

*   **`abstract canTrade(): boolean`**
    A method to check if the strategy is in a state where it is ready to trade (e.g., has enough historical data, is not in a cooldown period).
    *   **Returns**: `boolean` - `true` if the strategy is ready to evaluate data and produce signals, otherwise `false`.

#### Class: `MomentumStrategy`

A concrete strategy that implements `BaseStrategy`.

*   **`constructor(config: MomentumStrategyConfig)`**
    *   `config`: `MomentumStrategyConfig` - An object containing parameters specific to this strategy, such as `symbol`, `lookbackPeriod`, and `volumeThreshold`.

*   **`evaluate(data: MarketData): TradeSignal`**
    Implements the momentum logic. Analyzes price change and volume over the `lookbackPeriod` to generate `BUY` or `SELL` signals.

#### Class: `SpreadArbitrageStrategy`

A concrete strategy that implements `BaseStrategy`.

*   **`constructor(config: SpreadArbitrageStrategyConfig)`**
    *   `config`: `SpreadArbitrageStrategyConfig` - An object containing parameters like `symbolA`, `symbolB`, and `spreadThreshold`.

*   **`evaluate(data: MarketData): TradeSignal`**
    Implements the arbitrage logic. Requires market data for two assets/exchanges. Generates signals when the price spread exceeds the configured `spreadThreshold`.

### Dependencies

*   **`src/core/types` (or similar)**: This module depends on shared type definitions for core concepts like `MarketData`, `TradeSignal`, `SignalType`, and various configuration interfaces (`StrategyConfig`). This ensures type safety and consistency across the application.
*   **Technical Indicator Libraries (potential)**: Concrete strategies like `MomentumStrategy` may depend on utility modules or libraries for calculating technical indicators (e.g., Moving Averages, RSI) from raw market data.

