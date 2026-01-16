# Technical Questions: Historical Data Downloader for Polymarket

## API Endpoints and Data Access

1. What are the specific REST API endpoints for accessing historical trade data on Polymarket, and what authentication methods are required?

2. Does Polymarket provide a dedicated historical data API, or must historical data be reconstructed from real-time event streams?

3. What is the base URL for Polymarket's CLOB (Central Limit Order Book) API, and are there separate endpoints for production vs. testnet environments?

4. Does Polymarket offer WebSocket connections for real-time order book updates, and if so, what is the message format and subscription protocol?

5. Are there bulk export endpoints available for downloading large datasets, or is pagination through individual API calls the only method?

## Order Book Data

6. Does Polymarket provide historical order book snapshots, or only real-time order book state?

7. What is the depth of order book data available through the API (e.g., top 10 levels, full depth)?

8. How frequently can order book snapshots be captured without hitting rate limits?

9. What data fields are included in order book responses (price, size, side, timestamp, order IDs)?

10. Is Level 3 order book data (individual orders) available, or only Level 2 aggregated data?

## Trade History

11. What is the maximum time range that can be queried in a single trade history API request?

12. What pagination mechanisms does Polymarket use for trade history (cursor-based, offset-based, timestamp-based)?

13. Are individual trade records associated with unique transaction IDs that can be used for deduplication?

14. Does the trade history API include both maker and taker information, or only the trade execution details?

15. What timestamp precision is provided for trade data (milliseconds, microseconds, block timestamps)?

## Market Metadata

16. How can historical market metadata be retrieved, including market creation dates, resolution times, and outcome definitions?

17. Is there an API endpoint to list all historical markets, including resolved and expired ones?

18. What identifiers are used for markets (slugs, numeric IDs, contract addresses), and how do they map to each other?

19. Does the API provide historical odds/probability data for markets over time?

## Rate Limits and Data Retention

20. What are the specific rate limits for Polymarket's data APIs (requests per second, requests per minute)?

21. How far back does Polymarket retain historical trade and order data in their APIs?

22. Are there different rate limit tiers for authenticated vs. unauthenticated requests?

23. Is there a way to request higher rate limits for research or data archival purposes?

## Data Formats and Schema

24. What data serialization format does Polymarket use for API responses (JSON, Protocol Buffers, MessagePack)?

25. Are numeric values returned as strings or native numbers, and what precision is maintained for prices and quantities?

26. What is the schema for trade records, and does it include fields like fee amounts, order types, and time-in-force?

27. How are conditional tokens and outcome shares represented in the API data structures?

## Blockchain Integration

28. Does Polymarket expose on-chain transaction hashes for trades that can be cross-referenced with Polygon blockchain data?

29. Can historical data be reconstructed directly from Polygon blockchain events, and what smart contract events should be monitored?

30. What is the relationship between off-chain CLOB data and on-chain settlement data?

31. Are there subgraph deployments (e.g., The Graph) that index Polymarket's smart contract events for historical queries?

## Technical Infrastructure

32. Does Polymarket provide any official SDKs or client libraries for interacting with their data APIs?

33. What is the typical API response latency for historical data queries?

34. Are there known issues with data consistency or gaps in historical records that consumers should account for?

35. Does Polymarket offer any data export tools or downloadable datasets for research purposes?
