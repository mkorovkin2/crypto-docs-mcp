# Frequently Asked Questions - Polymarket-Copy-Trading-Bot

This FAQ addresses common questions about the Polymarket-Copy-Trading-Bot codebase, based on automated analysis.

---

Here is a comprehensive FAQ section for the Polymarket-Copy-Trading-Bot repository, based on the provided analysis.

***

### **GETTING STARTED**

## Q: What are the prerequisites for running this bot?

**A:** To run the Polymarket-Copy-Trading-Bot, you will need the following installed on your system:
*   **Node.js**: The bot is a Node.js application.
*   **npm (Node Package Manager)**: This comes with Node.js and is used to install the project's dependencies, which are listed in the `package.json` file.
*   **TypeScript**: The project is written in TypeScript (`.ts` files) and will likely be compiled to JavaScript for execution. You'll need `tsc` (the TypeScript compiler) available, which is usually installed as a development dependency via npm.

---

## Q: How do I install the dependencies and configure the bot for the first time?

**A:**
1.  **Clone the Repository**: First, get a local copy of the codebase.
2.  **Install Dependencies**: Navigate to the root directory of the project in your terminal and run `npm install`. This will download all the necessary libraries defined in `package.json`.
3.  **Configure Environment**: The bot's configuration is managed through environment variables. The central configuration logic is in `src/config/env.ts`. You will need to create a `.env` file in the root directory and populate it with the required values, such as:
    *   `POLYGON_RPC_URL`: Your RPC endpoint for the Polygon network.
    *   `PRIVATE_KEY`: The private key of the wallet you'll be trading with. **(Warning: Handle with extreme care)**.
    *   `API_URL`: The Polymarket API endpoint.
    *   Risk parameters like `DAILY_LOSS_LIMIT_USD` and `MAX_POSITION_SIZE_USD`.

A typical `.env` file might look like this:
```env
# Wallet and Connection
PRIVATE_KEY="0x..."
POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/your-api-key"

# Polymarket API
API_URL="https://clob.polymarket.com"

# Risk Management
MAX_POSITION_SIZE_USD=25
DAILY_LOSS_LIMIT_USD=100
PAPER_TRADING_ENABLED=true
```

---

## Q: What's the main command to start the bot, and how do I verify it's working?

**A:** The primary entry point for the application is `src/index.ts`. While the specific script isn't detailed, you would typically start the bot using an npm script defined in `package.json`. Look for a script like `start` or `dev`.

You would run it with a command like:
```bash
npm run start
```
This command will likely compile the TypeScript to JavaScript (placing output in a `dist/` directory) and then execute the main file, `dist/index.js`.

To verify it's working, monitor the console output. The application uses a logger (likely defined in `src/utils`) to output its status. You should see messages indicating:
*   Successful configuration loading from `src/config/env.ts`.
*   Initialization of key modules like `MarketScanner`, `OrderManager`, and `RiskManager`.
*   Confirmation of a successful connection to the Polymarket API WebSocket (managed by `src/api/polymarket.ts`).
*   Logs from the `MarketScanner` as it begins to scan and analyze markets.

---

### **USAGE**

## Q: The repository is named "Copy-Trading-Bot," but the analysis says it uses algorithmic strategies. How does it actually trade?

**A:** This is a key point of clarification. Despite the repository's name, the implemented logic does **not** perform copy trading (i.e., mirroring another wallet's trades). The codebase is built around independent, algorithmic trading strategies.

The core trading logic resides in the `src/strategy/` directory. For example, the `src/strategy/spreadArb.ts` file implements a spread arbitrage strategy that looks for price discrepancies in the order book. The `MarketScanner` in `src/market/marketScanner.ts` finds potential markets, and then the active strategy generates trade signals, which are passed to the `OrderManager` for execution. The name suggests an initial or intended feature that was not implemented in the analyzed version of the code.

---

## Q: How do I configure the bot's core settings, like API keys and risk parameters?

**A:** All core configuration is handled through environment variables, which are loaded and validated by the `src/config/env.ts` module. To configure the bot, you must create a `.env` file in the project's root directory.

