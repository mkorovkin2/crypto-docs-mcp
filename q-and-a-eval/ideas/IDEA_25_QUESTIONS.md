# Technical Questions: Market Sentiment Extractor (Idea 25)

## Polymarket API and Data Access

1. Does Polymarket provide a public REST API or GraphQL endpoint for accessing real-time market prices, and what is the base URL and authentication method required?

2. What are the rate limits imposed by the Polymarket API for fetching price data, and are there different tiers for authenticated vs. unauthenticated requests?

3. Does Polymarket offer WebSocket connections for streaming real-time price updates, and if so, what is the subscription format for specific markets?

4. What is the data format and schema returned by Polymarket's price endpoints (e.g., JSON structure, field names for bid/ask/last price, timestamps)?

## Historical Price Data

5. Does Polymarket provide historical OHLCV (Open, High, Low, Close, Volume) candlestick data, and what time intervals are available (1m, 5m, 1h, 1d)?

6. How far back does Polymarket's historical price data extend, and are there any limitations on bulk historical data retrieval?

7. Is there a dedicated endpoint for fetching historical price snapshots at specific timestamps for correlation analysis with sentiment data?

8. Does Polymarket store and expose historical order book depth data, or only trade/price history?

## Market Metadata

9. What metadata fields does Polymarket expose for each market (e.g., market ID, title, description, category, resolution criteria, end date)?

10. Does Polymarket provide a market discovery or listing endpoint that allows filtering by category, status (active/resolved), or volume?

11. How are market IDs structured in Polymarket, and are they stable identifiers suitable for long-term tracking and database storage?

12. Does Polymarket expose market liquidity metrics, trading volume, or number of unique traders through their API?

## Community and Social Data

13. Does Polymarket provide any API access to public comments, discussions, or social interactions associated with specific markets?

14. Is there an endpoint to retrieve the number of followers, watchers, or engagement metrics for individual markets?

15. Does Polymarket expose any aggregated sentiment or crowd wisdom indicators derived from trading patterns or user behavior?

16. Are there any Polymarket-affiliated Discord servers, Telegram groups, or forums with APIs that could serve as sources for public commentary ingestion?

## Integration and Technical Details

17. Does Polymarket use blockchain-based settlement (e.g., Polygon), and if so, can on-chain data be queried directly for additional market activity information?

18. What SDK libraries or official client packages does Polymarket provide for Python, JavaScript, or other languages?

19. Does Polymarket's API support pagination for large result sets, and what are the page size limits and cursor/offset mechanisms?

20. Are there any known third-party data aggregators or APIs (e.g., TheGraph subgraphs) that index Polymarket data and might offer additional historical or analytical endpoints?

21. What is the typical latency between a trade execution on Polymarket and its reflection in the API price data?

22. Does Polymarket provide webhook capabilities for receiving notifications on price movements or market events, which could trigger sentiment correlation updates?

23. How does Polymarket handle market resolution in their API, and is there a way to filter out resolved markets when building correlation datasets?

24. Are there any CORS restrictions or API gateway configurations that would affect building a client-side sentiment dashboard that fetches Polymarket data directly?
