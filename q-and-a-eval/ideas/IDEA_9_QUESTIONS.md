# Technical Questions: Outcome Hedger for Polymarket

## Polymarket API and Data Access

1. What endpoints does the Polymarket API provide for retrieving a user's current positions across all markets, and what authentication method is required?

2. Does Polymarket expose historical price data or OHLCV (Open/High/Low/Close/Volume) data via API that could be used to calculate correlation coefficients between markets?

3. What is the structure of Polymarket's market data model - how are related markets (e.g., markets about the same event with different outcomes) linked or tagged in the API response?

4. Are there API endpoints that provide market metadata or tags that could help identify potentially correlated markets (e.g., category, event type, underlying subject)?

5. What rate limits exist on Polymarket's API endpoints, and how would these constraints affect real-time monitoring of multiple correlated positions?

## Order Execution and Trading

6. Does Polymarket support batch order submission or atomic multi-leg order execution that would allow placing hedge trades across multiple markets simultaneously?

7. What is the latency profile of Polymarket's order placement API, and how does this impact the ability to execute time-sensitive hedge adjustments?

8. Does the Polymarket API support conditional or contingent orders that could automatically trigger hedge trades when certain price or position thresholds are reached?

9. What order types are available through Polymarket's API (market, limit, stop-loss, etc.) and which would be most appropriate for implementing hedge ratio rebalancing?

10. How does Polymarket handle partial fills, and what API mechanisms exist for tracking fill status across multiple concurrent hedge orders?

## Market Correlation and Data Modeling

11. Does Polymarket provide any native correlation data, market similarity scores, or related-market recommendations through their API?

12. What historical trade and price data granularity is available from Polymarket to compute rolling correlation windows between market pairs?

13. How are Polymarket markets identified - by unique IDs, contract addresses, or other identifiers - and how stable are these identifiers for building correlation mappings?

14. Does Polymarket expose order book depth data via API or WebSocket that could be used to assess liquidity when sizing hedge positions?

15. Are there API endpoints that surface market resolution dependencies or conditional relationships between markets that would indicate structural correlation?

## Position Management and Risk Monitoring

16. What real-time data feeds (WebSocket, streaming APIs) does Polymarket offer for monitoring position value changes and triggering hedge rebalancing?

17. How does the Polymarket API report unrealized P&L and position exposure - is this calculated server-side or must it be derived from raw position and price data?

18. What is the data format and update frequency for position snapshots from Polymarket's API?

19. Does Polymarket provide portfolio-level APIs that aggregate exposure across markets, or must position data be fetched market-by-market?

20. How does Polymarket handle market resolution in the API - what events or webhooks are available to detect when correlated markets resolve and hedge positions need adjustment?

## Technical Integration Considerations

21. What SDK libraries or client packages does Polymarket officially support, and do they include helper functions for multi-market operations?

22. Does Polymarket use an on-chain settlement model, and if so, what blockchain interactions are required for executing hedge trades programmatically?

23. What sandbox or testnet environment does Polymarket provide for testing hedge strategy execution without risking real funds?

24. Are there documented API error codes and retry strategies for handling failed hedge order submissions?

25. What authentication token lifecycle and refresh mechanisms does Polymarket's API use for long-running hedge monitoring services?
