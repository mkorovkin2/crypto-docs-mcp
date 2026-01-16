# Technical Implementation Questions: Orderbook Sniper Bot for Polymarket

## API Access and Authentication

1. What is the base URL for the Polymarket API, and is there a separate endpoint for testnet/sandbox environments?

2. What authentication method does Polymarket use (API keys, OAuth, wallet signatures, etc.), and how are credentials obtained and managed?

3. Does Polymarket require wallet-based authentication (e.g., signing messages with an Ethereum wallet), and if so, what signing scheme is used?

4. Are there different API access tiers (public vs. authenticated), and what endpoints require authentication?

5. How does Polymarket handle session management - are tokens time-limited, and is there a refresh mechanism?

## Real-Time Orderbook Data

6. Does Polymarket provide a WebSocket API for real-time orderbook updates, or is polling REST endpoints the only option?

7. What is the message format for orderbook data (full snapshots vs. incremental deltas)?

8. How are orderbook levels structured - what fields are included (price, size, side, timestamp, order IDs)?

9. Is there a subscription model for WebSocket connections where you can filter by specific markets/condition IDs?

10. What is the typical latency for orderbook updates via WebSocket compared to REST polling?

11. How does Polymarket identify markets - by condition ID, market slug, or some other identifier?

## Rate Limits and Throttling

12. What are the documented rate limits for REST API endpoints (requests per second/minute)?

13. Are there separate rate limits for WebSocket connections (messages per second, number of subscriptions)?

14. How does Polymarket signal rate limit status - via HTTP headers, error codes, or WebSocket disconnect?

15. Is there a rate limit specifically for order placement that differs from market data endpoints?

16. What is the recommended backoff strategy when rate limits are hit?

## Order Execution

17. What is the endpoint and payload format for placing limit orders on Polymarket?

18. Does Polymarket support market orders, or only limit orders?

19. What order types are supported (IOC, FOK, GTC, post-only)?

20. How are orders matched - is Polymarket using an on-chain orderbook, off-chain matching engine, or hybrid approach?

21. What is the minimum order size and price tick increment for Polymarket markets?

22. How is order status tracked - is there a WebSocket feed for fills/cancellations, or must you poll?

23. What is the typical order execution latency from submission to confirmation?

24. Does Polymarket use a CLOB (Central Limit Order Book) model, and if so, what matching engine technology underlies it?

## Protocol and Infrastructure

25. Is Polymarket built on Polygon, and does order execution require on-chain transactions or gas fees?

26. Are there smart contract ABIs available for direct interaction, or is the HTTP API the only supported interface?

27. Does Polymarket use the 0x Protocol, CLOB contracts, or a custom order matching system?

28. What happens to pending orders if the WebSocket connection drops - are they automatically cancelled?

29. Is there a nonce or sequence number system for order submissions to prevent replay attacks?

## Data Formats and Market Structure

30. What is the structure of a Polymarket market - how are YES/NO outcomes represented in the orderbook?

31. Are prices expressed as probabilities (0-1), cents (0-100), or some other format?

32. How are market condition IDs related to token IDs, and how do you map between them?

33. Is historical orderbook data available via the API, or only current state?

34. What timestamp format does Polymarket use, and how is clock synchronization handled?

## Error Handling and Edge Cases

35. What error codes does the API return, and is there comprehensive documentation for error handling?

36. How does the API behave during high-volatility periods or market resolution events?

37. Are there circuit breakers or trading halts that the bot needs to handle?

38. What happens if an order is partially filled - how is the remaining quantity handled?

## SDK and Client Libraries

39. Does Polymarket provide official SDK libraries (Python, JavaScript, etc.) for API interaction?

40. Are there community-maintained libraries, and what is their reliability/maintenance status?

41. Is there example code or reference implementations for common trading operations?

42. What dependencies are required for WebSocket connections (specific libraries, protocols like Socket.IO vs. native WebSocket)?
