# src

Here is the comprehensive documentation for the `src` module.

---

## src

### Overview

The `src` module is the core application logic for the Polymarket Trading Bot. It provides a complete, event-driven framework for automated trading on Polymarket prediction markets. The module integrates real-time market data acquisition via WebSockets, strategic decision-making, robust risk and position management, and trade execution, orchestrating these components into a cohesive and autonomous system.

### Key Components

The module is designed with a clear separation of concerns, with each major class handling a distinct aspect of the trading lifecycle.

*   **`PolymarketTradingBot` (`src/index.ts`)**: The central orchestrator and main class of the application. It is responsible for initializing, connecting, and managing all other components. Its `start()` method kicks off the bot's entire operation, listening for market events and triggering trading logic.

*   **`PolymarketWebSocket` (`src/api/websocket.ts`)**: Manages the real-time data connection to Polymarket. It establishes the WebSocket connection, handles subscriptions to specific market order books, and emits standardized events for order book updates, which serve as the primary trigger for the bot's trading logic.

*   **`RiskManager` (`src/trader/riskManager.ts`)**: A critical safety component that acts as a gatekeeper for all trading activity. It enforces pre-configured risk parameters, such as maximum trade size, maximum exposure per market, and daily profit/loss limits. No trade can be executed without its approval.

*   **`OrderManager` (`src/trader/orderManager.ts`)**: Responsible for the entire lifecycle of a trade order. It receives trade signals, validates them against the `RiskManager`, constructs the order payload, submits it to the Polymarket API, and tracks its status until it is filled or fails.

*   **`PositionManager` (`src/trader/positionManager.ts`)**: Maintains an in-memory state of all open positions across all markets. It tracks the entry price, size, and current unrealized profit or loss (P&L) for each position, providing a real-time view of the bot's portfolio.

*   **`config` (`src/config/env.ts`)**: A singleton object that provides strongly-typed access to all application settings. It loads configuration from environment variables, validates them against a predefined schema, and makes them available throughout the application.

*   **`MathUtils` (`src/utils/math.ts`)**: A utility class providing static methods for high-precision mathematical calculations. It uses the `decimal.js` library to avoid floating-point inaccuracies common in financial applications, especially when dealing with prices and probabilities.

### Usage

The bot is designed to be run as a standalone process from the command line. Its behavior is controlled entirely through environment variables.

#### 1. Configuration

First, create a `.env` file in the root of the project with the necessary configuration.

**.env Example:**
```env
# Wallet private key for signing transactions
PRIVATE_KEY="0x..."

# Polymarket authentication token (obtained from browser session)
POLY_AUTH_TOKEN="ey..."

# Comma-separated list of market slugs to trade
MARKET_SLUGS="us-president-2024,will-the-fed-hike-rates-in-q3"

# --- Risk Management ---
# Maximum size of a single trade in USD
MAX_TRADE_SIZE_USD=25.00

# Maximum total exposure (invested capital) in USD across all positions
MAX_TOTAL_EXPOSURE_USD=500.00

# Stop the bot if daily losses exceed this USD amount
DAILY_LOSS_LIMIT_USD=50.00

# --- Execution ---
# Maximum acceptable price slippage (e.g., 0.01 = 1%)
SLIPPAGE_TOLERANCE=0.01
```

#### 2. Running the Bot

The application is started through its main entry point, `src/index.ts`. The `main` function handles the setup and execution.

**src/index.ts:**
```typescript
import { config } from './config/env';
import { logger } from './utils/logger';
// ... other imports

/**
 * The main application class that orchestrates all trading components.
 */
export class PolymarketTradingBot {
  // ... implementation details
  
  public async start(): Promise<void> {
    logger.info('Starting Polymarket Trading Bot...');
    // 1. Initialize managers (Risk, Position, Order)
    // 2. Connect to the Polymarket WebSocket
    // 3. Subscribe to markets defined in config.MARKET_SLUGS
    // 4. Start listening to order book events and apply trading strategy
    logger.info('Bot is now running and listening for market events.');
  }
}

/**
 * Application entry point.
 */
async function main() {
  try {
    // The config object is validated on import. If it fails, an error is thrown.
    logger.info('Configuration loaded and validated successfully.');
    
    const bot = new PolymarketTradingBot(config);
    await bot.start();
    
  } catch (error) {
    logger.error('Fatal error during bot initialization or execution:', error);
    process.exit(1);
  }
}

// Execute the main function
main();
```

To run the compiled JavaScript:
```bash
node dist/index.js
```

### API Reference

The module's public-facing API is minimal, consisting of the main class and the entry-point function.

#### Class: `PolymarketTradingBot`

The primary class that encapsulates the bot's functionality.

**`constructor(config)`**

Creates a new instance of the trading bot.

*   **Parameters:**
    *   `config` (`ValidatedConfig`): The validated configuration object imported from `src/config/env.ts`. This object contains all the necessary settings for the bot to operate.

**`async start(): Promise<void>`**

Initializes all components and starts the bot's main operational loop. This is the primary method to activate the bot.

*   **Description:** This method performs the following actions:
    1.  Instantiates `RiskManager`, `PositionManager`, and `OrderManager`.
    2.  Initializes the `PolymarketWebSocket` client and connects to the server.
    3.  Subscribes to the order book feeds for the markets specified in `config.MARKET_SLUGS`.
    4.  Sets up event listeners to process incoming market data and trigger the core trading strategy.
*   **Returns:** `Promise<void>` - A promise that resolves when the bot has successfully started, though the process will continue to run indefinitely.

#### Function: `main()`

The main entry point for the application.

*   **Description:** This asynchronous function is responsible for bootstrapping the entire application. It loads and validates the configuration, instantiates the `PolymarketTradingBot`, and calls its `start()` method. It also includes top-level error handling to catch and log any fatal errors during startup or runtime.

### Dependencies

#### External (NPM Packages)

*   **`ethers

