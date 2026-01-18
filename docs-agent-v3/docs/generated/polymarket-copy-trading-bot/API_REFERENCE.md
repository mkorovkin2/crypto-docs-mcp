# API Reference

Of course. Here is a detailed API reference for the Polymarket-Copy-Trading-Bot, created from an analysis of the provided components.

# Polymarket-Copy-Trading-Bot API Reference

This document provides a detailed reference for the key classes and modules within the Polymarket Copy Trading Bot. The APIs are grouped by their functional modules: API, Market, Strategy, Trader, and Utils.

---

## 1. API Module (`src/api/`)

This module contains classes responsible for direct communication with the Polymarket platform, handling both RESTful API requests and real-time WebSocket connections.

### Class: `PolymarketAPI`

Handles authenticated REST API requests to Polymarket for actions like fetching market data, retrieving user balances, and placing orders.

**Constructor**

```typescript
new PolymarketAPI(config: { apiKey: string; apiSecret: string; })
```

*   **`config`**: `object` - Configuration object containing API credentials.
    *   `apiKey`: `string` - Your Polymarket API key.
    *   `apiSecret`: `string` - Your Polymarket API secret.

**Key Methods**

*   **`getMarket(marketId: string): Promise<Market>`**
    *   Fetches detailed information for a specific market.
    *   **Parameters**:
        *   `marketId`: `string` - The unique identifier for the market.
    *   **Returns**: `Promise<Market>` - A promise that resolves to an object containing market details.

*   **`placeOrder(params: OrderParams): Promise<OrderResult>`**
    *   Submits a new order to a market.
    *   **Parameters**:
        *   `params`: `OrderParams` - An object defining the order.
            *   `marketId`: `string` - The market to place the order in.
            *   `side`: `'BUY' | 'SELL'` - The order side.
            *   `size`: `number` - The quantity of shares to trade.
            *   `price`: `number` - The limit price for the order (from 0.01 to 0.99).
    *   **Returns**: `Promise<OrderResult>` - A promise that resolves with the result of the order placement, including an order ID.

**Usage Example**

```typescript
import { PolymarketAPI } from './src/api/polymarket';

const api = new PolymarketAPI({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET'
});

async function executeTrade() {
  try {
    const orderDetails = {
      marketId: '0x123...',
      side: 'BUY',
      size: 100,
      price: 0.55
    };
    const result = await api.placeOrder(orderDetails);
    console.log('Order placed successfully:', result.orderId);
  } catch (error) {
    console.error('Failed to place order:', error);
  }
}

executeTrade();
```

### Class: `PolymarketWebSocket`

Manages a persistent WebSocket connection to Polymarket for receiving real-time data streams, such as order book updates and trade executions.

**Constructor**

```typescript
new PolymarketWebSocket()
```

**Key Methods**

*   **`connect(): Promise<void>`**
    *   Establishes a connection to the Polymarket WebSocket server.
    *   **Returns**: `Promise<void>` - A promise that resolves when the connection is successfully established.

*   **`subscribeToMarket(marketId: string): void`**
    *   Subscribes to real-time updates for a specific market.
    *   **Parameters**:
        *   `marketId`: `string` - The unique identifier for the market to subscribe to.

*   **`on(event: 'update' | 'trade' | 'error', callback: (data: any) => void): void`**
    *   Registers a callback function for a specific event type.
    *   **Parameters**:
        *   `event`: `'update' | 'trade' | 'error'` - The name of the event to listen for.
        *   `callback`: `(data: any) => void` - The function to execute when the event is emitted. The `data` payload will vary based on the event.

**Usage Example**

```typescript
import { PolymarketWebSocket } from './src/api/websocket';

const ws = new PolymarketWebSocket();

async function listenToMarket() {
  await ws.connect();
  console.log('WebSocket connected.');

  const marketId = '0x123...';
  ws.subscribeToMarket(marketId);

  ws.on('update', (orderbookUpdate) => {
    console.log('Received order book update:', orderbookUpdate);
  });

  ws.on('trade', (tradeExecution) => {
    console.log('New trade executed:', tradeExecution);
  });
}

listenToMarket();
```

---

## 2. Market Module (`src/market/`)

This module is responsible for processing and analyzing market data.

### Class: `MarketScanner`

Scans for markets on Polymarket that meet specific criteria, such as volume, liquidity, or volatility, to identify potential trading opportunities.

**Constructor**

```typescript
new MarketScanner(api: PolymarketAPI)
```

*   **`api`**: `PolymarketAPI` - An instance of `PolymarketAPI` to fetch market data.

**Key Methods**

*   **`findActiveMarkets(criteria: { minVolume24h?: number; minLiquidity?: number }): Promise<Market[]>`**
    *   Scans all available markets and filters them based on the provided criteria.
    *   **Parameters**:
        *   `criteria`: `object` - An object specifying the filtering conditions.
            *   `minVolume24h`: `number` (optional) - The minimum trading volume in the last 24 hours.
            *   `minLiquidity`: `number` (optional) - The minimum available liquidity in the order book.
    *   **Returns**: `Promise<Market[]>` - A promise that resolves to an array of markets matching the criteria.

