# Polymarket-Copy-Trading-Bot

Of course. Here is a comprehensive README overview section based on the provided analysis.

***

# Polymarket Trading Bot Overview

The Polymarket-Copy-Trading-Bot is an autonomous system designed to execute algorithmic trading strategies, such as spread arbitrage, on Polymarket's decentralized prediction markets. It operates in real-time, managing a full lifecycle of scanning market opportunities, placing limit orders via the CLOB API, and enforcing strict risk controls on the Polygon blockchain.

### Problem & Target Audience

This bot solves the challenge of manually executing high-frequency strategies on Polymarket's fast-paced prediction markets, where opportunities like bid-ask spreads are often fleeting and require immediate action. It is designed for quantitative traders, developers, and sophisticated market participants who need a reliable, automated engine to deploy algorithmic strategies, manage risk, and operate 24/7 without manual intervention.

### Key Features

*   **Algorithmic Strategy Engine:** Implements trading logic through a modular system built on a `baseStrategy` class. The repository includes a ready-to-use spread arbitrage strategy (`spreadArb.ts`) and is designed for easy extension with new custom algorithms.
*   **Real-Time CLOB Integration:** Connects directly to Polymarket's Central Limit Order Book (CLOB) API via both REST and WebSockets (`src/api/polymarket.ts`). This allows the bot to scan markets, analyze live order book depth, and react instantly to trading signals.
*   **Comprehensive Trade Lifecycle Management:** Automates the entire trading process from signal generation (`src/market/marketScanner.ts`) to execution. A dedicated `orderManager.ts` handles placing limit orders, monitoring fills, tracking open positions, and calculating P&L.
*   **Configurable Risk Controls:** Protects capital through essential risk management rules loaded from environment variables (`src/config/env.ts`). Key controls include configurable position sizing and daily loss limits that act as circuit breakers.

### Quick Facts

| Category                | Details                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| **Primary Language**    | TypeScript (compiled to JavaScript for Node.js runtime)                  |
| **File & Module Count** | 17 Files, 7 Core Modules (`api`, `config`, `market`, `strategy`, etc.)   |
| **Key Frameworks**      | Node.js                                                                  |
| **Architectural Patterns** | Layered Modular Monolith, Observer Pattern, Factory Pattern, Repository Pattern |

### Architecture Summary

The system is engineered as a **layered modular monolith**, running as a single, self-contained Node.js process with a clear separation of concerns. Its event-driven architecture begins with the `marketScanner` identifying opportunities from real-time data, which are then evaluated by pluggable strategy modules. The `orderManager` subsequently executes and manages trades through a dedicated API abstraction layer, ensuring a clean, unidirectional data flow from market analysis to execution.

### Notable Insights

*   **Implementation vs. Naming Discrepancy:** While named `Polymarket-Copy-Trading-Bot`, the codebase exclusively implements independent algorithmic strategies. There are no features for mirroring other wallets, indicating the project's actual function is algorithmic execution, not social or copy trading. This may be the result of a project pivot or a fork from another codebase.
*   **Strong Modularity for Extensibility:** The architecture is highly modular, using patterns like Factory (`src/strategy/baseStrategy.ts`) and Repository (`src/api/polymarket.ts`). This design makes it straightforward to add new trading strategies or adapt the bot to different API endpoints without refactoring core logic.
*   **Production-Oriented Design:** The bot is built with production use in mind, featuring critical components like secure API key management via environment variables and integrated risk controls. The use of TypeScript ensures type safety for handling sensitive financial calculations.

## Table of Contents

