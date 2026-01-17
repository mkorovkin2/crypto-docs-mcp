# Signal Composer - Technical Implementation Questions

## Polymarket API and Data Access

1. What REST API endpoints does Polymarket provide for retrieving historical price data, and what is the maximum time range and granularity (e.g., 1-minute, 5-minute candles) available for momentum calculations?

2. Does Polymarket offer a WebSocket API or Server-Sent Events (SSE) endpoint for real-time price and order book updates, and what is the message format and latency characteristics?

3. What volume data is available through Polymarket APIs - is there access to rolling 24-hour volume, per-market volume, or granular time-series volume data for volume-based indicators?

4. Are there rate limits on Polymarket API endpoints, and if so, what are the specific limits (requests per second/minute) for price history, market data, and order book endpoints?

5. Does Polymarket provide an authenticated API with higher rate limits or additional data access compared to public endpoints?

## Market Data and Metadata

6. What market metadata fields are available via the Polymarket API (e.g., market creation date, resolution date, category, liquidity metrics) that could be used to filter or weight signals?

7. How are market IDs structured in Polymarket, and is there an endpoint to retrieve all active markets or markets filtered by category/topic?

8. Does Polymarket expose order book depth data via API, and at what granularity (number of price levels, bid/ask sizes)?

9. What is the data format for price quotes on Polymarket - are prices returned as decimals (0.00-1.00), percentages, or some other format?

10. Are there API endpoints for retrieving historical trade/transaction data (individual fills) rather than just aggregated OHLCV data?

## Real-Time Data and Streaming

11. What is the typical latency between a trade occurring on Polymarket and that data being available via API (both REST polling and streaming if available)?

12. Does Polymarket use a specific blockchain (Polygon) for settlement, and is there a way to subscribe to on-chain events for the most real-time trade data?

13. Are there any third-party data providers or aggregators that offer Polymarket data with better streaming capabilities or historical data depth?

14. How does Polymarket handle market state changes (e.g., market paused, resolution pending) in their API responses, and are there webhooks or streaming notifications for these events?

## Sentiment and External Data Integration

15. Does Polymarket provide any sentiment-related data through their API, such as comment counts, social metrics, or trader positioning data?

16. Are there API endpoints for retrieving the number of unique traders, position sizes, or other crowd-sourced metrics that could inform sentiment indicators?

17. What external APIs or data sources are commonly used alongside Polymarket data for sentiment analysis (e.g., Twitter API, news APIs), and are there known correlation patterns?

## Technical Integration Details

18. What authentication mechanism does Polymarket use for API access - API keys, OAuth, or wallet-based signatures?

19. Does Polymarket have official SDKs or client libraries in common languages (Python, JavaScript, etc.) for API integration?

20. What is the recommended approach for maintaining persistent connections to Polymarket for a bot that needs continuous signal generation - polling intervals, connection pooling, or dedicated streaming?

21. Are there any known issues with Polymarket API data consistency, such as delayed updates, missing candles, or discrepancies between different endpoints?

22. Does Polymarket provide a sandbox or testnet environment for developing and testing trading bots without using real funds?

23. What are the specific CLOB (Central Limit Order Book) contract addresses and ABIs needed for direct on-chain interaction with Polymarket markets?

24. How does Polymarket handle market resolution in terms of API data - is historical data preserved post-resolution, and for how long?
