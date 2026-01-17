# src.trader

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

