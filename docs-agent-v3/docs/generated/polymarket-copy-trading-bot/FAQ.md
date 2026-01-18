# Frequently Asked Questions - Polymarket-Copy-Trading-Bot

This FAQ addresses common questions about the Polymarket-Copy-Trading-Bot codebase, based on automated analysis.

---

Here is a comprehensive FAQ section for the Polymarket-Copy-Trading-Bot, based on the provided repository analysis.

***

### **Getting Started**

## Q: What are the prerequisites for running this bot?

**A:** To run this bot, you will need the following installed on your system:
1.  **Node.js**: The application is built on the Node.js runtime.
2.  **npm** or **yarn**: A package manager to install the project dependencies listed in `package.json`.
3.  **API Credentials**: You must have a Polymarket API key and secret to interact with the platform. These are configured via environment variables.

You will also need to create a configuration file (e.g., `.env`) in the root directory to store your credentials and custom parameters, which are loaded by `src/config/env.ts`.

---

## Q: How do I install and run the bot for the first time?

**A:** Follow these steps to get the bot running:
1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd Polymarket-Copy-Trading-Bot
    ```
2.  **Install dependencies:** Using your preferred package manager, install the libraries defined in `package.json`.
    ```bash
    npm install
    ```
3.  **Configure Environment Variables:** Create a `.env` file in the project root. This file is parsed by `src/config/env.ts`. At a minimum, you will need to provide your Polymarket API credentials. You can also set risk management parameters like `POSITION_LIMIT` and `DAILY_LOSS_CAP`.
    ```dotenv
    # .env file
    POLKMARKET_API_KEY=your_api_key
    POLKMARKET_API_SECRET=your_api_secret
    # Optional risk parameters
    MAX_POSITION_SIZE_USD=100
    DAILY_PROFIT_TARGET_USD=50
    ```
4.  **Start the bot:** The main entry point is `src/index.ts`. The `package.json` file should contain a start script to compile the TypeScript and run the application.
    ```bash
    npm start
    ```

---

## Q: How can I verify that the bot is running correctly after launch?

**A:** The primary way to verify the bot's operation is by monitoring its console output. The application uses a logger utility (likely defined in `src/utils/logger.ts`) to provide real-time status updates. After starting, you should look for log messages indicating:
*   Successful initialization and configuration loading from `src/config/env.ts`.
*   The `MarketScanner` (from `src/market/marketScanner.ts`) starting its scan for tradable markets.
*   WebSocket connection establishment, managed by `src/api/websocket.ts`.
*   Markets being identified and strategies being evaluated (e.g., "Spread arbitrage opportunity detected").
*   Orders being placed or risk limits being hit, as managed by `src/trader/orderManager.ts` and `src/trader/riskManager.ts`.

If you see a continuous stream of these logs without critical error messages, the bot is functioning as expected.

---

### **Usage**

## Q: The repository is named "Copy-Trading-Bot," but the summary says this feature isn't implemented. What is the bot's actual main functionality?

**A:** You are correct. Despite its name, the repository does not contain any copy trading logic. Its core functionality is **algorithmic trading** on Polymarket's prediction markets. The bot operates based on pre-defined strategies to identify and exploit market inefficiencies. The main workflow is:
1.  The `MarketScanner` in `src/market/marketScanner.ts` continuously discovers active markets that meet liquidity and volume criteria.
2.  For each valid market, the bot subscribes to real-time order book data via the WebSocket handler in `src/api/websocket.ts`.
3.  Algorithmic strategies, such as `spreadArb.ts` (spread arbitrage) and `momentum.ts` (momentum trading) located in `src/strategy`, analyze the live data to generate trading signals.
4.  Before execution, all potential trades are validated by the `RiskManager` in `src/trader/riskManager.ts` to ensure they comply with configured limits.
5.  Finally, the `OrderManager` in `src/trader/orderManager.ts` places, tracks, and manages the lifecycle of limit orders on Polymarket.

---

## Q: How do I configure the bot's trading strategies and risk parameters?

**A:** All configuration is managed through environment variables, which are loaded and validated by the module at `src/config/env.ts`. To change settings, you must edit your `.env` file in the project's root directory. Key configurable options include:
*   **Strategy Toggles:** You can likely enable or disable specific strategies (e.g., `ENABLE_SPREAD_ARB_STRATEGY=true`).
*   **Risk Management:** Critical parameters managed by `src/trader/riskManager.ts` can be set here, such as `MAX_POSITION_SIZE_USD`, `DAILY_LOSS_CAP_USD`, and `CIRCUIT_BREAKER_COOLDOWN_MINUTES`.
*   **Market Filtering:** You can adjust criteria used by `src/market/marketScanner.ts`, such as minimum daily volume or liquidity thresholds, to control which markets the bot trades.

After modifying the `.env` file, you must restart the bot for the new configuration to take effect.

---

## Q: What is the typical operational workflow of the bot from start to finish?

**A:** The bot follows a continuous, event-driven workflow orchestrated by the main `src/index.ts` file:
1.  **Initialization:** The bot starts, loads configuration from `src/config/env.ts`, and initializes all core modules (`MarketScanner`, `OrderManager`, `RiskManager`, etc.).
2.  **Market Discovery:** `src/market/marketScanner.ts` makes API calls via `src/api/polymarket.ts` to find promising markets.
3.  **Data Streaming:** For each discovered market, `src/api/websocket.ts` establishes a connection to stream live order book updates.
4.  **Signal Generation:** The live data is passed to active strategy modules in `src/strategy`. For example, `spreadArb.ts` calculates the spread between YES/NO tokens in real-time. If an opportunity is found, it generates a trading signal.
5.  **Risk Validation:** The signal is sent to `src/trader/riskManager.ts`, which checks if executing the trade would violate rules like position limits or daily loss caps.
6.  **Order Execution:** If the trade is approved, `src/trader/orderManager.ts` constructs and places a limit order via the REST API.
7.  **Monitoring & Feedback:** The bot monitors WebSocket events for order fills, partial fills, or cancellations. This feedback updates the internal state of the `RiskManager` and may trigger follow-up actions. This entire loop runs continuously for all active markets.

---

### **Architecture**

## Q: How is the codebase organized? What is the overall architectural pattern?

**A:** The codebase is structured as a **modular monolith** with a **layered architecture**. This means it runs as a single Node.js process but is internally organized into distinct, loosely-coupled modules with clear responsibilities.
*   **Root (`/`)**: Contains project metadata like `package.json` and `README.md`.
*   **`src/`**: The main source directory containing all application logic.
    *   **`src/api`**: Handles all external communication with the Polymarket REST and WebSocket APIs.
    *   **`src/config`**: Manages loading and validation of environment variables.
    *   **`src/market`**: Responsible for discovering and analyzing markets.
    *   **`src/strategy`**: Contains the core trading algorithms (e.g., `spreadArb.ts`).
    *   **`src/trader`**: Manages the execution logic, including order placement (`orderManager.ts`) and risk controls (`riskManager.ts`).
    *   **`src/utils`**: Provides shared utilities like logging and precise math calculations using `Decimal.js`.

This structure separates concerns effectively, making the system easier to maintain and extend. For example, all trading logic is isolated within the `src/strategy` directory.

---

## Q: How do the different modules like `MarketScanner`, `BaseStrategy`, and `OrderManager` interact with each other?

**A:** The components interact through an **event-driven flow**, heavily utilizing the **Observer pattern** (likely via Node.js's `EventEmitter`). This creates a decoupled pipeline for processing market data and executing trades.
1.  The main application entry point, `src/index.ts`, instantiates all the major components.
2.  The `MarketScanner` (`src/market/marketScanner.ts`) periodically scans for markets and emits an event (e.g., `marketFound`) with market data.
3.  Strategy instances (which extend `src/strategy/baseStrategy.ts`) listen for these events. Upon receiving data, they analyze it.
4.  If a strategy like `spreadArb.ts` identifies a trading opportunity, it generates a signal and emits another event (e.g., `tradeSignalGenerated`).
5.  The `RiskManager` (`src/trader/riskManager.ts`) listens for these signals, validates them against its rules, and if approved, passes the signal on.
6.  Finally, the `OrderManager` (`src/trader/orderManager.ts`) listens for approved signals and executes the trade by calling the API wrapper in `src/api/polymarket.ts`.
7.  The `OrderManager` then emits events of its own, such as `orderFill` or `orderCancelled`, which are used by the `RiskManager` and other components to update their internal state.

---

### **Troubleshooting**

## Q: I'm getting errors on startup. What are the most common issues and how can I fix them?

**A:** The most common startup errors are typically related to configuration or connectivity.
1.  **Missing Environment Variables:** If the bot terminates immediately with errors about "undefined" configuration values, it's likely your `.env` file is missing, misnamed, or incomplete. Ensure the file exists in the project root and contains all required variables (especially `POLKMARKET_API_KEY` and `POLKMARKET_API_SECRET`), as defined in `src/config/env.ts`.
2.  **Invalid API Credentials:** If you see "Authentication Failed" or "401 Unauthorized" errors in the logs, your API key or secret is incorrect. Double-check them in your `.env` file.
3.  **Network/Firewall Issues:** If the bot fails to connect to the Polymarket API or WebSocket, ensure you have a stable internet connection and that no firewalls are blocking outbound requests to Polymarket's domains.

---

## Q: Where can I find logs or other diagnostic information to debug a problem?

**A:** The application's primary diagnostic tool is its logging system, which is likely implemented in `src/utils/logger.ts`. All operational information, warnings, and errors are printed directly to the **console (stdout/stderr)** where the bot process is running. To debug an issue:
*   **Run the bot in a terminal window** where you can see the live output.
*   **Look for messages tagged with `ERROR` or `WARN`**. These will often include stack traces or specific details about what went wrong (e.g., API request failure, risk limit breach).
*   **Increase Log Verbosity:** If the logger supports it (a common feature), you may be able to set a `LOG_LEVEL` environment variable in your `.env` file to `DEBUG` for more granular output.

There is no mention of logs being written to a file, so the console is the best place to look.

---

### **Advanced**

## Q: How can I create and add my own custom trading strategy to the bot?

**A:** The architecture is designed to be extensible, making it straightforward to add new strategies.
1.  **Create a new strategy file** inside the `src/strategy/` directory (e.g., `myStrategy.ts`).
2.  **Extend the base class:** In your new file, create a class that extends `BaseStrategy` from `src/strategy/baseStrategy.ts`. This ensures your strategy adheres to the required interface.
    ```typescript
    // src/strategy/myStrategy.ts
    import { BaseStrategy } from './baseStrategy';
    import { OrderBook } from '../market/orderbook';

    export class MyStrategy extends BaseStrategy {
        constructor(config) {
            super(config);
        }

        evaluate(orderBook: OrderBook) {
            // Implement your custom trading logic here.
            // Analyze the orderBook and market data.
            // If an opportunity is found, generate a signal.
            const signal = { /* ... */ };
            this.emit('tradeSignal', signal);
        }
    }
    ```
3.  **Implement the `evaluate` method:** This is the core of your strategy. It will receive real-time market data (like the order book) as an argument. Your logic should analyze this data and, if a trading opportunity is found, emit a `tradeSignal` event.
4.  **Integrate the strategy:** In the main application logic (likely `src/index.ts`), instantiate your new strategy and register its event listeners, just as existing strategies like `spreadArb.ts` are initialized. You may also need to add a configuration toggle for it in `src/config/env.ts`.

---

## Q: What are the performance considerations for running this bot, especially regarding latency?

**A:** The bot's design prioritizes low-latency trading, but there are several factors to consider:
*   **Event-Driven Architecture:** The use of an event-driven model with WebSockets (`src/api/websocket.ts`) is the most critical performance feature. It ensures the bot reacts to market changes in real-time rather than polling, which is essential for arbitrage strategies.
*   **Network Latency:** The physical distance between your server and Polymarket's servers will be the biggest factor in latency. For serious trading, deploying the bot on a cloud server geographically close to Polymarket's infrastructure is recommended.
*   **Computational Overhead:** The use of `Decimal.js` (referenced in `src/utils/math.ts`) for all financial calculations prevents floating-point errors but introduces a small performance overhead compared to native JavaScript numbers. This is a necessary trade-off for accuracy.
*   **Single-Threaded Nature:** As a Node.js application, the bot is primarily single-threaded. While its asynchronous, non-blocking I/O model is highly efficient for handling many API calls and WebSocket connections, CPU-intensive calculations within a strategy could potentially block the event loop and introduce latency. Strategies should be designed to be computationally lean.

---

*This FAQ was generated automatically based on code analysis. For the most up-to-date information, refer to the source code and inline documentation.*
