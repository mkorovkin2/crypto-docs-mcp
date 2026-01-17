# Technical Questions: Liquidity Health Dashboard for Polymarket

## Polymarket API Access and Authentication

1. What authentication mechanism does Polymarket use for API access (API keys, OAuth, wallet signatures)?
2. Are there separate API endpoints for public market data versus authenticated trading operations?
3. What are the rate limits imposed on Polymarket API endpoints for data retrieval?
4. Does Polymarket provide a WebSocket API for real-time data streaming, or is polling the only option?

## Volume Data Access

5. Which Polymarket API endpoint exposes trading volume data for individual markets?
6. Is volume data available at different granularities (hourly, daily, weekly aggregates)?
7. Does the API provide volume broken down by buy/sell side, or only total volume?
8. How is volume reported for CLOB (Central Limit Order Book) markets versus AMM-based markets on Polymarket?
9. Is there a way to retrieve volume data for all markets in a single bulk API call?

## Orderbook Depth Data

10. Does Polymarket expose raw orderbook data through their public API?
11. What is the format of orderbook snapshots returned by the API (price levels, aggregated depth)?
12. How many price levels of depth are available in orderbook API responses?
13. Is there a WebSocket feed for orderbook updates (deltas) or only full snapshots?
14. How frequently is orderbook data updated on the API side?

## Spread Calculation

15. Does the Polymarket API directly provide bid-ask spread values, or must they be calculated from orderbook data?
16. How should spread be calculated for markets with thin liquidity or empty orderbooks?
17. Are there multiple orderbooks per market (e.g., YES and NO tokens), and how does this affect spread calculation?
18. What price format does Polymarket use (decimal probability, basis points, other)?

## Historical vs Real-Time Data

19. Does Polymarket provide historical orderbook snapshots, or only current state?
20. What historical trade data is available through the API (individual trades, OHLCV candles)?
21. How far back does historical data extend for volume and trading activity?
22. Is there a separate historical data API or data warehouse for backtesting and analysis?
23. What is the latency of "real-time" data from Polymarket APIs?

## Bulk Data Retrieval

24. Is there a paginated endpoint to retrieve all active markets and their metadata?
25. What is the maximum number of markets that can be queried in a single API request?
26. Does Polymarket offer data export functionality or downloadable datasets?
27. Are there GraphQL endpoints available for flexible bulk queries?
28. How should large-scale data ingestion be handled to avoid rate limiting?

## Polymarket-Specific Integration Details

29. How does Polymarket's CLOB system (built on Polygon) affect data access patterns?
30. Are there on-chain data sources (subgraphs, event logs) that complement the REST API for liquidity data?
31. Does Polymarket use the 0x protocol or a custom matching engine, and how does this impact data structure?
32. How are market resolution and settlement handled in the API responses?
33. What is the relationship between Polymarket's conditional token framework and liquidity metrics?
34. Are there known third-party data providers or aggregators that offer Polymarket liquidity data?
35. How should the dashboard handle markets with different token structures (binary vs multi-outcome)?
