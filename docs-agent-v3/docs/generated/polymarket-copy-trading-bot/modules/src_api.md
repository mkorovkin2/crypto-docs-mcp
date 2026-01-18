# src.api

Of course. Here is the comprehensive documentation for the `src.api` module.

---

## src.api

### Overview

This module serves as the primary gateway for all communication with the external Polymarket service. It provides a clean, high-level abstraction layer that encapsulates the complexities of both REST API requests and real-time WebSocket communication. By isolating network logic and data translation, this module ensures that the rest of the application has a stable and consistent interface for interacting with Polymarket, even if the underlying external API changes.

### Key Components

*   **`PolymarketAPI` (`polymarket.ts`)**: A client class for handling request-response interactions with the Polymarket REST API. It is responsible for stateful, user-initiated actions such as fetching market data, retrieving account information, and placing or canceling orders. All order-related requests are cryptographically signed using a provided private key.

*   **`PolymarketWebSocket` (`websocket.ts`)**: A manager class for establishing and maintaining a persistent WebSocket connection. Its primary role is to handle subscriptions to real-time orderbook data for specific markets, process incoming data streams, and propagate these updates to the application via callbacks.

### Usage

The `PolymarketAPI` and `PolymarketWebSocket` classes are designed to be used together to build a complete trading or monitoring application. The API client is used for initial data fetching and for executing trades, while the WebSocket client provides the real-time data needed to make informed decisions.

#### Example 1: Fetching Market Data and Placing an Order

This example demonstrates how to instantiate the `PolymarketAPI` client, fetch details for a specific market, and then place a new order.

```typescript
import { PolymarketAPI } from './api/polymarket';
import { ethers } from 'ethers'; // For wallet management

// --- Configuration ---
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("PRIVATE_KEY environment variable not set.");
}
const wallet = new ethers.Wallet(privateKey);

const api = new PolymarketAPI({
  signer: wallet,
  // Other config options like baseURL can be added here
});

const marketId = "0x9a8f...market-slug"; // Example market ID

async function executeTrade() {
  try {
    // 1. Fetch market details
    console.log(`Fetching details for market: ${marketId}`);
    const market = await api.getMarket(marketId);
    console.log(`Market Title: ${market.question}`);

    // 2. Place a "YES" order
    console.log("Placing a 'YES' order for 10 shares at $0.50...");
    const orderResult = await api.placeOrder({
      marketId: marketId,
      side: 'buy', // 'buy' or 'sell'
      price: 0.50, // Price per share ($0.01 - $0.99)
      size: 10,    // Number of shares
    });

    console.log("Order placed successfully!", { orderId: orderResult.orderId });

  } catch (error) {
    console.error("Failed to execute trade:", error);
  }
}

executeTrade();
```

#### Example 2: Subscribing to Real-Time Orderbook Updates

This example shows how to connect to the WebSocket, subscribe to a market's orderbook, and process live updates.

```typescript
import { PolymarketWebSocket } from './api/websocket';

const wsClient = new PolymarketWebSocket({
  url: "wss://api.polymarket.com/ws" // Example WebSocket URL
});

const marketId = "0x9a8f...market-slug";

// Define a callback to handle incoming orderbook data
const handleOrderbookUpdate = (update) => {
  console.log(`Received update for market ${update.marketId}:`);
  console.log("Bids:", update.bids.slice(0, 3)); // Log top 3 bids
  console.log("Asks:", update.asks.slice(0, 3)); // Log top 3 asks
  console.log("---");
};

async function startStreaming() {
  try {
    // 1. Establish the WebSocket connection
    await wsClient.connect();
    console.log("WebSocket connected successfully.");

    // 2. Subscribe to the market's orderbook
    wsClient.subscribeToMarket(marketId, handleOrderbookUpdate);
    console.log(`Subscribed to orderbook updates for market: ${marketId}`);

  } catch (error) {
    console.error("WebSocket connection failed:", error);
  }
}

startStreaming();

// To stop receiving updates later
// setTimeout(() => {
//   console.log("Unsubscribing and disconnecting...");
//   wsClient.unsubscribeFromMarket(marketId);
//   wsClient.disconnect();
// }, 60000); // Disconnect after 1 minute
```

### API Reference

#### class `PolymarketAPI`

Handles all REST API interactions.

##### `constructor(config: APIConfig)`

Creates a new instance of the API client.

*   `config`: `APIConfig` - Configuration object.
    *   `signer`: `ethers.Signer` - An ethers.js Signer instance (e.g., `Wallet`) used to sign order-related messages. **Required**.
    *   `baseURL?`: `string` - The base URL for the Polymarket REST API. Defaults to the production URL.

##### `async getMarket(marketId: string): Promise<Market>`

Retrieves detailed information for a single market.

*   `marketId`: `string` - The unique identifier of the market.
*   **Returns**: A `Promise` that resolves to a `Market` object containing details like the question, conditions, and current state.

##### `async placeOrder(params: PlaceOrderParams): Promise<OrderResult>`

Submits a new signed order to a market's orderbook.

*   `params`: `PlaceOrderParams` - An object containing order details.
    *   `marketId`: `string` - The identifier of the market to trade on.
    *   `side`: `'buy' | 'sell'` - The side of the order.
    *   `price`: `number` - The price per share (e.g., `0.65` for $0.65).
    *   `size`: `number` - The number of shares to buy or sell.


