# Technical Questions: News-Driven Trigger Bot for Polymarket

## Polymarket API and Authentication

1. What authentication mechanism does Polymarket use for API access (API keys, OAuth, wallet signatures)?
2. Are there separate API endpoints for read-only market data versus trade execution?
3. What are the rate limits for Polymarket APIs, and how should a bot handle rate limiting when processing high-frequency news triggers?
4. Does Polymarket provide a sandbox or testnet environment for testing automated trading strategies without real funds?

## Market Discovery and Search

5. Does Polymarket offer a search API endpoint to find markets by keyword or topic programmatically?
6. How can I retrieve a list of all active markets, and what pagination mechanisms are available?
7. What market metadata fields are available (categories, tags, descriptions) that could be used for keyword matching against news headlines?
8. Is there an API to subscribe to newly created markets, or must I poll for new markets periodically?

## Market Identifiers and Structure

9. What unique identifiers does Polymarket use for markets (UUIDs, slugs, contract addresses)?
10. How are binary versus multi-outcome markets structured differently in the API response?
11. What is the relationship between a market's human-readable question/title and its programmatic identifier?
12. How do I obtain the underlying token/contract addresses needed for on-chain order execution?

## Mapping News to Markets

13. What fields in the market data response are most reliable for semantic matching (title, description, resolution criteria)?
14. Does Polymarket provide any categorization or tagging system that could help narrow down relevant markets for specific news topics?
15. Are market resolution sources or criteria available via API to help determine if a news source is authoritative for a given market?
16. How frequently does market metadata (descriptions, tags) change, and should I cache or refresh this data?

## Order Execution

17. What is the structure of the order placement API request (market ID, side, size, price, order type)?
18. Does Polymarket use an order book model, AMM, or hybrid system for trade execution?
19. What order types are supported (market, limit, stop-loss) for automated trading?
20. How do I query current order book depth and best bid/ask prices before placing an order?
21. What is the expected latency for order execution, and how should the bot handle order confirmation?
22. Are there minimum order sizes or position limits that the bot must respect?

## Trade Monitoring and Logging

23. How can I retrieve my historical trades and open positions via API for logging and backtesting purposes?
24. Does the API provide webhooks or WebSocket streams for real-time trade status updates?
25. What information is returned in an order execution response (transaction hash, fill price, fees)?
26. How do I track partial fills and order status changes over time?

## On-Chain vs Off-Chain Considerations

27. Does Polymarket operate as a fully on-chain protocol, or is there an off-chain order matching component?
28. What blockchain network(s) does Polymarket use, and what are the gas cost implications for automated trading?
29. Are there gasless or meta-transaction options for reducing transaction costs on high-frequency trades?
30. How do I handle blockchain confirmation times when the bot needs to execute trades quickly in response to breaking news?

## Data Freshness and Real-Time Updates

31. Does Polymarket provide WebSocket or streaming APIs for real-time market price updates?
32. What is the typical delay between market state changes and API data availability?
33. How should the bot handle stale data or API downtime scenarios?

## Backtesting Support

34. Is historical market data (prices, volumes, outcomes) available via API for backtesting keyword-trigger strategies?
35. What resolution/granularity of historical price data is available (tick-level, minute, hourly)?
36. Are resolved market outcomes and settlement prices accessible via API for calculating historical strategy performance?