- [Architecture](#architecture)
- [Modules](#modules)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Examples](#examples)

---

Of course. Here is a comprehensive architectural analysis of the Polymarket-Copy-Trading-Bot repository based on the provided information.

---

### **Polymarket Trading Bot: Architecture Documentation**

This document provides a detailed analysis of the software architecture for the Polymarket Trading Bot. It outlines the overall design pattern, individual components, data flow, and key design decisions.

### **1. System Overview & Architecture Pattern**

The system is architected as a **Modular Monolith** with a **Layered** design.

*   **Modular Monolith:** The entire application is designed to run as a single, self-contained process. The central orchestration logic resides within the `PolymarketTradingBot` class (`src`), which instantiates, configures, and manages the lifecycle of all other components. This monolithic approach simplifies deployment and state management. However, it is highly modular, with functionality partitioned into distinct modules (`api`, `market`, `strategy`, `trader`) that have clear responsibilities and well-defined interfaces. This separation of concerns promotes maintainability, testability, and parallel development.

*   **Layered Architecture:** The modules are organized into logical layers, creating a clear and unidirectional dependency flow. This design isolates high-level business policy from low-level implementation details, making the system easier to understand and evolve.
    *   **Core/Orchestration Layer (`src`):** The entry point and central coordinator of the application.
    *   **Business Logic Layer (`src.strategy`, `src.trader`):** Encapsulates the core trading intelligence, decision-making, and risk management rules.
    *   **Data Intelligence Layer (`src.market`):** Responsible for sourcing, processing, and analyzing market data to feed the business logic layer.
    *   **Data Access Layer (`src.api`):** Abstracts all communication with the external Polymarket API.
    *   **Cross-Cutting Concerns (`src.config`, `src.utils`):** Provides foundational services like configuration management and mathematical utilities used by all other layers.

### **2. Architecture Diagram**

The following diagram illustrates the primary components and their interaction pathways. Arrows indicate the direction of data flow and method calls.

```
                  ┌───────────────────────────┐
                  │   src (Main Orchestrator) │
                  │  PolymarketTradingBot.ts  │
                  └────────────┬──────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│  src.strategy     │ │  src.trader       │ │  src.market       │
│  - BaseStrategy   │ │  - RiskManager    │ │  - MarketScanner  │
│  - Momentum       │ └────────┬──────────┘ └────────┬──────────┘
│  - SpreadArb      │          │                     │
└────────┬──────────┘          │                     │
         │                     ▼                     ▼
         └──────────▶┌───────────────────┐◀──────────┘
                     │     src.api       │
                     │ - PolymarketAPI   │
                     │ - WebSocketClient │
                     └────────┬──────────┘
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│   src.config      │ │   src.utils       │ │ External Services │
│   - config.ts     │ │   - MathUtils     │ │ - Polymarket API  │
└───────────────────┘ └───────────────────┘ └───────────────────┘
```

### **3. Component Descriptions**

*   **`src` (Orchestrator)**
    The top-level module containing the `PolymarketTradingBot` class. This class acts as the composition root, responsible for initializing all other modules, wiring them together, and managing the main application lifecycle.

*   **`src.config` (Configuration)**
    This module centralizes all application configuration. It loads settings from environment variables, validates them, and provides a strongly-typed configuration object that is injected into other modules, ensuring consistent and safe access to parameters like API keys and trading thresholds.

*   **`src.api` (API Client)**
    This is the Data Access Layer, responsible for all communication with the external Polymarket service. It encapsulates the complexities of making REST API calls for market data and managing a persistent WebSocket connection for real-time order book updates.

*   **`src.market` (Market Intelligence)**
    This module provides market analysis and discovery services. The `MarketScanner` class periodically fetches all available markets via the `src.api` module, then filters and scores them to identify the most promising trading opportunities for the strategies to focus on.

*   **`src.strategy` (Trading Strategies)**
    This module contains the core trading logic. It uses the **Strategy Pattern**, defining a `BaseStrategy` abstract class that establishes a common interface for all trading algorithms. Concrete implementations like `MomentumStrategy` and `SpreadArbStrategy` extend this base class to implement their specific logic for generating trade signals based on market data.

*   **`src.trader` (Trade & Risk Management)**
    This module is responsible for the execution and safety of trades. The `RiskManager` class receives trade signals from the active strategy, evaluates them against a set of pre-configured rules (e.g., max position size, slippage), and only proceeds with execution via the `src.api` module if all checks pass.

*   **`src.utils` (Shared Utilities)**
    A collection of cross-cutting utility functions. The `MathUtils` class provides static methods for high-precision financial calculations, preventing floating-point errors and centralizing complex mathematical logic used across strategies and risk management.

### **4. Data Flow**

The typical operational flow of data through the system follows these steps:

1.  **Initialization:** The `PolymarketTradingBot` in `src` starts, loads the configuration from `src.config`, and instantiates the `MarketScanner`, `PolymarketAPI`, `RiskManager`, and the selected `Strategy` class.
2.  **Market Discovery:** The `MarketScanner` (`src.market`) makes a request through the `PolymarketAPI` (`src.api`) to fetch all available markets. It filters and scores them, selecting a target market.
3.  **Data Subscription:** The orchestrator instructs the `PolymarketAPI` to establish a WebSocket connection and subscribe to the order book feed for the target market.
4.  **Real-time Analysis:** The `PolymarketAPI` receives WebSocket messages, parses them into structured order book data, and forwards this data to the active `Strategy` instance (`src.strategy`).
5.  **Signal Generation:** The strategy analyzes the incoming order book data, often using `MathUtils` (`src.utils`). When its conditions are met, it generates a trade signal (e.g., `BUY`, `SELL`, `price`, `size`).
6.  **Risk Assessment:** The trade signal is passed to the `RiskManager` (`src.trader`). The `RiskManager` validates the signal against rules defined in `src.config`, such as maximum exposure and capital allocation.
7.  **Order Execution:** If the signal passes risk checks, the `RiskManager` instructs the `PolymarketAPI` to execute the trade by placing an order on the Polymarket exchange.
8.  **State Update:** The `PolymarketAPI` receives confirmation of the order placement (or fill) and updates the application's internal state, which is monitored by the `RiskManager` and `Strategy`. The loop from step 4 continues.

### **5. Key Design Decisions**

*   **Strategy Design Pattern (`src.strategy`):** The use of a `BaseStrategy` with concrete implementations (`momentum.ts`, `spreadArb.ts`) is a deliberate choice. It decouples the core bot engine from the trading logic itself, allowing new strategies to be developed and "plugged in" with minimal changes to the surrounding infrastructure.
*   **Decoupling Risk from Strategy (`src.trader` vs. `src.strategy`):** The decision to separate the `RiskManager` from the strategy logic is critical. Strategies are responsible for finding opportunities ("what to trade"), while the `RiskManager` is the single authority on portfolio constraints ("if and how much to trade"). This separation prevents buggy or aggressive strategies from violating core risk principles.
*   **Centralized API Abstraction (`src.api`):** All external communication is routed through the `src.api` module. This creates a clean boundary (an Anti-Corruption Layer) between the bot's domain logic and the specifics of the Polymarket API. If Polymarket changes its API, only this module needs to be updated, protecting the rest of the codebase.
*   **Environment-Driven Configuration (`src.config`):** All configurable parameters are loaded from environment variables. This is a security and operational best practice, as it avoids hardcoding sensitive data (like API keys) and allows the same codebase to be deployed in different environments (development, staging, production) with different settings.

---

## Modules

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

---

Of course. Here is the comprehensive documentation for the `src.config` module, based on the provided analysis.

***

## src.config

### Overview

This module is the application's central configuration hub. Its primary responsibility is to load environment variables from the host system (e.g., a `.env` file or system environment), parse them into appropriate data types, and validate them against a strict schema. The final output is a single, type-safe, and immutable `config` object that serves as the single source of truth for all environment-dependent settings.

### Key Components

*   **`config` (singleton object)**
    The primary and sole public export of this module. It is an immutable object generated at application startup that contains all parsed and validated configuration values. The rest of the application should import and consume this object directly.

*   **`validateConfig(config)`**
    An internal function that enforces the configuration schema. It checks for the presence of required variables, validates their types (e.g., ensuring a port is a valid number), and can enforce complex rules (e.g., a URL must be well-formed). If validation fails, the application will throw a descriptive error and exit, preventing it from running in a misconfigured state.

*   **`getEnv*` Helper Functions**
    A family of internal utility functions (`getEnvVar`, `getEnvNumber`, `getEnvBoolean`, `getEnvDecimal`) responsible for the low-level work of reading a single variable from `process.env` and coercing it from a string into the correct data type. They handle logic for default values and basic parsing before the values are passed to the validator.

### Usage

To use the configuration module, you simply import the `config` object into any file that requires access to environment variables. The module guarantees that if the application is running, the `config` object is fully populated and valid.

#### **1. Define Environment Variables**

First, create a `.env` file in the root of your project.

**.env**
```env
# Server Configuration
NODE_ENV=development
PORT=8080

# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/mydatabase"

# Feature Flags
ENABLE_AUDIT_LOGS=true

# Financials - using a string to be parsed as a Decimal
TRANSACTION_FEE_RATE="0.025"
```

#### **2. Consume the `config` Object**

In any other part of your application, such as your main server file, import and use the `config` object.

**src/server.ts**
```typescript
import { createServer } from 'http';
import { config } from './config/env'; // Adjust path as needed
import { connectToDatabase } from './database';

// Use configuration values to initialize parts of the application
const initializeApp = async () => {
  console.log(`Application starting in ${config.NODE_ENV} mode.`);

  // Connect to the database using the validated URL
  await connectToDatabase(config.DATABASE_URL);
  console.log('Database connection established.');

  const server = createServer((req, res) => {
    // Example of using a config value in request logic
    if (config.ENABLE_AUDIT_LOGS) {
      console.log(`[AUDIT] Request received for: ${req.url}`);
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server is running!');
  });

  server.listen(config.PORT, () => {
    console.log(`Server listening on http://localhost:${config.PORT}`);
    console.log(`Transaction fee rate is set to: ${config.TRANSACTION_FEE_RATE.toString()}`);
  });
};

