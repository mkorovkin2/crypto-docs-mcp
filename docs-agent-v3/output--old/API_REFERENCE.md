# API Reference

Of course. Here is a detailed API reference section for the Polymarket-Copy-Trading-Bot, created from the provided list of key APIs. The documentation has been structured by module and includes inferred, realistic methods, parameters, and usage examples for each class to provide a comprehensive and practical reference.

***

# API Reference: Polymarket-Copy-Trading-Bot

This document provides a detailed reference for the core classes and modules within the Polymarket Copy Trading Bot. The APIs are grouped by their functional modules, such as API interaction, market analysis, trading strategy, and core trading logic.

## API (`src/api/`)

This module contains classes responsible for direct communication with the Polymarket platform, handling both RESTful API calls for actions and WebSocket connections for real-time data.

### class `PolymarketAPI`

Handles authenticated communication with the Polymarket REST API for actions like placing orders, fetching market data, and checking account balances.

**Constructor**

```typescript
new PolymarketAPI(privateKey: string, providerUrl?: string)
```

-   `privateKey` (string): The private key of the wallet used for signing transactions.
-   `providerUrl` (string, optional): The URL for the RPC provider (e.g., Infura, Alchemy).

**Key Methods**

-   `getMarket(marketId: string): Promise<MarketData>`
    -   Fetches detailed information for a specific market.
    -   **Parameters:**
        -   `marketId` (string): The unique identifier for the market.
    -   **Returns:** A `Promise` that resolves to a `MarketData` object.

-   `placeOrder(params: OrderParams): Promise<OrderReceipt>`
    -   Submits a new order to a market.
    -   **Parameters:**
        -   `params` (OrderParams): An object containing order details (`marketId`, `side`, `amount`, `price`).
    -   **Returns:** A `Promise` that resolves to an `OrderReceipt` confirming the transaction.

-   `getAccountBalance(): Promise<BalanceInfo>`
    -   Retrieves the USDC balance and other relevant account information.
    -   **Returns:** A `Promise` that resolves to a `BalanceInfo` object.

**Usage Example**

```typescript
import { PolymarketAPI } from './src/api/polymarket';

const api = new PolymarketAPI('0xYourPrivateKey...');

async function executeTrade() {
  try {
    const orderReceipt = await api.placeOrder({
      marketId: '0x123...',
      side: 'BUY',
      amount: 100, // 100 shares
      price: 0.50  // at 50 cents
    });
    console.log('Order placed successfully:', orderReceipt.transactionHash);
  } catch (error) {
    console.error('Failed to place order:', error);
  }
}

executeTrade();
```

---

### class `PolymarketWebSocket`

Manages a persistent WebSocket connection to Polymarket for receiving real-time data streams, such as order book updates and trade executions.

**Constructor**

```typescript
new PolymarketWebSocket(websocketUrl: string)
```

-   `websocketUrl` (string): The URL for the Polymarket WebSocket server.

**Key Methods**

-   `connect(): Promise<void>`
    -   Establishes a connection to the WebSocket server.
    -   **Returns:** A `Promise` that resolves when the connection is successfully established.

-   `subscribeToMarket(marketId: string, onUpdate: (data: MarketUpdate) => void): void`
    -   Subscribes to real-time updates for a specific market.
    -   **Parameters:**
        -   `marketId` (string): The market to subscribe to.
        -   `onUpdate` (function): A callback function that is invoked with new `MarketUpdate` data.

-   `disconnect(): void`
    -   Closes the WebSocket connection.

**Usage Example**

```typescript
import { PolymarketWebSocket } from './src/api/websocket';

const ws = new PolymarketWebSocket('wss://poly-ws.com');

ws.connect().then(() => {
  console.log('WebSocket connected.');
  
  ws.subscribeToMarket('0x123...', (update) => {
    console.log('Received market update:', update);
  });
});
```

## Market (`src/market/`)

This module includes tools for discovering markets and processing real-time market data, such as order books.

### class `MarketScanner`

Provides utilities to scan and filter Polymarket markets based on specified criteria like volume, liquidity, or age.

**Constructor**

```typescript
new MarketScanner(api: PolymarketAPI)
```

-   `api` (PolymarketAPI): An instance of `PolymarketAPI` to fetch market lists.

**Key Methods**

-   `findMarkets(criteria: MarketCriteria): Promise<MarketData[]>`
    -   Scans for markets that match the given criteria.
    -   **Parameters:**
        -   `criteria` (MarketCriteria): An object specifying filters like `{ minVolume24h?: number, maxAgeDays?: number, isActive?: boolean }`.
    -   **Returns:** A `Promise` that resolves to an array of `MarketData` objects.

**Usage Example**

```typescript
const api = new PolymarketAPI('0xYourPrivateKey...');
const scanner = new MarketScanner(api);

async function findHotMarkets() {
  const hotMarkets = await scanner.findMarkets({
    minVolume24h: 50000, // Minimum $50k 24h volume
    isActive: true
  });
  console.log(`Found ${hotMarkets.length} active markets with >$50k volume.`);
}

findHotMarkets();
```

---

### class `OrderbookEngine`

Maintains a local, real-time

