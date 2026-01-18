# src.trader

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