initializeApp().catch(error => {
  console.error('Failed to initialize application:', error);
  process.exit(1);
});
```

### API Reference

#### **`config`**

The validated and strongly-typed configuration object. This object is frozen after initialization to prevent runtime modifications. Its properties directly correspond to the environment variables defined in the module's validation schema.

*   **Type**: `object` (inferred from the validation schema, e.g., `z.infer<typeof configSchema>`)
*   **Description**: A singleton object containing all application configuration. It is the result of loading, parsing, and validating all environment variables.

##### **Example Properties**

Based on the usage example above, the `config` object would have the following properties and types:

*   `NODE_ENV: 'development' | 'production' | 'test'`
*   `PORT: number`
*   `DATABASE_URL: string`
*   `ENABLE_AUDIT_LOGS: boolean`
*   `TRANSACTION_FEE_RATE: Decimal`

---

*Note: The following functions are internal to the `src.config` module and are not part of its public API. They are documented here for completeness.*

#### `getEnvVar(name: string, defaultValue?: string): string`
Retrieves a string environment variable. Throws an error if the variable is not set and no default is provided.

#### `getEnvNumber(name: string, defaultValue?: number): number`
Retrieves and parses an environment variable as an integer.

#### `getEnvBoolean(name: string, defaultValue?: boolean): boolean`
Retrieves and parses an environment variable as a boolean (handles "true", "false", "1", "0").

#### `getEnvDecimal(name: string, defaultValue?: Decimal): Decimal`


---

Of course. Here is the comprehensive documentation for the `src.trader` module.

***

## src.trader

### Overview

The `src.trader` module serves as the operational core of the trading system, responsible for managing the entire lifecycle of a trade. It acts as the intermediary between high-level strategy signals and low-level exchange interactions. This module ensures that all trading activity is validated against risk rules, executed reliably, and tracked accurately.

### Key Components

This module is composed of three primary classes that work in concert to manage trading operations.

*   **`RiskManager`**: Acts as the system's gatekeeper. Its primary role is to perform pre-trade validation on any incoming trade signal. It enforces a comprehensive set of rules, such as maximum position size, daily loss limits, and market-specific constraints, to ensure that the system operates within its defined safety parameters. A signal is only passed for execution if it clears all risk checks.

*   **`OrderManager`**: Manages the mechanics of trade execution. It is responsible for the entire lifecycle of an order: placing it on the exchange, tracking its status (e.g., `PENDING`, `FILLED`, `CANCELLED`), handling updates, and processing cancellations. It abstracts the complexities of the exchange's API for order placement and management.

*   **`PositionManager`**: Functions as the portfolio accountant. It maintains a real-time state of all current positions held by the user. It syncs data from the exchange, tracks quantities, calculates unrealized profit and loss, and provides a consolidated view of the trading portfolio. The `RiskManager` relies on this component to assess current market exposure.

### Usage

The typical workflow involves instantiating all three managers and using the `RiskManager` as the primary entry point for initiating a new trade. The managers are designed to be used together, with dependencies injected during initialization.

Here is a conceptual example of how to initialize the components and process a trade signal:

```typescript
import { RiskManager } from './riskManager';
import { OrderManager } from './orderManager';
import { PositionManager } from './positionManager';
import { PolymarketClient, TradeSignal, UserConfig } from '../types'; // Hypothetical types

