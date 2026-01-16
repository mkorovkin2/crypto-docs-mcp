# Technical Implementation Questions: Orderbook Replay Viewer

## Polymarket API and Data Access

1. Does Polymarket provide a public API endpoint for retrieving historical order book snapshots, and if so, what is the endpoint URL and authentication mechanism?

2. What is the maximum historical depth available for order book data through Polymarket's APIs (e.g., 24 hours, 7 days, full market lifetime)?

3. Does Polymarket offer a WebSocket stream for real-time order book updates, and what is the message format for order book change events (adds, removes, modifications)?

4. Are order book snapshots available at regular intervals (e.g., every second, every minute), or only as event-driven deltas from a baseline?

5. What is the data structure and schema for order book entries returned by Polymarket APIs (price levels, quantities, order IDs, timestamps)?

## Tick-by-Tick and Event Data

6. Does Polymarket provide tick-by-tick trade data with individual order execution details, or only aggregated trade summaries?

7. What timestamp precision is available for order book events and trades (milliseconds, microseconds, nanoseconds)?

8. Are order book events tagged with sequence numbers or unique identifiers to ensure correct replay ordering and detect gaps?

9. Is there a distinction in the API between market orders, limit orders, and cancel events when retrieving historical order flow?

10. Does Polymarket expose the full order lifecycle (placement, partial fills, cancellations) or only the resulting state changes?

## Historical Data Storage and Retrieval

11. Does Polymarket provide bulk data exports or downloadable historical datasets for order book reconstruction?

12. What rate limits apply to historical order book data API endpoints, and are there different tiers for authenticated vs. unauthenticated access?

13. Is there a dedicated historical data API separate from the live trading API, or are they unified?

14. How are order book snapshots compressed or paginated when retrieving large historical ranges?

15. Does Polymarket maintain historical order book data for resolved/settled markets, or is data purged after market resolution?

## Market Microstructure Details

16. What is the minimum tick size (price increment) for Polymarket order books, and does it vary by market type?

17. How does Polymarket handle order book depth - is there a maximum number of price levels stored or returned?

18. Are hidden or iceberg orders used on Polymarket, and if so, how do they appear in historical order book data?

19. What matching engine priority rules does Polymarket use (price-time, pro-rata), and is this information available in the order data?

20. Does the API differentiate between order book updates caused by trades versus cancellations versus new order placements?

## Integration and Technical Considerations

21. What is the underlying blockchain infrastructure (if any) that Polymarket order books use, and are on-chain events available as an alternative data source?

22. Does Polymarket use CLOB (Central Limit Order Book) infrastructure through a partner like 0x or a custom implementation?

23. Are there API client libraries or SDKs provided by Polymarket that handle order book data serialization and WebSocket connection management?

24. What data format is used for order book responses (JSON, Protocol Buffers, MessagePack), and are there compression options?

25. How does Polymarket handle order book data during market halts, price circuit breakers, or other exceptional market conditions?
