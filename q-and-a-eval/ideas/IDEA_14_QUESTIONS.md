# Technical Questions: Confidence Interval Analyzer for Polymarket

## Polymarket API and Data Access

1. Does Polymarket provide a public REST API or GraphQL endpoint for accessing historical price data, and what authentication methods are required?

2. What is the finest granularity of price data available through Polymarket's APIs (tick-by-tick, minute, hourly, daily)?

3. Are there rate limits on Polymarket's data endpoints, and if so, what are the specific thresholds for historical data queries?

4. Does Polymarket offer WebSocket connections for real-time price streaming, and what is the message format for price updates?

## Historical Price and Volume Data

5. How far back does Polymarket retain historical price data for resolved and active markets?

6. What specific fields are included in Polymarket's price history responses (timestamp, bid, ask, mid-price, spread)?

7. Does Polymarket provide volume data at the same granularity as price data, or is volume aggregated differently?

8. Are there separate endpoints for order book depth versus executed trade volume on Polymarket?

9. Does Polymarket expose the number of unique traders or positions alongside volume metrics?

## Statistical and Market Metadata

10. Does Polymarket provide any pre-computed volatility or statistical measures through their API?

11. What metadata is available for each market (creation date, resolution criteria, liquidity provider information)?

12. Are there endpoints to retrieve the full order book state at historical points in time, or only current snapshots?

13. Does Polymarket expose bid-ask spread history, which could be used to infer market uncertainty?

14. Is there an API endpoint that provides market liquidity metrics or depth-of-book statistics?

## Data Pipeline Considerations

15. Does Polymarket use CLOB (Central Limit Order Book) data that can be accessed programmatically for tick-level analysis?

16. What is the latency typically observed when polling Polymarket's price endpoints versus using streaming connections?

17. Are there bulk export options or data dumps available from Polymarket for building historical datasets?

18. Does Polymarket's API provide event-level data that correlates price movements with external news or market events?

19. What format does Polymarket use for timestamps in their API responses (Unix epoch, ISO 8601)?

## Integration and Infrastructure

20. Does Polymarket have official SDKs or client libraries for Python, JavaScript, or other languages that facilitate data retrieval?

21. Are there known third-party data providers or aggregators that offer Polymarket data with additional statistical preprocessing?

22. Does Polymarket provide sandbox or testnet environments for developing data pipelines without affecting production queries?

23. What is the typical payload size for historical price queries, and are there pagination mechanisms for large date ranges?

24. Does Polymarket document any specific data schema versioning that would affect backward compatibility of data pipelines?
