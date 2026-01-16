# Technical Questions: Arbitrage Watcher for Polymarket

## API and Data Access

1. What REST API endpoints does Polymarket provide for fetching market data, and what authentication methods are required?

2. Does Polymarket offer WebSocket connections for real-time price updates, or must the bot rely on polling REST endpoints?

3. What are the rate limits for Polymarket's APIs, and how should the bot handle rate limiting to avoid being blocked?

4. What is the exact JSON schema returned by Polymarket's market data endpoints, including fields for prices, probabilities, and liquidity?

## Market Relationships and Data Model

5. How does Polymarket's data model represent related or mutually exclusive markets? Is there an explicit field linking markets that cover the same event with different outcomes?

6. Are mutually exclusive outcomes stored as separate markets or as multiple positions within a single market contract?

7. Does Polymarket provide an API endpoint to query all markets related to a specific event or category, or must relationships be inferred from market metadata?

8. What identifiers (market IDs, condition IDs, token IDs) does Polymarket use, and how do these relate to each other for linked markets?

9. Is there a parent-child relationship structure in Polymarket's data model that groups outcomes that should sum to 100% probability?

## Price and Probability Data

10. How are prices represented in Polymarket's API responses—as decimals, basis points, or another format?

11. Does Polymarket return implied probabilities directly, or must they be calculated from bid/ask prices or order book data?

12. How is the order book data structured, and what depth of book information is available via the API?

13. Are there separate endpoints for best bid/ask versus full order book depth?

14. How does Polymarket handle the spread between bid and ask prices, and how should this be factored into arbitrage calculations?

## Real-Time Updates and Latency

15. What is the typical latency for price updates through Polymarket's data feeds?

16. If WebSockets are available, what subscription model do they use—per-market subscriptions or broadcast of all market updates?

17. How does Polymarket handle market state changes (e.g., resolution, suspension) in real-time feeds?

18. Are there heartbeat or keepalive mechanisms required for maintaining persistent connections to Polymarket's services?

## Order Execution and Trading

19. What API endpoints are available for placing, modifying, and canceling orders on Polymarket?

20. Does Polymarket use an on-chain order book, an off-chain matching engine, or a hybrid approach, and how does this affect order execution latency?

21. What order types does Polymarket support (limit, market, fill-or-kill, etc.) via their trading API?

22. How are trades signed and authenticated—does Polymarket require wallet signatures for each order, or is there a session-based authentication system?

23. What blockchain network does Polymarket operate on, and what are the gas fee considerations for executing trades?

24. Is there a minimum order size or notional value requirement for trades on Polymarket?

25. How does Polymarket handle partial fills, and how are fill notifications delivered to the trader?

## Arbitrage-Specific Considerations

26. Does Polymarket provide any built-in mechanisms or API fields that indicate when markets are part of a mutually exclusive set?

27. How can the bot programmatically detect when the sum of implied probabilities across related outcomes deviates from 100%?

28. Are there historical price or trade APIs that could be used to backtest arbitrage strategies before deploying them live?

29. What is the settlement process for Polymarket positions, and how might pending settlements affect arbitrage calculations?

30. Does Polymarket have any documentation on common market structures (binary, multiple choice, scalar) that would help identify arbitrage opportunities?

## Integration and Infrastructure

31. Are there official Polymarket SDKs or client libraries available, and in what programming languages?

32. Does Polymarket provide a testnet or sandbox environment for developing and testing trading bots?

33. What are the terms of service considerations for running automated trading bots on Polymarket?

34. How does Polymarket's CLOB (Central Limit Order Book) system work, and what is the matching priority for orders?

35. Are there any known API versioning practices, and how does Polymarket communicate breaking changes to API consumers?
