# src.utils

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