// 1. Initialize dependencies
const userConfig: UserConfig = {
    maxPortfolioAllocation: 0.8,
    dailyLossLimit: -500,
    maxPositionSize: 1000,
};
const polymarketClient: PolymarketClient = new PolymarketClient(process.env.API_KEY);

// 2. Instantiate the managers
// PositionManager tracks our holdings.
const positionManager = new PositionManager(polymarketClient);

// OrderManager executes trades.
const orderManager = new OrderManager(polymarketClient);

// RiskManager validates signals using data from the other managers.
const riskManager = new RiskManager(userConfig, positionManager, orderManager);

// 3. A strategy generates a trade signal
const buySignal: TradeSignal = {
    marketId: '0x123abc...',
    outcome: 'Yes', // 'Yes' or 'No'
    direction: 'BUY',
    size: 100, // Number of shares
    price: 0.65, // Limit price
    rationale: 'Strong technical indicator confluence.'
};

async function processTrade() {
    try {
        // 4. Sync current positions before making a decision
        await positionManager.syncPositions();
        console.log('Current positions synced.');

        // 5. Evaluate the signal through the RiskManager
        // This is the primary entry point for all trading logic.
        console.log(`Evaluating signal for market ${buySignal.marketId}...`);
        const evaluationResult = await riskManager.evaluateSignal(buySignal);

        if (evaluationResult.isApproved) {
            console.log(`Signal approved. Reason: ${evaluationResult.reason}`);
            // The RiskManager would have already called orderManager.placeOrder() internally
            // The result might contain the orderId for tracking.
            const orderId = evaluationResult.orderId;
            console.log(`Order placed with ID: ${orderId}`);
        } else {
            console.error(`Signal rejected. Reason: ${evaluationResult.reason}`);
        }

    } catch (error) {
        console.error('An error occurred during trade processing:', error);
    }
}

