# src.api

Of course. Here is the comprehensive documentation for the `src.api` module, built from the provided analysis.

***

## src.api

### Overview

This module serves as the primary gateway for all interactions with the external Polymarket service. It encapsulates the complexities of both REST API communication for actions like trading and data fetching, and WebSocket connections for real-time orderbook updates. By providing a clean, high-level interface, it isolates the rest of the application from the specific implementation details of the Polymarket API.

### Key Components

*   **`PolymarketAPI` (`src/api/polymarket.ts`)**
    This is the main public-facing class and the primary entry point for the module. It orchestrates all communication with Polymarket's REST API, providing methods for fetching market data, managing user positions, and executing trades. It also internally manages an instance of `PolymarketWebSocket` to provide a unified interface for both request-response and real-time data streams.

*   **`PolymarketWebSocket` (`src/api/websocket.ts`)**
    A specialized class responsible for establishing and maintaining a persistent WebSocket connection. Its core functions are to handle subscription requests for market orderbooks, listen for incoming messages, and parse the raw data into structured, usable formats. While it can be used directly, it is typically managed by the `PolymarketAPI` class.

### Usage

To use the module, you instantiate the `PolymarketAPI` class with the necessary configuration. You can then call its methods to fetch data or place orders, and listen for events to receive real-time updates from the WebSocket stream.

```typescript
import { PolymarketAPI } from './api/polymarket';
import { Orderbook } from '../types'; // Assuming a type definition for the orderbook

// 1. Define configuration for the API client
const config = {
  apiUrl: 'https://strapiv2.polymarket.com/api',
  wsUrl: 'wss://strapiv2.polymarket.com/socket.io/?EIO=4&transport=websocket',
  // A signer object from a library like ethers.js is required for authenticated actions
  signer: getEthersSigner(), 
};

async function main() {
  // 2. Instantiate the main API client
  const api = new PolymarketAPI(config);

  // 3. Listen for real-time orderbook updates
  api.on('orderbookUpdate', (data: { marketId: string; orderbook: Orderbook }) => {
    console.log(`Received update for market ${data.marketId}:`);
    console.log('Bids:', data.orderbook.bids.slice(0, 2)); // Log top 2 bids
    console.log('Asks:', data.orderbook.asks.slice(0, 2)); // Log top 2 asks
  });

  api.on('connect', () => {
    console.log('WebSocket connected successfully.');
    // 4. Subscribe to a market's orderbook once connected
    // Example market: "Will the Fed raise interest rates in their next meeting?"
    const marketId = '0x5a34...'; 
    api.subscribeToMarketOrderbook(marketId);
    console.log(`Subscribed to orderbook for market: ${marketId}`);
  });
  
  api.on('disconnect', () => {
    console.log('WebSocket disconnected.');
  });

  try {
    // 5. Fetch static data using a REST API method
    console.log('Fetching active markets...');
    const markets = await api.getMarkets({ active: true });
    console.log(`Found ${markets.length} active markets.`);

    // 6. Example of placing an order (requires authentication via signer)
    // const orderReceipt = await api.placeOrder({
    //   marketId: '0x5a34...',
    //   side: 'BUY',
    //   price: 0.65, // Price per share (e.g., 65 cents)
    //   size: 100,   // Number of shares
    // });
    // console.log('Order placed successfully:', orderReceipt);

  } catch (error) {
    console.error('An API error occurred:', error);
  }
}

main();
```

### API Reference

#### `class PolymarketAPI`

The primary class for interacting with the Polymarket API.

**`new PolymarketAPI(config)`**

Creates a new instance of the Polymarket API client.

*   **Parameters:**
    *   `config` (`object`): Configuration object.
        *   `apiUrl` (`string`): The base URL for the Polymarket REST API.
        *   `wsUrl` (`string`): The URL for the Polymarket WebSocket server.
        *   