Key settings you'll need to configure include:
*   **Wallet/API Credentials**: `PRIVATE_KEY`, `POLYGON_RPC_URL`.
*   **Trading Mode**: A setting like `PAPER_TRADING_ENABLED` to switch between simulated and live trading.
*   **Risk Controls**: Critical parameters managed by the `RiskManager` class (`src/trader/riskManager.ts`), such as:
    *   `DAILY_LOSS_LIMIT_USD`: A circuit breaker to stop trading if losses exceed this amount in a day.
    *   `MAX_POSITION_SIZE_USD`: The maximum capital to allocate to a single position.
    *   `MIN_SPREAD_BPS`: The minimum bid-ask spread required for the `spreadArb` strategy to consider a trade.

---

## Q: What is the typical workflow of the bot from scanning markets to placing an order?

**A:** The bot operates in a continuous, event-driven loop orchestrated by the main class in `src/index.ts`. The workflow is as follows:

1.  **Initialization**: `src/index.ts` starts the bot, loading configuration from `src/config/env.ts` and initializing all modules.
2.  **Market Scanning**: The `MarketScanner` (`src/market/marketScanner.ts`) periodically fetches or subscribes to a list of active markets from the Polymarket API.
3.  **Data Analysis**: For each market, it analyzes the real-time order book data received via WebSockets (managed by `src/api/polymarket.ts`).
4.  **Signal Generation**: The scanner emits a `scanComplete` event. A strategy module, such as `spreadArb.ts` from the `src/strategy/` directory, listens for this event. It evaluates the market data against its logic to identify a trading opportunity (a "signal").
5.  **Risk Assessment**: The generated signal is passed to the `RiskManager` (`src/trader/riskManager.ts`), which checks it against pre-configured rules (e.g., daily loss limit, max position size).
6.  **Order Execution**: If the signal passes the risk checks, the `OrderManager` (`src/trader/orderManager.ts`) is called to construct and place a limit order on Polymarket via the API layer.
7.  **Position Management**: The `OrderManager` and `PositionManager` monitor the order's status. If an order is filled (communicated via an `orderFill` event), the `PositionManager` (`src/trader/positionManager.ts`) updates the bot's portfolio.

---

### **ARCHITECTURE**

## Q: How is the codebase organized? What is the overall architecture?

**A:** The codebase follows a **layered modular monolith** architecture. It runs as a single Node.js process but is internally organized into distinct, loosely-coupled modules with clear responsibilities.

The main directories and their roles are:
*   **`src/api/`**: Handles all low-level communication with the Polymarket API, abstracting away REST and WebSocket interactions. See `polymarket.ts`.
*   **`src/market/`**: Responsible for discovering, filtering, and analyzing markets. The `MarketScanner` is the key class here.
*   **`src/strategy/`**: Contains the business logic for trading. It includes a `baseStrategy.ts` for creating new strategies and specific implementations like `spreadArb.ts`.
*   **`src/trader/`**: Manages the execution lifecycle, including order placement (`OrderManager`), position tracking (`PositionManager`), and risk controls (`RiskManager`).
*   **`src/config/`**: Centralizes configuration management by loading and validating environment variables (`env.ts`).
*   **`src/utils/`**: Provides shared utilities, such as the logger and the `MathUtils` class.
*   **`src/index.ts`**: The top-level orchestrator that initializes all modules and starts the trading loop.

---

## Q: How do the different components interact with each other?

**A:** The components interact primarily through an **Observer pattern**, using Node.js's built-in `EventEmitter`. This promotes loose coupling, as modules don't need direct references to each other; they just emit and listen for named events.

For example:
*   The `MarketScanner` emits a `scanComplete` event when it has fresh market data. The active strategy listens for this to begin its analysis.
*   The `OrderManager` extends `EventEmitter` and emits events like `orderFill` or `orderCancelled`. The `PositionManager` listens for these events to update its state without being directly called by the `OrderManager`.

This event-driven flow starts in `src/index.ts`, which wires up the listeners and kicks off the initial process (e.g., telling the `MarketScanner` to start scanning).