processTrade();
```

### API Reference

#### `class: RiskManager`

The primary entry point for initiating trades. It validates signals against user-defined rules and portfolio state.

**`constructor(config: UserConfig, positionManager: PositionManager, orderManager: OrderManager)`**

*   `config: UserConfig`: An object containing risk parameters like `maxPositionSize`, `dailyLossLimit`, etc.
*   `positionManager: PositionManager`: An instance of `PositionManager` to check current portfolio exposure.
*   `orderManager: OrderManager`: An instance of `OrderManager` to place orders for approved signals.

**`async evaluateSignal(signal: TradeSignal): Promise<EvaluationResult>`**

Evaluates a trade signal against all configured risk rules. If the signal is approved, it delegates order placement to the `OrderManager`.

*   `signal: TradeSignal`: An object describing the proposed trade (market, size, price, direction).
*   **Returns**: `Promise<EvaluationResult>` - An object indicating if the trade was `isApproved` and providing a `reason` and `orderId` if applicable.

---

#### `class: PositionManager`

Manages the state of the user's trading portfolio.

**`constructor(client: PolymarketClient)`**

*   `client: PolymarketClient`: An API client instance for fetching position data from the exchange.

**`async syncPositions(): Promise<void>`**

Fetches the latest position data from the exchange and updates the internal state. This should be called periodically and before any risk evaluation.

*   **Returns**: `Promise<void>`

**`getPosition(marketId: string): Position | undefined`**

Retrieves a specific position from the managed portfolio by its market ID.

*   `marketId: string`: The unique identifier for the market.
*   **Returns**: `Position | undefined` - The position object if it exists, otherwise `undefined`.

**`getAllPositions(): Position[]`**

Retrieves all current positions in the portfolio.

*   **Returns**: `Position[]` - An array of all position objects.

---

#### `class: OrderManager`

Handles all interactions with the exchange related to order management.

**`constructor(client: PolymarketClient)`**

*   `client: PolymarketClient`: An API client instance for placing and managing orders on the exchange.

**`async placeOrder(params: OrderParams): Promise<OrderResult>`**

Places a new order on the exchange.

*   `params: OrderParams`: An object containing the necessary details to place an order (market, size, price, etc.).
*   **Returns**: `Promise<OrderResult>` - An object containing the result of the placement, including the `orderId`.

**`async cancelOrder(orderId: string): Promise<boolean>`**

Cancels an active, unfilled order on the exchange.

*   `orderId: string`: The unique identifier of the order to cancel.
*   **Returns**: `Promise<boolean>` - `true` if cancellation was successful, `false` otherwise.

**`async getOrderStatus(orderId: string): Promise<OrderStatus>`**

Fetches the current status of a specific order.

*   `orderId: string`: The unique identifier of the order.
*   **Returns**: `Promise<OrderStatus>` - An object detailing the order's current state (e.g., `FILLED`, `PENDING`, `CANCELLED`).

### Dependencies

*   **Internal Dependencies**:
    *   `RiskManager` depends on `PositionManager` (to check current exposure) and `OrderManager` (to execute trades).
    *   `OrderManager` and `PositionManager` are independent of other classes within this module but are designed to be used by `RiskManager`.

*   **External Dependencies**:
    *   **Exchange Client**: All three classes require an external client (

---

Of course. Here is the comprehensive documentation for the `src.utils` module, based on the provided analysis.

***

## src.utils

### Overview

The `src.utils` module provides a centralized collection of shared, cross-cutting utilities essential for the application's core operations. It encapsulates foundational services for precise mathematical computations and standardized application logging. By abstracting these common functionalities, it promotes code reuse, consistency, and maintainability across the entire codebase.

### Key Components

*   **`MathUtils`** (from `src/utils/math.ts`)
    A static utility class designed for performing precise mathematical calculations, particularly for financial, trading, and probability contexts. It provides a reliable interface for operations where standard JavaScript floating-point inaccuracies are unacceptable, ensuring data integrity for sensitive calculations.

*   **`logger`** (from `src/utils/logger.ts`)
    A pre-configured, singleton logging instance that provides a standardized interface for logging application events, debug information, warnings, and errors. Using this singleton ensures that log formatting, output streams (e.g., console, file), and log levels are consistent throughout the application.

### Usage

Here is how to import and use the key components from the `src.utils` module in other parts of the application.

#### Using MathUtils

Import the `MathUtils` class to perform safe and precise calculations. This is critical for any financial or statistical logic.

```typescript
import { MathUtils } from './math';
import logger from './logger';

