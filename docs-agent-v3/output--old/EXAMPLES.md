# Code Examples

This document contains practical code examples for using this codebase.

## Table of Contents

1. [Quick Start](#quick-start)
2. [API Usage](#api-usage)
3. [Error Handling](#error-handling)
4. [Configuration](#configuration)
5. [](#)

---

## Quick Start

Minimal example to get started with the library

**Prerequisites:**
- Install dependencies
- Configure environment

```javascript
// Quick start example
import { MainClass } from './src/main';

async function main() {
    // Initialize
    const instance = new MainClass();

    // Basic usage
    const result = await instance.process('example input');

    console.log(result);
}

main().catch(console.error);

```

**Related files:**
- `dist/index.js`
- `src/index.ts`

---

## API Usage

Example demonstrating the main API

```javascript
// API Usage Example
// Import the main class
// const { MainClass } = require('./src/main');

// Create instance and use API
// const instance = new MainClass();
// const result = instance.someMethod(params);

```

**Related files:**
- `src/trader/riskManager.ts`
- `src/trader/positionManager.ts`

---

## Error Handling

Demonstrates proper error handling patterns

```javascript
// Error Handling Example
async function safeOperation() {
    try {
        const result = await riskyOperation();
        return result;
    } catch (error) {
        if (error instanceof ValidationError) {
            console.error('Validation failed:', error.message);
            return null;
        }
        throw error; // Re-throw unexpected errors
    } finally {
        // Cleanup
    }
}

```

---

## Configuration

Shows how to configure the application

**Prerequisites:**
- Set environment variables

```javascript
// Configuration Example
const config = {
    apiKey: process.env.API_KEY,
    baseUrl: process.env.BASE_URL || 'https://api.example.com',
    timeout: parseInt(process.env.TIMEOUT || '30'),
    debug: process.env.DEBUG === 'true',
};

// Validate required config
if (!config.apiKey) {
    throw new Error('API_KEY environment variable is required');
}

export default config;

```

---

## 

if (!response.ok) {
        throw new Error(`External API error: ${response.statusText}`);
      }

      const data: ExternalMarketData = await response.json();
      
      // Cache the data for later reference
      this.externalDataCache.set(marketId, data);
      
      logger.info(`Fetched external data for market ${marketId}`, {
        confidence: data.confidence,
        signal: data.signal,
        predictedPrice: data.predictedPrice,
      });

      return data;
    } catch (error) {
      logger.error(`Failed to fetch external data for ${marketId}`, error);
      throw error;
    }
  }

  /**
   * Execute trade based on combined internal and external signals
   */
  async executeTradingDecision(
    marketId: string,
    currentPrice: number,
    maxRiskPerTrade: number
  ): Promise<void> {
    try {
      // Step 1: Get external market data
      const externalData = await this.fetchExternalMarketData(marketId);

      // Step 2: Validate confidence threshold
      if (externalData.confidence < this.minConfidenceThreshold) {
        logger.warn(
          `Skipping trade: confidence ${externalData.confidence} below threshold ${this.minConfidenceThreshold}`
        );
        return;
      }

      // Step 3: Calculate position size using risk management
      const positionSize = this.calculatePositionSize(
        currentPrice,
        externalData.predictedPrice,
        maxRiskPerTrade
      );

      // Step 4: Check risk limits before proceeding
      const riskCheck = this.riskManager.validateRisk({
        marketId,
        positionSize,
        entryPrice: currentPrice,
        maxLoss: maxRiskPerTrade,
      });

      if (!riskCheck.isValid) {
        logger.warn(`Risk check failed: ${riskCheck.reason}`);
        return;
      }

      // Step 5: Execute order based on signal
      if (externalData.signal === 'BUY') {
        await this.executeBuyOrder(
          marketId,
          positionSize,
          currentPrice,
          externalData
        );
      } else if (externalData.signal === 'SELL') {
        await this.executeSellOrder(
          marketId,
          positionSize,
          currentPrice,
          externalData
        );
      } else {
        logger.info(`Holding position for market ${marketId}`);
      }
    } catch (error) {
      logger.error(`Error executing trading decision for ${marketId}`, error);
      throw error;
    }
  }

  /**
   * Calculate optimal position size based on risk parameters
   */
  private calculatePositionSize(
    currentPrice: number,
    predictedPrice: number,
    maxRiskPerTrade: number
  ): number {
    // Calculate potential profit/loss
    const priceMovement = Math.abs(predictedPrice - currentPrice);
    const percentageMove = MathUtils.calculatePercentageChange(
      currentPrice,
      predictedPrice
    );

    // Use Kelly Criterion for position sizing (simplified)
    const winProbability = 0.55; // Assume 55% win rate
    const riskRewardRatio = percentageMove / (percentageMove * 0.5); // 2:1 risk/reward

    const kellyFraction =
      (winProbability * riskRewardRatio - (1 - winProbability)) /
      riskRewardRatio;

    // Cap at 25% of Kelly to be conservative
    const conservativeKelly = Math.max(0.01, Math.min(kellyFraction * 0.25, 0.1));

    // Calculate position size based on max risk
    const positionSize = (maxRiskPerTrade / priceMovement) * conservativeKelly;

    logger.debug(`Calculated position size: ${positionSize}`, {
      percentageMove,
      kellyFraction,
      conservativeKelly,
    });

    return positionSize;
  }

  /**
   * Execute a buy order with external data context
   */
  private async executeBuyOrder(
    marketId: string,
    positionSize: number,
    currentPrice: number,
    externalData: ExternalMarketData
  ): Promise<void> {
    try {
      const order = {
        marketId,
        side: 'BUY' as const,
        size: positionSize,
        price: currentPrice,
        metadata: {
          externalSignal: externalData.signal,
          externalConfidence: externalData.confidence,
          predictedPrice: externalData.predictedPrice,
          timestamp: new Date().toISOString(),
        },
      };

      logger.info(`Executing BUY order`, order);

      // Place order through order manager
      const result = await this.orderManager.placeOrder(order);

      logger.info(`Order executed successfully`, {
        orderId: result.orderId,
        filledSize: result.filledSize,
      });
    } catch (error) {
      logger.error(`Failed to execute BUY order for ${marketId}`, error);
      throw error;
    }
  }

  /**
   * Execute a sell order with external data context
   */
  private async executeSellOrder(
    marketId: string,
    positionSize: number,
    currentPrice: number,
    externalData: ExternalMarketData
  ): Promise<void> {
    try {
      const order = {
        marketId,
        side: 'SELL' as const,
        size: positionSize,
        price: currentPrice,
        metadata: {
          externalSignal: externalData.signal,
          externalConfidence: externalData.confidence,
          predictedPrice: externalData.predictedPrice,
          timestamp: new Date().toISOString(),
        },
      };

      logger.info(`Executing SELL order`, order);

      const result = await this.orderManager.placeOrder(order);

      logger.info(`Order executed successfully`, {
        orderId: result.orderId,
        filledSize: result.filledSize,
      });
    } catch (error) {
      logger.error(`Failed to execute SELL order for ${marketId}`, error);
      throw error;
    }
  }

  /**
   * Get cached external data for a market
   */
  getCachedData(marketId: string): ExternalMarketData | undefined {
    return this.externalDataCache.get(marketId);
  }

  /**
   * Update confidence threshold for signal filtering
   */
  setConfidenceThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
    this.minConfidenceThreshold = threshold;
    logger.info(`Updated confidence threshold to ${threshold}`);
  }
}

/**
 * Usage example
 */
async function main() {
  try {
    // Initialize bot and managers
    const bot = new PolymarketTradingBot();
    const riskManager = new RiskManager();
    const orderManager = new OrderManager();

    // Create integration service
    const integrationService = new ExternalDataIntegrationService(
      bot,
      riskManager,
      orderManager
    );

    // Set custom confidence threshold
    integrationService.setConfidenceThreshold(0.8);

    // Example: Execute trading decision for a market
    const marketId = '0x123abc...'; // Polymarket market ID
    const currentPrice = 0.45;
    const maxRiskPerTrade = 100; // $100 max risk per trade

    await integrationService.executeTradingDecision(
      marketId,
      currentPrice,
      maxRiskPerTrade
    );

    // Retrieve cached data
    const cachedData = integrationService.getCachedData(marketId);
    if (cachedData) {
      console.log('Cached external data:', cachedData);
    }
  } catch (error) {
    logger.error('Integration example failed', error);
    process.exit(1);
  }
}

// Run the example
main();

```javascript
---

## Example 2: Advanced Multi-Market Portfolio Management with Dynamic Risk Adjustment

**Description:** This advanced example demonstrates how to manage a portfolio of multiple Polymarket positions simultaneously, with dynamic risk adjustment based on portfolio performance, correlation analysis, and real-time market conditions. This showcases complex features like position tracking, portfolio-level risk management, and automated rebalancing.
```

---

