# Technical Questions: Volatility Scanner for Polymarket

## API Access and Data Availability

1. Does Polymarket provide a public REST API for accessing market data, and what are the authentication requirements (API keys, OAuth, etc.)?

2. Is there a WebSocket or streaming API available for receiving real-time price updates, or must price data be polled at intervals?

3. What is the rate limiting policy for Polymarket's API endpoints, and how many requests per second/minute are permitted?

4. Does Polymarket expose historical price/tick data through their API, or is only current market state available?

## Price Data and Granularity

5. What is the granularity of price tick data available from Polymarket (e.g., every trade, 1-second intervals, 1-minute candles)?

6. How far back does historical price data extend for active markets, and is there an archival data source for older markets?

7. Are OHLCV (Open, High, Low, Close, Volume) candles provided natively by the API, or must they be computed from raw trade data?

8. What timestamp precision is provided with price data (milliseconds, seconds), and what timezone is used?

9. Is there a way to query the order book depth/snapshots to calculate bid-ask spread volatility in addition to price volatility?

## Real-Time Streaming

10. If WebSocket streaming is available, what is the message format for price updates (JSON schema, protobuf, etc.)?

11. What is the typical latency between a trade execution on Polymarket and its appearance in the streaming API?

12. Are there separate streams for different data types (trades, order book updates, market metadata), or is everything multiplexed?

13. How does the streaming API handle reconnection and missed messages during brief disconnections?

## Trading and Probe Positions

14. What is the minimum order size (in USDC or shares) allowed on Polymarket for placing probe positions?

15. Does Polymarket charge fees on trades, and if so, what is the fee structure (maker/taker fees, percentage or flat)?

16. What order types are supported via the API (market orders, limit orders, IOC, FOK)?

17. Is there a sandbox/testnet environment available for testing probe position logic without risking real funds?

18. What are the smart contract addresses and ABIs needed if direct on-chain interaction is required for placing orders?

## Market Identification and Metadata

19. How are markets uniquely identified in the API (market ID format, contract address, slug)?

20. Is there an endpoint to list all active markets with their current liquidity/volume metrics for scanning purposes?

21. How can newly created markets be detected programmatically for early volatility monitoring?

22. What metadata is available for each market (creation time, resolution time, category, total volume traded)?

## Infrastructure Considerations

23. Does Polymarket use the Polygon network, and if so, what are the RPC endpoint recommendations for reliable data access?

24. Are there any official SDKs or client libraries (Python, JavaScript, etc.) for interacting with Polymarket's API?

25. Is there documentation on the CLOB (Central Limit Order Book) hybrid architecture and how it affects data availability?

26. What blockchain indexing solutions (The Graph subgraphs, custom indexers) are available for querying Polymarket's on-chain data?