function calculateTradeProfit(entryPrice: string, exitPrice: string, quantity: number): string {
  logger.info(`Calculating profit for trade: entry=${entryPrice}, exit=${exitPrice}`);

  // Calculate the percentage change with high precision
  const percentageGain = MathUtils.calculatePercentageChange(entryPrice, exitPrice);

  // Calculate the total profit
  const priceDifference = MathUtils.subtract(exitPrice, entryPrice);
  const totalProfit = MathUtils.multiply(priceDifference, quantity);

  logger.info(`Trade resulted in a ${percentageGain}% gain.`);

  // Return the profit formatted to 2 decimal places
  return MathUtils.toFixed(totalProfit, 2);
}

const profit = calculateTradeProfit('45000.50', '45750.75', 1.5);
console.log(`Total Profit: $${profit}`); // Expected output: Total Profit: $1125.38
```

#### Using the Logger

Import the `logger` instance to log messages from any module. It is already configured and ready to use.

```typescript
import logger from './logger';

class OrderService {
  public processOrder(orderId: string, amount: number) {
    logger.info('Starting to process order.', { orderId, amount });

    try {
      if (amount <= 0) {
        // Use 'warn' for expected but non-ideal conditions
        logger.warn('Order amount is zero or negative. Skipping.', { orderId });
        return;
      }

      // ... business logic to process the order ...

      logger.info('Successfully processed order.', { orderId });

    } catch (error) {
      // Use 'error' to log unexpected exceptions, passing the error object
      // for stack trace information.
      logger.error(`Failed to process order: ${orderId}`, { error });
      throw error; // Re-throw the error to be handled upstream
    }
  }
}