---

### **TROUBLESHOOTING**

## Q: My bot isn't placing any trades. What are the first things I should check?

**A:** If the bot is running but not trading, here is a checklist of common issues:
1.  **Check the Logs**: The console output is your primary diagnostic tool. Look for error messages related to API connections, invalid configurations, or strategy logic.
2.  **Verify `.env` Configuration**:
    *   Are your `PRIVATE_KEY` and `POLYGON_RPC_URL` correct? Incorrect credentials will prevent any on-chain transactions.
    *   Is `PAPER_TRADING_ENABLED` set to your desired mode?
3.  **Review Risk Parameters**: Your risk settings in `.env`, managed by `src/trader/riskManager.ts`, might be too restrictive. Check if `MAX_POSITION_SIZE_USD` is too low or if the `DAILY_LOSS_LIMIT_USD` has already been hit.
4.  **Check Strategy Conditions**: The market conditions may not be meeting the criteria for your active strategy. For the `spreadArb` strategy, the bid-ask spread on available markets might be smaller than your configured `MIN_SPREAD_BPS`.
5.  **API Connectivity**: Ensure there are no errors from `src/api/polymarket.ts` indicating a failure to connect to the WebSocket or REST endpoints.

---

## Q: Where can I find logs or other diagnostic information to debug issues?

**A:** The application does not write to log files by default; its "presentation layer" is the **console (standard output)**. The logger utility, likely defined in `src/utils`, prints all operational messages, status updates, trades, and errors directly to the terminal where you launched the bot.

To debug, carefully read the console output from the moment you start the application. It provides a real-time narrative of the bot's actions, from initializing modules to scanning markets and evaluating trade signals. Any exceptions or failures will be printed there.

---

### **ADVANCED**

## Q: How do I create and add my own custom trading strategy?

**A:** The architecture is designed to be extensible, particularly for strategies. The key is the `src/strategy/baseStrategy.ts` file, which provides an abstract base class.

Here is the process:
1.  **Create a New Strategy File**: In the `src/strategy/` directory, create a new file (e.g., `myMomentumStrategy.ts`).
2.  **Extend `BaseStrategy`**: Inside your new file, create a class that extends the `BaseStrategy` class.
    ```typescript
    // src/strategy/myMomentumStrategy.ts
    import { BaseStrategy } from './baseStrategy';
    import { TradeSignal } from '../types'; // Assuming a type definition exists

    export class MyMomentumStrategy extends BaseStrategy {
      // Implement the required abstract methods from BaseStrategy
      public evaluate(marketData: any): TradeSignal | null {
        // Your custom logic here to analyze market data
        // and return a TradeSignal or null if no opportunity exists.
        console.log('Evaluating market with momentum strategy...');
        // ...
        return null; // or return a valid signal
      }
    }
    ```
3.  **Integrate the Strategy**: In the main orchestrator file, `src/index.ts`, you will need to instantiate your new strategy. The system likely uses a Factory pattern or a simple conditional to select the active strategy based on the configuration. You would modify this logic to include and select your `MyMomentumStrategy`.

---

## Q: What are the performance considerations for running this bot?

**A:** As a real-time trading bot, performance is critical. Key considerations include:
*   **Network Latency**: The bot relies on a WebSocket connection managed by `src/api/polymarket.ts` for real-time order book data. A stable, low-latency internet connection is crucial to act on market opportunities quickly.
*   **Single-Threaded Nature of Node.js**: Node.js runs on a single thread using an event loop. Any long-running, synchronous (blocking) computation in your strategy's `evaluate` method will freeze the entire application, causing it to miss new market data and opportunities. All custom logic should be written asynchronously (`async/await`) to avoid blocking the event loop.
*   **RPC Node Performance**: The bot interacts with the Polygon blockchain via an RPC node specified in your `.env` file. A slow or unreliable RPC node can cause delays or failures in transaction submission when placing orders. Using a high-quality, dedicated RPC provider is recommended for live trading.

---

*This FAQ was generated automatically based on code analysis. For the most up-to-date information, refer to the source code and inline documentation.*
