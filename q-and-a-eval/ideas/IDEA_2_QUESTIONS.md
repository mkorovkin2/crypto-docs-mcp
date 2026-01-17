# Technical Questions: Market Maker Simulator for Polymarket

## Polymarket API and Data Access

1. What API endpoints does Polymarket provide for retrieving real-time order book data, and what are the rate limits associated with these endpoints?

2. Does Polymarket offer a WebSocket API for streaming live order book updates, trade executions, and market events? If so, what is the connection protocol and message format?

3. What authentication mechanisms are required to access Polymarket's trading APIs (API keys, OAuth, wallet signatures)?

4. Is there a dedicated historical data API or data export service for accessing past order book snapshots, trade history, and market prices?

5. Does Polymarket provide a sandbox or testnet environment for testing market-making strategies without risking real funds?

## Order Book and Market Structure

6. What is the structure of Polymarket's order book? Is it a central limit order book (CLOB), and how are orders matched (price-time priority, pro-rata)?

7. What is the minimum tick size (price increment) for markets on Polymarket, and does this vary by market type?

8. What is the minimum order size, and are there maximum position limits that would affect a market-making strategy?

9. How does Polymarket handle order types—are limit orders, market orders, and IOC (immediate-or-cancel) orders all supported?

10. What are the trading fees on Polymarket, and how are they structured (maker/taker fee model, flat fees, or percentage-based)?

## Data Formats and Schemas

11. What is the JSON schema for order book data returned by Polymarket APIs, including bid/ask levels, quantities, and timestamps?

12. How are orders represented in the API response—what fields are included (order ID, price, size, side, status, timestamp, etc.)?

13. How are trade fills represented in the API, and what information is available about partial fills versus complete fills?

14. What format does Polymarket use for market identifiers (condition IDs, token IDs, market slugs), and how do these relate to each other?

15. How are prices represented—as decimals, basis points, or some other format? What precision is used?

## Historical Data and Replay

16. What historical data granularity is available (tick-by-tick, minute bars, hourly OHLCV)? How far back does historical data extend?

17. Are historical order book snapshots (L2 or L3 data) available, or only trade/price history?

18. What is the format for timestamps in Polymarket data—Unix epoch milliseconds, ISO 8601, or another format?

19. Is there a bulk data download option or data archive for historical market data suitable for backtesting?

20. How can I access the sequence of order book events (new orders, cancellations, modifications) for accurate historical replay?

## Market Information and Metadata

21. What API endpoint provides the list of all active markets, and what metadata is included (market title, description, resolution criteria, expiration date)?

22. How are binary markets versus multi-outcome markets represented differently in the API?

23. What information is available about market liquidity, trading volume, and open interest through the API?

24. How does Polymarket represent market resolution status, and what events or webhooks indicate when a market resolves?

25. Are there API fields indicating market creation time, last trade time, and market lifecycle state?

## Blockchain and Settlement Integration

26. What blockchain does Polymarket use for settlement, and how do on-chain positions relate to API-reported positions?

27. How are USDC deposits, withdrawals, and collateral management handled through the API?

28. What is the relationship between the CLOB API and on-chain order settlement—are fills settled immediately on-chain or batched?

29. How can I query my current inventory/positions across all markets through the API?

30. What contract addresses and ABIs are needed if direct smart contract interaction is required for position management?

## Performance and Reliability

31. What is the typical latency for order submission and order book updates through Polymarket's API?

32. Are there documented uptime SLAs or status pages for monitoring API availability?

33. How does Polymarket handle API versioning, and what is the deprecation policy for older endpoints?

34. What error codes and rate limit responses should a market maker expect and handle gracefully?

35. Is there documentation on reconnection strategies for WebSocket connections and handling of missed messages?
