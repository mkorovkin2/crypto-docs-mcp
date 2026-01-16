# Technical Questions: Market Discovery Agent for Polymarket

## API Access and Authentication

1. What is the base URL for the Polymarket API, and what authentication method is required (API keys, OAuth, wallet signatures)?

2. Are there rate limits on the Polymarket API for listing and querying markets, and what are the specific thresholds?

3. Does Polymarket provide separate API endpoints for production vs. testnet environments for development purposes?

## Market Listing and Discovery

4. What is the specific API endpoint for retrieving a list of all available markets on Polymarket?

5. Does the API support pagination when fetching markets, and if so, what parameters control page size and cursor/offset?

6. Can markets be queried in bulk, or must they be fetched individually by market ID?

7. Is there an API endpoint that returns only recently created markets within a specified time window?

8. Does Polymarket provide a WebSocket or streaming API for real-time notifications when new markets are created?

## Market Metadata and Categorization

9. What metadata fields are returned for each market (e.g., title, description, resolution criteria, creator, creation timestamp)?

10. Does Polymarket have a formal taxonomy or category system for markets, and if so, what are the available categories?

11. Are markets tagged with keywords or topics that can be used for filtering, and what is the structure of these tags?

12. What is the data format for market resolution conditions, and how are binary vs. multi-outcome markets differentiated in the API response?

13. Does the API expose market status fields (e.g., open, closed, resolved, disputed), and what are all possible status values?

## Filtering and Search Capabilities

14. Does the Polymarket API support server-side filtering by topic, category, or keyword, or must filtering be done client-side?

15. What query parameters are available for filtering markets by creation date, end date, or resolution date?

16. Is there a full-text search endpoint for finding markets by title or description content?

17. Can markets be filtered by creator address or market type through API parameters?

## Liquidity Metrics

18. What liquidity-related fields are available in the market API response (e.g., total liquidity, volume, open interest)?

19. Is liquidity data reported in raw token amounts or USD-equivalent values, and what is the precision/decimals used?

20. Does the API provide historical liquidity data or time-series snapshots, or only current liquidity values?

21. How frequently is liquidity data updated in the API, and is there a timestamp indicating when liquidity was last calculated?

22. Are there separate liquidity metrics for each outcome in a market, or only aggregate market-level liquidity?

23. What is the difference between "liquidity" and "volume" in Polymarket's API terminology, and how are they calculated?

## Order Book and Pricing Data

24. Does Polymarket expose order book depth data via API that could be used to assess market liquidity quality?

25. What pricing data is available per market outcome (e.g., last price, bid/ask spread, mid price)?

26. Is there an endpoint for retrieving historical price data or OHLCV candles for markets?

## Event-Driven Updates

27. Does Polymarket provide webhooks for subscribing to new market creation events?

28. If using WebSockets, what is the connection URL and message format for subscribing to market updates?

29. What is the typical latency between market creation on-chain and availability via the API?

30. Are there GraphQL endpoints available that might allow more efficient querying of specific market fields?

## Blockchain Integration

31. What blockchain does Polymarket currently operate on, and are market creation events emitted as on-chain events that can be indexed?

32. What are the smart contract addresses for Polymarket's market factory or registry contracts?

33. Can new market creation be detected by monitoring on-chain events as an alternative to API polling?

34. What is the relationship between on-chain market identifiers and API market IDs?

## SDK and Libraries

35. Does Polymarket provide official SDKs or client libraries for interacting with their API (JavaScript, Python, etc.)?

36. Are there community-maintained libraries or wrappers for the Polymarket API that are recommended?

37. What data format does the API use for responses (JSON, Protocol Buffers), and are there TypeScript type definitions available?

## Data Persistence and Caching

38. Does the API provide ETags or Last-Modified headers that can be used for efficient cache invalidation?

39. What is the recommended polling interval for checking new markets without exceeding rate limits?

40. Are there bulk export endpoints or data dumps available for initializing a local market database?
