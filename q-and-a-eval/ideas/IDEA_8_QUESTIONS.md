# Technical Questions: Risk Limits Gateway for Polymarket

## Polymarket API and Authentication

1. What is the base URL for Polymarket's trading API, and is there a separate endpoint for testnet/sandbox environments?

2. How does Polymarket's authentication flow work? Does it use API keys, JWT tokens, or wallet-based signatures for API requests?

3. What is the exact signing scheme required for Polymarket orders? Does it use EIP-712 typed data signatures, and what are the specific domain and type definitions?

4. Are there rate limits on Polymarket's API endpoints, and how should a middleware gateway handle rate limit responses (HTTP 429)?

5. Does Polymarket provide WebSocket endpoints for real-time order status updates, or must the gateway poll for trade confirmations?

## Trade Request Interception and Proxying

6. What is the structure of a Polymarket order submission request (endpoint path, HTTP method, request body schema)?

7. Are Polymarket orders submitted directly to an on-chain contract, through a relayer API, or via a hybrid approach? How does this affect where interception should occur?

8. Does Polymarket use a CLOB (Central Limit Order Book) system, and if so, what is the API endpoint for submitting limit orders vs. market orders?

9. Can orders be submitted with a custom nonce or expiration time that the gateway could use for additional validation?

10. What headers or metadata does Polymarket expect in API requests (e.g., API version headers, client identifiers)?

## Position and PnL Queries

11. What API endpoint returns a user's current open positions across all markets, and what is the response schema?

12. How can the gateway query unrealized PnL for open positions? Is there a dedicated endpoint, or must it be calculated from position size and current market prices?

13. Does Polymarket provide historical trade data per account via API, and what is the endpoint for fetching trade history with pagination?

14. How are positions represented in Polymarket's API? Are they denominated in shares, USDC value, or both?

15. Is there an API endpoint to fetch the average entry price for a position, or must this be calculated from historical fills?

## Account Balance and Exposure

16. What API endpoint returns a user's available USDC balance for trading on Polymarket?

17. Does Polymarket distinguish between "available balance" and "locked/reserved balance" for open orders? How are these exposed via API?

18. Is there an endpoint to query total account exposure (sum of all position values) in a single call?

19. How does Polymarket handle margin or collateral requirements? Is there an API to query margin utilization?

20. Can the gateway query pending (unfilled) orders and their locked collateral amounts?

## Order Lifecycle and Cancellation

21. What is the API endpoint and method for canceling an open order on Polymarket?

22. Does canceling an order require a signature, and if so, what data must be signed?

23. How can the gateway detect if an order was partially filled before applying risk limits to the remaining amount?

24. What order statuses does Polymarket return (e.g., pending, open, filled, canceled, expired), and how should the gateway interpret each?

25. Is there a batch order submission or cancellation endpoint that the gateway should support?

## Market Data and Price Information

26. What API endpoint provides current bid/ask prices and order book depth for a specific market?

27. How are Polymarket markets identified in API calls? By contract address, market ID, or slug?

28. Is there an endpoint to query all active markets and their metadata (resolution date, outcome tokens, etc.)?

29. How frequently is market price data updated, and is there a timestamp or sequence number for staleness detection?

30. Does Polymarket provide a "mark price" or "index price" that should be used for PnL calculations vs. last traded price?

## Integration Architecture

31. Does Polymarket provide an official SDK or client library (JavaScript, Python, etc.) that the gateway could wrap?

32. Are there webhook or callback mechanisms for order fills, or must the gateway poll for status updates?

33. What blockchain network does Polymarket operate on (Polygon, Ethereum mainnet, etc.), and are there RPC endpoints needed for on-chain verification?

34. Does the gateway need to interact with Polymarket's smart contracts directly for any operations, or is the REST API sufficient?

35. How does Polymarket handle order matching? Is it first-come-first-served, pro-rata, or another algorithm that affects how the gateway should manage order timing?
