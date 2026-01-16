# Technical Questions: Slippage Estimator for Polymarket

## Polymarket API and Order Book Data

1. Does Polymarket provide a public API endpoint for retrieving order book depth data, and if so, what is the endpoint structure and authentication requirements?

2. What is the format of order book data returned by Polymarket's API (e.g., price levels, quantities, aggregation method)?

3. Does Polymarket offer WebSocket connections for real-time order book updates, or is polling the REST API the only option for obtaining current depth?

4. What rate limits does Polymarket impose on API requests for order book data, and how might this affect the frequency of slippage calculations?

5. Are there separate API endpoints for bid and ask sides of the order book, or is the data combined in a single response?

## Order Matching and Execution

6. How does Polymarket's order matching engine work - is it a standard price-time priority system, or does it use a different matching algorithm?

7. Does Polymarket use an on-chain order book (e.g., through CLOB on Polygon) or an off-chain matching system with on-chain settlement?

8. What is the typical latency between order submission and execution on Polymarket, and how does this affect slippage estimation accuracy?

9. Are there partial fill mechanisms on Polymarket, and how should slippage estimation account for orders that may be filled across multiple price levels?

10. Does Polymarket aggregate liquidity from multiple sources or market makers, and if so, how is this reflected in the order book data?

## Price Levels and Liquidity

11. What is the minimum tick size (price increment) on Polymarket markets, and how granular is the price level data in the order book?

12. How is liquidity typically distributed across price levels on Polymarket - are there concentrated bands or sparse distribution patterns?

13. Does Polymarket provide historical order book snapshots or depth data that could be used for backtesting slippage models?

14. Are there differences in order book depth data availability between binary outcome markets and multi-outcome markets on Polymarket?

15. How does Polymarket handle market prices near 0 or 1 (near-certainty outcomes) in terms of order book structure and available liquidity?

## Technical Integration Details

16. What SDK or client libraries does Polymarket provide for programmatic access to market data and order book information?

17. Does Polymarket use the CLOB (Central Limit Order Book) protocol, and if so, what are the specific contract addresses and ABI details needed for direct integration?

18. How are market IDs and condition IDs structured on Polymarket, and how do you map between human-readable market names and API identifiers?

19. What data fields are available for each order in the book (e.g., timestamp, order ID, maker address) that might be useful for advanced slippage analysis?

20. Does Polymarket's API differentiate between displayed liquidity and hidden/iceberg orders that might affect actual execution slippage?

## Real-Time Updates and Data Freshness

21. What is the update frequency of order book data through Polymarket's API or WebSocket feeds?

22. How does Polymarket handle order book state during periods of high volatility or significant news events affecting a market?

23. Is there a sequence number or versioning system for order book updates to ensure data consistency and detect missed updates?

24. What happens to outstanding orders when a market is paused or resolved - how should a slippage estimator handle these edge cases?

25. Does Polymarket provide any indication of pending orders or order flow that hasn't yet been matched but may impact near-term liquidity?