**Usage Example**

```typescript
import { MarketScanner } from './src/market/marketScanner';
import { PolymarketAPI } from './src/api/polymarket';

const api = new PolymarketAPI({ /* ... */ });
const scanner = new MarketScanner(api);

async function findOpportunities() {
  const criteria = {
    minVolume24h: 50000, // $50,000 in 24h volume
    minLiquidity: 1000   // $1,000 in liquidity
  };
  const activeMarkets = await scanner.findActiveMarkets(criteria);
  console.log(`Found ${activeMarkets.length} active markets.`);
}

findOpportunities();
```

### Class: `OrderbookEngine`

Maintains and provides access to the real-time state of a market's order book. It processes updates from the `PolymarketWebSocket`.

**Constructor**

```typescript
new OrderbookEngine(marketId: string, websocket: PolymarketWebSocket)
```

*   **`marketId`**: `string` - The market ID for which to maintain the order book.
*   **`websocket`**: `PolymarketWebSocket` - The WebSocket instance to receive updates from.

**Key Methods**

*   **`getOrderbook(): { bids: [number, number][], asks: [number, number][] }`**
    *   Returns the current state of the order book.
    *   **Returns**: `object` - An object containing arrays of bids and asks, where each entry is a `[price, size]` tuple.

*   **`getBestBid(): { price: number; size: number } | null`**
    *   Returns the highest-priced bid in the order book.
    *   **Returns**: `object | null` - An object with the best bid's price and size, or `null` if no bids exist.

*   **`getBestAsk(): { price: number; size: number } | null`**
    *   Returns the lowest-priced ask in the order book.
    *   **Returns**: `object | null` - An object with the best ask's price and size, or `null` if no asks exist.

**Usage Example**

```typescript
import { OrderbookEngine } from './src/market/orderbook';
import { PolymarketWebSocket } from './src/api/websocket';

const marketId = '0x123...';
const ws = new PolymarketWebSocket();
await ws.connect();
ws.subscribeToMarket(marketId);

const orderbook = new OrderbookEngine(marketId, ws);

// The engine listens to websocket updates internally.
// We can poll for the latest data.
setInterval(() => {
  const bestBid = orderbook.getBestBid();
  const bestAsk = orderbook.getBestAsk();
  if (bestBid && bestAsk) {
    console.log(`Spread: ${bestAsk.price - bestBid.price}`);
  }
}, 1000);
```

---

## 3. Strategy Module (`src/strategy/`)

This module contains the trading logic. Strategies analyze market data to generate buy or sell signals.

### Class: `MomentumStrategy`

A strategy that generates trading signals based on price momentum and volume indicators.

**Constructor**

```typescript
new MomentumStrategy(config: { lookbackPeriod: number; volumeThreshold: number; })
```

*   **`config`**: `object` - Configuration for the strategy.
    *   `lookbackPeriod`: `number` - The number of data points (e.g., trades or minutes) to consider for calculating momentum.
    *   `volumeThreshold`: `number` - The minimum volume required to validate a momentum signal.

**Key Methods**

*   **`generateSignal(marketData: MarketData): TradingSignal | null`**
    *   Analyzes historical and real-time market data to generate a trading signal.
    *   **Parameters**:
        *   `marketData`: `MarketData` - An object containing recent trades, price changes, and volume for a market.
    *   **Returns**: `TradingSignal | null` - A signal object (`{ side: 'BUY' | 'SELL', confidence: number }`) if a trading opportunity is found, otherwise `null`.

**Usage Example**

```typescript
import { MomentumStrategy } from './src/strategy/momentum';

const strategy = new MomentumStrategy({
  lookbackPeriod: 50, // 50 recent trades
  volumeThreshold: 1000
});

// Assume `marketData` is populated from a data feed
const marketData = { /* ... recent trades, volume, etc. ... */ };
const signal = strategy.generateSignal(marketData);

if (signal) {
  console.log(`Generated Signal: ${signal.side} with confidence ${signal.confidence}`);
  // Pass this signal to the OrderManager
}
```

### Class: `SpreadArbitrageStrategy`

A strategy that identifies and capitalizes on price discrepancies (spreads) between a market's "Yes" and "No" outcomes or between related markets.

**Constructor**

```typescript
new SpreadArbitrageStrategy(config: { minProfitMargin: number; })
```

*   **`config`**: `object` - Configuration for the strategy.
    *   `minProfitMargin`: `number` - The minimum required profit margin (e.g., `0.02` for 2%) to trigger an arbitrage trade.

**Key Methods**

*   **`findArbitrageOpportunity(yesOrderbook: Orderbook, noOrderbook: Orderbook): ArbitrageSignal | null`**
    *   Analyzes the order books of a market's two outcomes to find a risk-free arbitrage opportunity.
    *   **Parameters**:

