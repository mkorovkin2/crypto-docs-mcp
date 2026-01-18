# Polymarket-Copy-Trading-Bot

### Overview

This repository implements a production-ready, algorithmic trading bot designed to execute automated strategies on Polymarket's prediction markets. It connects directly to Polymarket's Central Limit Order Book (CLOB) API and WebSocket for real-time data, enabling it to programmatically identify and capitalize on market inefficiencies on the Polygon blockchain.

The bot is engineered for quantitative traders and developers seeking a robust framework to deploy automated, low-latency strategies in the fast-paced environment of prediction markets. It solves the problem of manual trading limitations by providing a system for continuous market scanning, precise order execution, and disciplined risk management, allowing users to systematically exploit fleeting opportunities like price spreads and momentum shifts.

---

### Key Features

*   **Pluggable Algorithmic Strategy Engine:** Built with an extensible architecture centered around a `baseStrategy.ts` class, allowing developers to easily implement and deploy custom trading logic. The repository includes ready-to-use strategies for spread arbitrage (`spreadArb.ts`) and momentum trading (`momentum.ts`).
*   **Real-Time Market Integration:** Utilizes a dedicated WebSocket client (`src/api/websocket.ts`) for immediate order book updates and a custom REST API wrapper (`src/api/polymarket.ts`) for efficient order placement and market data retrieval, ensuring minimal latency from signal generation to execution.
*   **Integrated Risk Management Framework:** A dedicated `riskManager.ts` module provides critical safeguards by enforcing user-defined rules such as maximum position sizes, daily loss caps, and automated trading cooldowns, protecting capital from adverse market conditions.
*   **Automated Market Discovery:** The `marketScanner.ts` module actively discovers viable trading opportunities by continuously scanning all active Polymarket markets and filtering them based on configurable criteria like liquidity, trading volume, and time to resolution.
*   **High-Precision Financial Calculations:** Employs the `Decimal.js` library for all financial computations (`src/utils/math.ts`), eliminating floating-point inaccuracies and ensuring absolute precision in calculating spreads, position values, and profit/loss.

---

### Quick Facts

| | |
| :--- | :--- |
| **Primary Language** | TypeScript |
| **Runtime** | Node.js |
| **Total Files** | 17 |
| **Core Modules** | 7 (`api`, `config`, `market`, `strategy`, `trader`, `utils`) |
| **Key Libraries** | Decimal.js |
| **Architecture** | Modular Monolith, Layered, Event-Driven |

---

### Architectural Summary

The application is architected as a **modular monolith** with a distinctly layered separation of concerns. An infrastructure layer (`src/api`, `src/config`) manages external communication and configuration, a service layer (`src/market`) handles data analysis and market discovery, and a core domain layer (`src/strategy`, `src/trader`) contains the primary business logic for strategy execution and risk management. This entire event-driven workflow is orchestrated from the `src/index.ts` entry point, creating a highly responsive and maintainable single-process application.

### Notable Insights

*   **Algorithmic Focus, Not Copy Trading:** Despite the repository's name, the codebase is exclusively focused on executing self-contained algorithmic strategies. There is no implemented functionality for mirroring or copying the trades of other users, indicating a potential mismatch between the project's title and its actual purpose.
*   **Designed for Extensibility:** The use of a base strategy class, clear separation of modules (e.g., `api`, `trader`), and centralized configuration (`src/config/env.ts`) makes the system highly extensible. New strategies, API integrations, or risk rules can be added with minimal disruption to the core application.
*   **Production-Grade Components:** The architecture demonstrates a strong focus on production readiness. Features like the dedicated `riskManager.ts`, precision math with `Decimal.js`, and low-latency WebSocket integration are hallmarks of a system designed for reliable, real-world deployment.

## Table of Contents

- [Architecture](#architecture)
- [Modules](#modules)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Examples](#examples)

---

Of course. Based on the provided module-level analysis and repository structure, here is a comprehensive architectural analysis for the Polymarket-Copy-Trading-Bot.

---

### 1. System Architecture

The system implements a **Modular Monolith** architecture organized in a **Layered (or N-Tier)** pattern. This design is well-suited for a self-contained, real-time application like a trading bot.

*   **Monolithic Nature:** The entire application is designed to run as a single, cohesive process. The `src/index.ts` file serves as the central entry point, responsible for instantiating, configuring, and orchestrating all the components. This simplifies deployment and operational management, as there is only one service to run and monitor.

*   **Modular Design:** Despite being a monolith, the codebase is highly modular. Each module (e.g., `api`, `market`, `strategy`, `trader`) has a single, well-defined responsibility (high cohesion) and interacts with other modules through clear, explicit interfaces (loose coupling). This separation of concerns allows for independent development, testing, and maintenance of different parts of the system.

*   **Layered Pattern:** The modules are arranged into distinct logical layers, which enforce a unidirectional flow of data and dependencies, preventing circular references and creating a clear system structure.
    *   **Infrastructure Layer (`api`, `config`):** This layer is the bridge to the outside world. It handles external communication with the Polymarket WebSocket API and manages configuration loading from the environment.
    *   **Application/Service Layer (`market`):** This layer consumes raw data from the Infrastructure Layer and transforms it into valuable information for the business logic. It filters, scores, and prepares markets for strategic evaluation.
    *   **Domain/Business Logic Layer (`strategy`, `trader`):** This is the core of the application. The `strategy` module contains the decision-making intelligence ("when to trade"), while the `trader` module handles the execution mechanics and risk management ("how to trade").
    *   **Orchestration Layer (`src`):** The top-level `PolymarketTradingBot` class acts as the orchestrator, wiring all the layers and modules together to form the complete application.

### 2. Component Interaction Diagram

This diagram illustrates the primary flow of data and control between the major modules. Data flows upwards from the API, is processed, and triggers actions that flow back down to the API for execution.

```
       ┌──────────────────────────────────────────┐
       │           src (Orchestrator)             │
       │      (PolymarketTradingBot Class)        │
       └────┬─────────────────────────────┬───────┘
            │ wires up modules            │ .start()
            │                             │
┌───────────▼──────────┐      ┌───────────▼──────────┐
│   config             │      │   utils              │
│ (Loads ENV Vars)     │      │ (Math, Logging)      │
└──────────────────────┘      └──────────────────────┘
            ▲                             ▲
            │ .get()                      │ .calculate()
┌───────────┴─────────────────────────────┴───────┐
│                                                 │
│             ┌───────────────────────────┐       │
│             │  strategy (Decision Logic)│◀──────│ (Tradable Markets)
│             │ (e.g., Momentum, SpreadArb) │       │
│             └─────────────┬─────────────┘       │
│                           │ Trade Signal        │
│             ┌─────────────▼─────────────┐       │
│             │  trader (Execution & Risk)│       │
│             └─────────────┬─────────────┘       │
│                           │ Place Order         │
│             ┌─────────────▼─────────────┐       │
└────────────▶│  api (Polymarket Client)  │       │
              └─────────────┬─────────────┘       │
                            │                     │
                            │ Orderbook Updates   │
              ┌─────────────▼─────────────┐       │
              │  market (Analysis & Scoring)├───────┘
              └─────────────┬─────────────┘
                            │ Raw Data
              ┌─────────────▼─────────────┐
              │  api (WebSocket Listener) │
              └───────────────────────────┘
```

### 3. Component Descriptions

*   **`src` (Orchestrator):** The main entry point of the application. The `PolymarketTradingBot` class in this module is responsible for initializing all other modules, injecting dependencies (like configuration and API clients), and starting the bot's main operational loop.

*   **`src.config` (Configuration):** A foundational module that loads, validates, and provides strongly-typed access to all application settings from environment variables. This centralizes configuration, making the bot easy to deploy and reconfigure without code changes.

*   **`src.api` (API Client & WebSocket):** This module handles all communication with the external Polymarket platform. It manages the persistent WebSocket connection for receiving real-time order book data and provides methods for executing trades via the Polymarket API.

*   **`src.market` (Market Analyzer):** This service layer module consumes the raw data stream from the `api` module. Its primary purpose is to analyze all available markets, apply filtering and scoring logic (e.g., based on volume, liquidity, and volatility), and identify the most promising "tradable" markets for the strategies.

*   **`src.strategy` (Trading Strategies):** This module contains the core business logic for making trading decisions. It defines a `BaseStrategy` abstract class, ensuring all strategies have a common interface, and includes concrete implementations like `MomentumStrategy` or `SpreadArbStrategy` that generate trade signals based on market data.

*   **`src.trader` (Trade Execution & Risk Management):** This module acts as the gatekeeper for all trading activity. It receives trade signals from a `strategy`, validates them against pre-defined risk parameters (e.g., max position size, daily loss limit), tracks PnL

---

## Modules

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

---

Of course. Here is the comprehensive documentation for the `src.config` module.

---

## src.config

### Overview

The `src.config` module is the application's central authority for configuration management. It loads settings from environment variables, parses them into strongly-typed values (numbers, booleans, etc.), and validates their presence and correctness at startup. This ensures that the application has a reliable and type-safe configuration object, preventing runtime errors from missing or invalid environment variables.

### Key Components

*   **`config`** (constant): The primary export of the module. This is a frozen, validated object containing all application configuration settings. It serves as the single source of truth for the rest of the application.
*   **`getEnvVar(name: string, fallback?: string): string`**: An internal helper function to retrieve a string environment variable. It throws an error if the variable is not set and no fallback is provided.
*   **`getEnvNumber(name: string, fallback?: number): number`**: An internal helper to retrieve and parse an environment variable as an integer.
*   **`getEnvDecimal(name: string, fallback?: number): number`**: An internal helper to retrieve and parse an environment variable as a floating-point number.
*   **`getEnvBoolean(name: string, fallback?: boolean): boolean`**: An internal helper that parses an environment variable into a boolean. It typically interprets `"true"` as `true` and everything else as `false`.
*   **`validateConfig(config: object): void`**: A crucial internal function that runs at application startup. It takes the raw, parsed configuration object and validates it against a predefined schema, ensuring all required fields are present and correctly typed.

### Usage

The module is designed for simple consumption. Any part of the application that needs access to configuration settings can import the `config` object directly. The validation logic runs automatically when the module is first imported, guaranteeing that the application will fail fast if the environment is misconfigured.

**Example: Initializing a web server**
```typescript
// src/server.ts
import { config } from './config/env';
import { createApp } from './app';

const app = createApp();
const PORT = config.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Current environment: ${config.NODE_ENV}`);
});
```

**Example: Setting up a database connection**
```typescript
// src/database/connection.ts
import { Pool } from 'pg';
import { config } from '../config/env';

// The config object provides the validated, type-safe connection string.
const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export default pool;
```

### API Reference

The public API consists of a single exported constant.

#### `config`
A read-only object containing all parsed and validated application configuration variables.

**Type:** `Readonly<AppConfig>` (where `AppConfig` is an internal interface defining the configuration shape)

**Properties:**
The properties available on the `config` object are derived from the environment variables defined for the application. Common properties include:

| Property             | Type                                       | Description                                                              | Example Env Var         |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------ | ----------------------- |
| `NODE_ENV`           | `'development' \| 'production' \| 'test'`  | The runtime environment of the application.                              | `NODE_ENV=development`  |
| `PORT`               | `number`                                   | The port number on which the server should listen.                       | `PORT=8080`             |
| `DATABASE_URL`       | `string`                                   | The full connection string for the primary database.                     | `DATABASE_URL=...`      |
| `LOG_LEVEL`          | `string`                                   | The configured level for application logging (e.g., 'info', 'debug').    | `LOG_LEVEL=info`        |
| `ENABLE_FEATURE_X`   | `boolean`                                  | A feature flag, parsed as a boolean.                                     | `ENABLE_FEATURE_X=true` |

### Dependencies

*   **Node.js `process.env`**: The module directly reads from the global `process.env` object to source its configuration values.
*   **(Implied) `dotenv`**: While not explicitly listed, a module like this typically uses the `dotenv` library to load environment variables from a `.env` file during local development. This allows developers to manage configuration without setting system-level environment variables.

---

Of course. Here is the comprehensive documentation for the `src.trader` module, based on the provided analysis.

---

## src.trader

### Overview

The `src.trader` module is the operational core and execution engine of the trading system. It is responsible for translating abstract trading signals into concrete, risk-assessed orders on an exchange. It manages the entire lifecycle of a trade, from initial risk validation and state tracking to final execution, ensuring all actions adhere to predefined rules and limits.

### Key Components

The module's functionality is divided into three distinct, single-responsibility classes that work in concert:

*   **`RiskManager`**: Acts as the system's gatekeeper. Before any trade is attempted, the `RiskManager` evaluates it against a set of configurable rules, such as maximum daily loss, total capital exposure, and market-specific cooldown periods. It provides a simple pass/fail decision, preventing the system from taking on unacceptable risk.

*   **`PositionManager`**: Serves as the system's real-time ledger. It maintains an accurate, in-memory representation of all open positions, tracking key metrics like entry price, size, current market value, and unrealized profit/loss. It listens for fill events to keep its state synchronized with the market.

*   **`OrderManager`**: Functions as the execution arm. It receives trade signals, consults the `RiskManager` for approval, and then interacts with the exchange's API to place, monitor, and manage the lifecycle of orders. It emits events (`orderFill`, `orderCancelled`, etc.) to inform other parts of the system about the outcomes of its actions.

### Usage

The typical workflow involves instantiating all three managers and wiring them together. The `OrderManager` is the primary entry point for external strategy modules. It orchestrates the interaction between risk checks and position updates.

Here is a practical example of how to set up and use the module:

```typescript
import { RiskManager, RiskParameters } from './trader/riskManager';
import { PositionManager } from './trader/positionManager';
import { OrderManager } from './trader/orderManager';
import { PolymarketApi } from '../api/polymarketApi'; // Assuming an API client exists

// Define interfaces for clarity
interface TradeSignal {
    marketId: string;
    outcome: 'YES' | 'NO';
    direction: 'BUY' | 'SELL';
    size: number; // e.g., number of shares
    limitPrice: number; // The price at which to place the order
}

// 1. Configure and instantiate the Risk Manager
const riskParams: RiskParameters = {
    maxDailyLoss: -500, // Stop trading if P&L drops below -$500
    maxTotalExposure: 10000, // Max capital deployed at any time
    marketCooldownMs: 60 * 1000, // Wait 1 minute between trades in the same market
};
const riskManager = new RiskManager(riskParams);

// 2. Instantiate the Position Manager to track our holdings
const positionManager = new PositionManager();

// 3. Instantiate the API client and the Order Manager
// The OrderManager requires the RiskManager to make decisions.
const polymarketApi = new PolymarketApi({ privateKey: '...' });
const orderManager = new OrderManager(polymarketApi, riskManager);

// 4. Wire up event listeners
// The PositionManager needs to know when an order is filled to update its state.
orderManager.on('orderFill', (fill) => {
    console.log(`[EVENT] Order filled:`, fill);
    positionManager.updateFromFill(fill);
    
    // The RiskManager needs to be aware of realized P&L from closing trades.
    if (fill.realizedPnl !== 0) {
        riskManager.updatePnl(fill.realizedPnl);
    }
});

orderManager.on('orderError', (error) => {
    console.error(`[EVENT] Order failed:`, error);
});

// 5. A trading strategy module would generate a signal and send it for execution
const buySignal: TradeSignal = {
    marketId: '0x123...',
    outcome: 'YES',
    direction: 'BUY',
    size: 100,
    limitPrice: 0.65,
};

console.log('Executing trade signal...');
orderManager.executeSignal(buySignal);

// Later, you can query the PositionManager for the current state
const currentPosition = positionManager.getPosition(buySignal.marketId);
console.log('Current position:', currentPosition);
```

### API Reference

#### `class RiskManager`

Manages and enforces risk parameters.

##### `constructor(params: RiskParameters)`

*   `params`: An object containing risk rules.
    *   `maxDailyLoss: number`: The maximum negative P&L allowed for the day.
    *   `maxTotalExposure: number`: The maximum total value of all open positions.
    *   `marketCooldownMs: number`: The minimum time to wait between trades in the same market.

##### `checkTrade(signal: TradeSignal): { isApproved: boolean; reason: string; }`

Evaluates a proposed trade signal against all configured risk rules.

*   `signal`: The `TradeSignal` to be evaluated.
*   **Returns**: An object indicating if the trade is approved and a reason for rejection if applicable.

##### `

---

Of course. Here is the comprehensive documentation for the `src.utils` module, based on the provided analysis.

---

## `src.utils`

### Overview

The `src.utils` module provides foundational, cross-cutting utilities essential for the entire application. It encapsulates high-precision mathematical calculations for financial, statistical, and betting-related operations, ensuring accuracy and consistency. Additionally, it offers a standardized, pre-configured logging instance to maintain uniform log formatting and output across all services.

### Key Components

*   **`MathUtils`**
    A static utility class that serves as the central toolkit for all mathematical operations. It leverages a high-precision decimal library internally to prevent common floating-point inaccuracies, which is critical for financial and betting calculations. All methods are static, so no instantiation is required.

*   **`logger`**
    A pre-configured, singleton-like logger instance used for application-wide logging. It standardizes how log messages are formatted, leveled (e.g., `info`, `warn`, `error`), and directed, ensuring that all logs are consistent and easily parsable.

### Usage

This module is designed for straightforward integration into any part of the application that requires precise calculations or logging.

#### Example 1: Calculating a Bet Size and Logging the Outcome

This example demonstrates how to use `MathUtils` to calculate an optimal bet size using the Kelly Criterion and then use the `logger` to record the action.

```typescript
import { MathUtils } from './utils/math';
import { logger } from './utils/logger';

// --- Input Data ---
const bankroll = 1000; // $1000 starting bankroll
const winProbability = 0.60; // 60% perceived chance of winning
const americanOdds = -110; // Standard American odds

try {
  // 1. Convert American odds to a decimal format for calculation
  const decimalOdds = MathUtils.americanToDecimal(americanOdds);
  logger.info('Converted odds', { american: americanOdds, decimal: decimalOdds.toString() });

  // 2. Calculate the optimal fraction of the bankroll to bet
  const kellyFraction = MathUtils.calculateKellyCriterion(winProbability, decimalOdds);

  // 3. Calculate the actual bet size
  const betSize = MathUtils.toDecimal(bankroll).times(kellyFraction);

  logger.info(
    `Calculated optimal bet size`,
    {
      bankroll: bankroll,
      betSize: betSize.toFixed(2), // Format to 2 decimal places for currency
      kellyFraction: kellyFraction.toFixed(4)
    }
  );

} catch (error) {
  logger.error('Failed to calculate bet size', { error });
}
```

#### Example 2: Basic Logging

Demonstrates the usage of different log levels.

```typescript
import { logger } from './utils/logger';

logger.info('User authentication process started.', { userId: 'user-123' });

// Use warn for non-critical issues that should be monitored
logger.warn('API response time is high.', { latency: 3500, endpoint: '/api/data' });

// Use error for critical failures, passing the Error object for stack traces
const err = new Error('Database connection failed');
logger.error('A critical error occurred', { error: err });
```

### API Reference

#### Class: `MathUtils`

A static class providing methods for high-precision calculations.

**`static toDecimal(value: number | string): Decimal`**
Converts a number or string into a high-precision `Decimal` object. This is the primary way to begin a precise calculation chain.
*   **@param** `value` - The number or string to convert.
*   **@returns** A `Decimal` instance representing the value.

**`static americanToDecimal(americanOdds: number): Decimal`**
Converts standard American odds into decimal (European) odds.
*   **@param** `americanOdds` - The American odds value (e.g., -110, +150).
*   **@returns** A `Decimal` instance of the equivalent decimal odds.

