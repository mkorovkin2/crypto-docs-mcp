# src

Here is the comprehensive documentation for the `src` module.

## src

### Overview

The `src` module contains the complete source code for the Polymarket Trading Bot. It serves as a self-contained, event-driven application designed to execute automated trading strategies on Polymarket prediction markets. The module orchestrates the entire trading lifecycle, from market data ingestion and opportunity analysis to trade execution, position management, and rigorous risk control.

### Key Components

The module is architected around a separation of concerns, with distinct components managing different aspects of the trading process.

*   **`PolymarketTradingBot` (`src/index.ts`)**: The central orchestrator and application entry point. This class is responsible for initializing all other components (managers, API clients, strategies), wiring them together, and running the main trading loop that listens for market events and triggers trading decisions.

*   **Trader Sub-module (`src/trader/`)**: This sub-module contains the core logic for managing trading operations.
    *   **`OrderManager`**: Manages the full lifecycle of orders. It handles placing new orders via the Polymarket API, tracking their fulfillment status, updating them as market conditions change, and processing cancellations.
    *   **`PositionManager`**: Acts as the portfolio tracker. It maintains an up-to-date record of all current positions, syncs their state with the Polymarket API, and calculates profit/loss and overall portfolio value.
    *   **`RiskManager`**: A critical safety component that acts as a gatekeeper for all trading signals. It evaluates every potential trade against a predefined set of rules, such as maximum position size, total capital allocation, and daily loss limits, to prevent catastrophic errors.

*   **API Sub-module (`src/api/`)**: This sub-module encapsulates all communication with external Polymarket services.
    *   **`PolymarketWebSocket`**: Manages the real-time data feed. It establishes and maintains a persistent WebSocket connection, subscribes to order book updates for specific markets, and parses incoming data for use by the trading strategies.

*   **Configuration (`src/config/env.ts`)**: Provides strongly-typed and validated configuration for the entire application. It loads environment variables, parses them into the correct types (numbers, booleans, decimals), and validates them against a schema to ensure the bot starts in a valid state.

*   **Utilities (`src/utils/`)**: A collection of shared helper modules.
    *   **`MathUtils`**: A utility class offering static methods for high-precision mathematical calculations required in financial contexts, such as calculating slippage, fees, and expected value.
    *   **`logger`**: A centralized logging utility for structured, leveled logging across the application, crucial for diagnostics and monitoring.

### Usage

The `src` module is designed to be run as a standalone application from the command line. It is not intended to be used as a library.

#### 1. Configuration

Before running the bot, you must configure it using environment variables. Create a `.env` file in the root of the project with the necessary parameters.

**.env Example:**

```sh
# Wallet & Provider Configuration
PRIVATE_KEY="0x..."
RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/your-api-key"

# Trading Parameters
MARKET_SLUGS='["us-president-2024", "fed-funds-rate-q4-2024"]' # JSON array of market slugs to trade
MAX_TOTAL_POSITION_VALUE=500.00 # Max total value of all positions in USDC
MAX_TRADE_SIZE_USDC=50.00       # Max size for a single trade in USDC
MIN_PROBABILITY_THRESHOLD=0.15  # Don't trade outcomes with probability < 15%
MAX_PROBABILITY_THRESHOLD=0.85  # Don't trade outcomes with probability > 85%

# Risk Management
DAILY_LOSS_LIMIT_PERCENT=5.0 # Stop trading if portfolio is down 5% for the day

# System Settings
DRY_RUN=true # If true, simulates trades without executing them on-chain
LOG_LEVEL="info"
```

#### 2. Running the Bot

Once configured, you can start the application using Node.js.

```sh
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run the bot
npm start
```

This will execute the `main` function within `src/index.ts`, which initializes and starts the `PolymarketTradingBot`.

#### 3. Code Example: Bot Initialization (`src/index.ts`)

The following snippet from `src/index.ts` illustrates how the key components are instantiated and wired together to start the trading process.

```typescript
// src/index.ts

import { config } from './config/env';
import { PolymarketWebSocket } from './api/websocket';
import { OrderManager } from './trader/orderManager';
import { PositionManager } from './trader/positionManager';
import { RiskManager } from './trader/riskManager';
// Assuming a strategy class is defined elsewhere
import { SpreadArbitrageStrategy } from './strategies/spreadArbitrage';

export class PolymarketTradingBot {
    private readonly orderManager: OrderManager;
    private readonly positionManager: PositionManager;
    private readonly riskManager: RiskManager;
    private readonly websocket: PolymarketWebSocket;
    // ... other properties

    constructor() {
        // Initialize core components with validated config
        this.positionManager = new PositionManager();
        this.riskManager = new RiskManager(config, this.positionManager);
        this.orderManager = new OrderManager(config, this.riskManager);
        this.websocket = new PolymarketWebSocket(config);
        // ...
    }

    public async start(): Promise<void> {
        console.log('Starting Polymarket Trading Bot...');
        
        // 1. Sync initial portfolio state
        await this.positionManager.syncPositions();

        // 2. Initialize and run the trading strategy
        const strategy = new SpreadArbitrageStrategy(this.orderManager);

        // 3. Connect to the WebSocket and subscribe to market data
        this.websocket.connect();
        config.MARKET_SLUGS.forEach(slug => this.websocket.subscribeToMarket(slug));

        // 4. Listen for orderbook updates and pass them to the strategy
        this.websocket.on('orderbookUpdate', (marketSlug, orderbook) => {
            const tradeSignals = strategy.generateSignals(marketSlug, orderbook);
            tradeSignals.forEach(signal => this.orderManager.placeOrder(signal));
        });

        console.log('Bot is running and listening for market events.');
    }
}

async function main() {
    const bot = new PolymarketTradingBot();
    await bot.start();
}

main().catch(error => {
    console.error('Bot encountered a fatal error:', error);
    process.exit(1);
});
```

### API Reference

Since `src` is an application module, it does not expose a public API for external consumption. Its primary interface is through the command-line execution and environment variable configuration.

#### `main()`
The main entry point for the application.

*   **File:** `src/index.ts`
*   **Description:** This asynchronous function instantiates the `PolymarketTradingBot` and calls its `start()` method

