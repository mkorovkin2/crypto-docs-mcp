# Technical Implementation Questions: Scenario Stress Tester (Idea 28)

## Polymarket API Access and Documentation

1. What endpoints does the Polymarket API provide for retrieving current market prices, and what is the rate limiting policy for frequent price polling during stress simulations?

2. Does Polymarket offer a WebSocket API for real-time price streaming, or must stress testing rely on REST polling for live market data?

3. What authentication mechanism does Polymarket use for API access, and are there different permission tiers that affect access to order book or liquidity data?

4. Is there official Polymarket API documentation available, and does it specify data formats, error codes, and response schemas for market data endpoints?

## Position and Portfolio Data Access

5. How can a user's current positions be retrieved programmatically from Polymarket—is there a dedicated portfolio endpoint or must positions be derived from on-chain transaction history?

6. Does Polymarket provide an API endpoint that returns position entry prices, unrealized P&L, or only current share quantities?

7. For multi-market portfolios, is there a batch endpoint to retrieve positions across all markets simultaneously, or must each market be queried individually?

8. How does Polymarket handle conditional token positions in the API response—are YES and NO shares reported separately or as net positions?

## Liquidity and Order Book Depth Data

9. Does Polymarket expose order book depth data through its API, including bid/ask quantities at various price levels for stress testing liquidity impact?

10. What granularity of liquidity data is available—can we access the full order book or only top-of-book best bid/ask prices?

11. Is there an API endpoint that provides historical liquidity snapshots, or must liquidity depth be captured and stored independently over time?

12. How does Polymarket's CLOB (Central Limit Order Book) system report available liquidity, and what fields indicate potential slippage for large hypothetical orders?

13. Does the API provide any measure of market depth or liquidity score that could be used to model liquidity shocks in stress scenarios?

## Historical Volatility and Price Data

14. What historical price data does Polymarket provide through its API—is there access to OHLCV (Open, High, Low, Close, Volume) candles or only trade-by-trade data?

15. What is the maximum historical lookback period available for market price data, and at what time resolution (tick, minute, hourly, daily)?

16. Does Polymarket provide pre-calculated volatility metrics, or must historical volatility be computed from raw price history?

17. How can historical trade volume data be accessed to model volume-based stress scenarios and liquidity regime changes?

18. Is there an endpoint for retrieving historical spreads between bid and ask prices to model spread widening during stress events?

## Price Correlation and Multi-Market Data

19. Does Polymarket provide any correlation data or grouping information between related markets (e.g., multiple markets on the same event category)?

20. How are related markets identified in the API—is there a category, tag, or event grouping field that could be used to find correlated positions?

21. Can multiple markets be queried in a single API call for efficient correlation analysis, or must each market's data be fetched separately?

22. Does Polymarket expose any metadata about market relationships (e.g., mutually exclusive outcomes, conditional dependencies) that would affect stress correlation modeling?

## On-Chain and Settlement Considerations

23. Since Polymarket uses Polygon for settlement, what on-chain data sources should be used to verify positions and reconcile with API data for accurate stress testing?

24. What is the contract address structure for Polymarket conditional tokens, and how can positions be verified directly on-chain as a backup to API data?

25. How does Polymarket handle market resolution in the API, and how should a stress tester account for markets approaching resolution with collapsing probability ranges?

## Simulation and Hypothetical Order Execution

26. Does Polymarket provide any sandbox or testnet environment where hypothetical stress scenarios could be simulated without real capital?

27. Is there an API endpoint that can estimate execution price and slippage for a hypothetical order size without actually placing the order?

28. How should simulated price shocks be bounded—does Polymarket enforce any price limits (e.g., prices must stay between 0 and 1) that constrain stress scenarios?

29. What happens to order book state during periods of high volatility—does Polymarket provide any circuit breaker or trading halt information via API?

## Data Freshness and Reliability

30. What is the typical latency for Polymarket API price data, and how should a stress tester account for data staleness in rapid shock scenarios?

31. Does Polymarket provide any data quality indicators, timestamps, or sequence numbers to detect stale or out-of-order market data?

32. How should the stress tester handle API downtime or partial data availability—are there redundant data sources or fallback mechanisms recommended by Polymarket?
