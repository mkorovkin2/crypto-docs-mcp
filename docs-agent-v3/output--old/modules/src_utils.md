# src.utils

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

