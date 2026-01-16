# Technical Questions: Stake Size Optimizer for Polymarket

## API and Data Access

1. What endpoints does the Polymarket API provide for retrieving order book depth and liquidity data for a specific market?

2. Does the Polymarket API expose real-time order book snapshots, or is WebSocket streaming available for live bid/ask updates?

3. What is the rate limiting policy on Polymarket's API endpoints for order book and market data queries?

4. How can I programmatically retrieve my current positions, open orders, and available balance through the Polymarket API?

5. Is there an authenticated API endpoint that returns historical fill data for my account to analyze past execution quality?

## Liquidity and Market Depth

6. What data format does Polymarket use to represent order book depth (e.g., price levels, cumulative volume, number of orders at each level)?

7. Are there API endpoints that provide aggregated liquidity metrics such as total available volume within a specified price range?

8. How frequently is order book data updated on Polymarket, and what latency should I expect between market changes and API reflection?

9. Does Polymarket provide any built-in spread or slippage estimation metrics, or must these be calculated from raw order book data?

10. Is historical order book depth data available through the API for backtesting stake sizing algorithms?

## Price Impact and Execution

11. Does Polymarket offer any price impact estimation endpoints, or must price impact be calculated manually by walking the order book?

12. What is the minimum order size and tick size on Polymarket markets, and how do these constraints affect stake sizing calculations?

13. How does Polymarket handle partial fills, and what API data is available to track fill rates for large orders?

14. Are there any API fields that indicate market volatility or recent price movement that could inform dynamic stake sizing?

15. Does Polymarket provide any maker/taker fee information through the API that should be factored into optimal stake calculations?

## Technical Integration

16. What authentication method does Polymarket use for private API endpoints (API keys, OAuth, wallet signatures)?

17. Is there a sandbox or testnet environment available for testing stake sizing algorithms without risking real capital?

18. What SDK libraries or client packages are officially supported for interacting with Polymarket's API?

19. How does Polymarket represent market identifiers (condition IDs, token IDs), and how do I map between human-readable markets and API identifiers?

20. Are there webhook or push notification mechanisms available to alert when liquidity conditions change significantly in monitored markets?

## Risk Model Considerations

21. Does Polymarket expose any data on market resolution timelines or expiration dates that should factor into position sizing?

22. What information is available through the API about counterparty distribution or concentration of liquidity providers in a market?

23. Are there any API endpoints that provide information about related or correlated markets for portfolio-level risk calculations?

24. How can I retrieve the total market volume and open interest to assess overall market health for sizing decisions?

25. Does Polymarket provide any circuit breaker or trading halt information through the API that could affect execution of sized orders?
