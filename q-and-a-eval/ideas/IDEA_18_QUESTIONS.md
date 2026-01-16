# Technical Implementation Questions: Event-Driven Backtester for Polymarket

## Historical Data Availability

1. Does Polymarket provide an official API endpoint for accessing historical trade data, and if so, what is the data retention period and granularity (tick-by-tick vs. aggregated intervals)?

2. Are historical order book snapshots available through Polymarket's API, and at what depth levels (L1, L2, L3) can historical order book state be reconstructed?

3. What format does Polymarket use for historical market event data exports (JSON, CSV, Parquet), and are there rate limits or pagination requirements when fetching large historical datasets?

4. Does Polymarket expose historical CLOB (Central Limit Order Book) data separately from AMM pool data, and how should a backtester handle the transition period if both systems coexisted?

## Event Timestamps and Sequencing

5. What timestamp precision does Polymarket use for trade and order events (milliseconds, microseconds), and are timestamps based on block time or server receipt time?

6. How are market resolution events timestamped and sequenced relative to the final trades, and is there a guaranteed ordering between resolution announcements and trading halts?

7. Does Polymarket provide sequence numbers or unique event IDs that allow deterministic replay of market events in the exact order they occurred?

8. How should a backtester handle timestamp discrepancies between on-chain settlement times and off-chain order matching times in Polymarket's hybrid architecture?

## Trade Execution Data

9. What fields are available in Polymarket's historical trade records (price, size, side, maker/taker designation, fees, order IDs)?

10. Does Polymarket provide historical fill data that distinguishes between partial fills and complete order executions for accurate position tracking?

11. Are historical gas costs and settlement fees available for trades executed on Polymarket, and how should these be incorporated into backtesting P&L calculations?

12. Does the Polymarket API expose historical slippage data or the original limit prices for market orders to model realistic execution costs?

## Order Book Reconstruction

13. What is the minimum data required from Polymarket to reconstruct historical order book state for a given market at arbitrary past timestamps?

14. Does Polymarket provide historical bid-ask spread data, or must this be computed from raw order book snapshots?

15. How frequently were order book snapshots captured historically, and is linear interpolation acceptable for simulating book state between snapshots?

16. Are cancelled and expired orders included in Polymarket's historical data feeds, which would be necessary for accurate order book replay?

## Market Events and Triggers

17. What webhook or streaming endpoints does Polymarket offer for receiving real-time market events, and are historical event streams available for replay?

18. How are market creation, parameter changes (e.g., fee adjustments), and market pause/resume events represented in Polymarket's event data?

19. Does Polymarket expose oracle update events and price feed data that could serve as triggers for event-driven backtesting strategies?

20. What metadata is available for market resolution events (resolution source, dispute period, final outcome), and how should disputed resolutions be handled in backtests?

## API Integration Details

21. What authentication mechanism does Polymarket use for API access to historical data (API keys, OAuth, wallet signatures)?

22. Are there different API tiers or enterprise endpoints for accessing bulk historical data needed for comprehensive backtesting?

23. Does Polymarket provide a sandbox or testnet environment with historical data that mirrors production for backtester development and validation?

24. What is the API rate limit structure for historical data endpoints, and are there bulk download options for fetching complete market histories?

## Execution Model Considerations

25. Does Polymarket document their order matching engine's behavior (price-time priority, pro-rata) to accurately model execution in backtests?

26. What historical latency data is available from Polymarket to model realistic order submission and confirmation delays?

27. How does Polymarket handle partial fills at price level boundaries, and is this logic documented for replication in a backtesting engine?

28. Are there historical records of order rejections, failed transactions, or execution failures that should be modeled in realistic backtests?