**`static calculateKellyCriterion(probability: number, decimalOdds: Decimal): Decimal`**
Calculates the Kelly Criterion, which determines the optimal fraction of a bankroll to allocate to a particular bet with positive expected value.
*   **@param** `probability` - The probability of winning, expressed as a decimal (e.g., 0.6 for 60%).
*   **@param** `decimalOdds` - The decimal odds for the bet (e.g., 1.91).
*   **@returns** A `Decimal` representing the optimal fraction of the bankroll to wager. Returns 0 if there is no edge.

**`static calculateStandardDeviation(dataSet: number[]): Decimal`**
Calculates the standard deviation for a given set of numbers.
*   **@param** `dataSet` - An array of numbers.
*   **@returns** A `Decimal` instance representing the standard deviation of the data set.

---

#### Object: `logger`

A pre-configured logger instance with standard logging methods.

**`logger

---

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


---

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

---

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

---


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

---

Of course. Here is a practical Getting Started guide for the Polymarket-Copy-Trading-Bot, based on the provided repository summary.

***

## Getting Started

Welcome to the Polymarket-Copy-Trading-Bot! This guide will walk you through the necessary steps to set up, configure, and run your own automated trading bot on Polymarket's v2 platform. This bot is designed to be a production-ready application, leveraging a robust architecture to execute algorithmic trading strategies on the Polygon network.

### Prerequisites

Before you begin, ensure you have the following software and assets installed and available:

*   **Node.js**: v18.x or later. This is the runtime for the bot.
    ```shell
    # Check your Node.js version
    node -v
    ```
*   **npm**: v8.x or later (usually comes with Node.js). This is used for package management.
    ```shell
    # Check your npm version
    npm -v
    ```
*   **Git**: Required to clone the repository.
*   **Polygon Wallet**: An Ethereum/Polygon compatible wallet (e.g., MetaMask). You will need the **private key** of the wallet you intend to use for trading.
    > **Security Warning**: Your private key grants full control over your funds. Never commit it to a public repository or share it with anyone. The bot will use it locally to sign transactions.
*   **Wallet Funds**:
    *   **MATIC**: For paying gas fees on the Polygon network.
    *   **USDC**: For placing trades on Polymarket. Ensure you have USDC on the Polygon network.

### Installation

Follow these steps to download the source code and install the required dependencies.

1.  **Clone the Repository**
    Open your terminal and clone the repository from GitHub:
    ```shell
    git clone https://github.com/your-username/Polymarket-Copy-Trading-Bot.git
    cd Polymarket-Copy-Trading-Bot
    ```

2.  **Install Dependencies**
    Use `npm` to install all the project dependencies defined in `package.json`:
    ```shell
    npm install
    ```

3.  **Compile the TypeScript Code**
    The bot is written in TypeScript (`src/`) and must be compiled into JavaScript (`dist/`) to run efficiently. The project includes a build script for this.
    ```shell
    npm run build
    ```
    This command will create a `dist` directory containing the compiled JavaScript, ready for execution.

### Configuration

The bot is configured using environment variables. You'll need to create a `.env` file in the root of the project to store your settings and secrets.

1.  **Create a `.env` file**
    Copy the example configuration file to create your local version:
    ```shell
    cp .env.example .env
    ```

2.  **Edit the `.env` file**
    Open the newly created `.env` file in your favorite text editor and fill in the values.

    ```dotenv
    # .env

    # --- Wallet & Blockchain Configuration ---
    # Your wallet's private key (REQUIRED). MUST be kept secret.
    # Example: 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
    PRIVATE_KEY=

    # Polygon RPC endpoint for connecting to the blockchain.
    # Use a reliable provider like Alchemy or Infura.
    POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/your-api-key

    # --- Polymarket API Configuration ---
    # The base URL for the Polymarket CLOB API.
    POLYMARKET_API_URL=https://clob.polymarket.com
    
    # The WebSocket URL for real-time market data.
    POLYMARKET_WS_URL=wss://clob.polymarket.com/ws

    # --- Trading Strategy Configuration ---
    # The strategy to execute. Options: SPREAD_ARBITRAGE, MOMENTUM, COPY_TRADER
    TRADING_

---

## Examples