const orderService = new OrderService();
orderService.processOrder('abc-123', 500);
orderService.processOrder('def-456', 0);
```

### API Reference

#### **`class MathUtils`**

A static utility class for high-precision mathematical operations. All methods are static and should be called directly on the class.

##### **`static calculatePercentageChange(initial: number | string,

---

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

---

Of course. Here is the comprehensive documentation for the `src.market` module.

***

## src.market

### Overview

The `src.market` module is the application's primary interface for market data acquisition, analysis, and intelligence from Polymarket. It is responsible for discovering potentially profitable markets and performing deep, real-time analysis on them. This is achieved through a two-tiered approach: a broad, periodic scanner to identify opportunities (`MarketScanner`) and a focused, real-time engine for in-depth orderbook analysis (`OrderbookEngine`).

### Key Components

*   **`MarketScanner` (`marketScanner.ts`)**
    This class periodically fetches all active markets from the Polymarket API. It then applies a series of configurable filters (e.g., volume, liquidity, time to resolution) and a scoring algorithm to identify and rank the most promising trading opportunities. The results are cached internally for efficient access by other parts of the system.

*   **`OrderbookEngine` (`orderbook.ts`)**
    This class provides continuous, real-time analysis of a single market's orderbook. It connects to a WebSocket data stream, processes raw order updates, and calculates key financial metrics like bid-ask spread, market depth, price momentum, and volatility. It emits structured `OrderbookSnapshot` events for consumers, such as a trading strategy module.

### Usage

The typical workflow involves using the `MarketScanner` to discover a high-potential market, and then instantiating an `OrderbookEngine` to monitor that specific market in real-time for an entry or exit signal.

```typescript
import { MarketScanner } from './market/marketScanner';
import { OrderbookEngine } from './market/orderbook';
import { Market, OrderbookSnapshot } from '../types'; // Assuming shared types

// 1. Define configuration for the scanner
const scannerConfig = {
  // Hypothetical filters and scorer configuration
  filters: [
    { type: 'volume', min: 10000 },
    { type: 'liquidity', min: 5000 },
    { type: 'daysRemaining', max: 30 },
  ],
  scorer: {
    weights: { volume: 0.5, liquidity: 0.3, volatility: 0.2 },
  },
  scanInterval: 60000, // Scan every 60 seconds
};

async function main() {
  // 2. Initialize and start the MarketScanner
  const scanner = new MarketScanner(scannerConfig);
  await scanner.start();
  console.log('MarketScanner started. Periodically searching for opportunities...');

  // 3. Periodically check the scanner's results for the top market
  setInterval(() => {
    const scoredMarkets: Market[] = scanner.getScoredMarkets();
    if (scoredMarkets.length > 0) {
      const topMarket = scoredMarkets[0];
      console.log(`Top ranked market found: "${topMarket.question}" (Score: ${topMarket.score})`);
      
      // 4. Once a top market is found, start a dedicated OrderbookEngine for it
      // (In a real app, you'd manage engine instances to avoid duplicates)
      startOrderbookAnalysis(topMarket.conditionId);
    } else {
      console.log('No markets passed the filters in the last scan.');
    }
  }, 10000); // Check for new top markets every 10 seconds
}

async function startOrderbookAnalysis(conditionId: string) {
  console.log(`Starting real-time analysis for market: ${conditionId}`);
  const engine = new OrderbookEngine({ conditionId });

  // 5. Listen for real-time snapshot events from the engine
  engine.on('snapshot', (snapshot: OrderbookSnapshot) => {
    // A trading strategy would consume this data to make decisions
    console.log(`[${conditionId}] Snapshot Update:`);
    console.log(`  Spread: ${snapshot.spread.toFixed(4)}`);
    console.log(`  Best Bid: ${snapshot.bestBid.price} | Best Ask: ${snapshot.bestAsk.price}`);
    console.log(`  1-min Momentum: ${snapshot.momentum['1m'].toFixed(5)}`);
  });

  engine.on('error', (err) => {
    console.error(`OrderbookEngine for ${conditionId} encountered an error:`, err);
  });

  await engine.start();
}

main().catch(console.error);
```

### API Reference

#### `class MarketScanner`

Responsible for discovering and ranking markets based on predefined criteria.

*   **`constructor(config: MarketScannerConfig)`**
    Creates an instance of the `MarketScanner`.
    *   `config`: An object containing configuration.
        *   `apiClient`: An instance of the Polymarket API client.
        *   `filters`: An array of filter objects to apply to the market list.
        *   `scorer`: A scoring configuration object.
        *   `scanInterval` (optional): The interval in milliseconds for periodic scanning

---

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

---


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

---

Of course. Based on the detailed summary of the `Polymarket-Copy-Trading-Bot` repository, here is a practical and actionable Getting Started guide.

***

## Getting Started

This guide will walk you through setting up, configuring, and running the Polymarket-Copy-Trading-Bot on your local machine. The bot is a powerful tool for automating trading strategies on the Polymarket prediction market platform.

### Prerequisites

Before you begin, ensure you have the following software and assets installed and available. The bot's architecture relies on a standard Node.js and TypeScript environment and interacts directly with the Polygon blockchain.

*   **Node.js**: v18.x or later. The bot is built on the Node.js runtime.
*   **npm**: v8.x or later (or yarn). This comes bundled with Node.js and is used for managing project dependencies.
*   **Git**: Required to clone the repository from its source.
*   **Polygon Wallet**: A non-custodial wallet (like MetaMask) to hold your funds and sign transactions.
*   **Wallet Private Key**: The private key for your trading wallet.
    *   **⚠️ SECURITY WARNING**: Your private key grants complete control over your funds. Never commit it to version control or share it publicly. The bot will use it to sign transactions on your behalf. It is highly recommended to use a new, dedicated wallet for this bot with a limited amount of capital.
*   **Polygon RPC URL**: A connection endpoint to the Polygon network. You can get one for free from services like [Alchemy](https://www.alchemy.com/), [Infura](https://www.infura.io/), or [Ankr](https://www.ankr.com/).
*   **Funds**: Your wallet must be funded with:
    *   **USDC**: The stablecoin used for placing trades on Polymarket.
    *   **MATIC**: The native token of the Polygon network, required to pay for gas fees on all transactions.

### Installation

Follow these steps to download the source code and install the necessary dependencies.

1.  **Clone the repository:**
    Open your terminal and use `git` to clone the project to your local machine.

    ```bash
    git clone https://github.com/user/Polymarket-Copy-Trading-Bot.git
    cd Polymarket-Copy-Trading-Bot
    ```

2.  **Install dependencies:**
    Use `npm` to install all the required packages defined in `package.json`.

    ```bash
    npm install
    ```

3.  **Compile the TypeScript code:**
    The source code is written in TypeScript (`src/index.ts`) and must be compiled into JavaScript (`dist/index.js`) for Node.js to execute it. The project should include a build script for this.

    ```bash
    npm run build
    ```
    This command will create a `dist` directory containing the compiled JavaScript files.

### Configuration

The bot is configured using environment variables. This practice keeps your sensitive information, like private keys, separate from the source code.

1.  **Create a `.env` file:**
    The repository likely includes an example file. Copy it to create your local configuration file.

    ```bash
    cp .env.example .env
    ```

2.  **Edit the `.env` file:**
    Open the newly created `.env` file in a text editor and fill in the required values.

    ```dotenv
    # .env

    # -- Blockchain Configuration --
    # Your wallet's private key (DO NOT share this)
    PRIVATE_KEY="0xYourPrivateKeyHere"
    # Your Polygon RPC URL from a provider like Alchemy or Infura
    POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/your-api-

---

## Examples

