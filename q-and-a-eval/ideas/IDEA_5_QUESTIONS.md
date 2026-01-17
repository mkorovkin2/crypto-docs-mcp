# Technical Questions: Portfolio Rebalancer for Polymarket

## Polymarket API and Integration Questions

1. What is the base URL for the Polymarket API, and what authentication method is required (API keys, OAuth, wallet signatures)?

2. How do you query a user's current portfolio holdings and positions via the Polymarket API? What endpoint returns the list of outcome tokens a wallet currently holds?

3. What is the data structure returned when querying positions? Does it include fields like token address, quantity, average cost basis, and current market price?

4. How are outcome tokens represented on Polymarket? Are they ERC-1155 tokens, ERC-20 tokens, or a custom token standard? What identifiers are needed to reference a specific outcome token?

5. Is there a single API call to get the total portfolio value in USD or USDC, or must you calculate it by fetching each position and multiplying by current prices?

6. How do you fetch the current market price (bid/ask/mid) for a specific outcome token? Is there a dedicated price endpoint or must you query the order book?

7. What are the rate limits on the Polymarket API for read operations (fetching positions, prices, markets)?

8. Does Polymarket provide a WebSocket or streaming API for real-time price updates, or must you poll for price changes?

## Order Execution Questions

9. What is the correct API endpoint and payload structure for placing a market order or limit order to buy/sell outcome tokens?

10. Does Polymarket support batch order submission for executing multiple trades in a single API call, which would be useful for rebalancing multiple positions simultaneously?

11. What is the minimum order size for trades on Polymarket? Are there different minimums for different markets or token types?

12. How do you cancel an open order via the API? What order states are possible (pending, filled, partially filled, cancelled)?

13. Is there an endpoint to estimate the expected execution price and slippage before submitting an order?

14. How are order signatures generated for the Polymarket CLOB (Central Limit Order Book)? What signing scheme is used (EIP-712, personal_sign)?

## Transaction Costs and Fees

15. What is the fee structure on Polymarket? Are there maker/taker fees, and what are the current percentages?

16. Are fees deducted from the order amount, added on top, or taken from a separate balance? How should fee calculations be incorporated into rebalancing logic?

17. What gas costs are associated with Polymarket trades? Are trades executed on-chain (Polygon) or off-chain with periodic settlement?

18. Is there an API endpoint to query current fee rates, or are fees fixed and documented elsewhere?

19. Are there any volume-based fee discounts or tiered fee structures that would affect rebalancing cost calculations?

## Balance and Collateral Questions

20. How do you query the available USDC balance for a wallet that can be used for purchasing outcome tokens?

21. What is the collateral token used on Polymarket (USDC on Polygon)? What is the token contract address?

22. Is there a distinction between available balance and locked balance (e.g., in open orders)? How do you query both?

23. How do you deposit or withdraw collateral programmatically via the API?

## Market and Token Metadata

24. How do you fetch the list of all active markets and their associated outcome tokens? What fields identify which tokens belong to which market?

25. What metadata is available for outcome tokens (e.g., description, resolution date, market category)?

26. How do you determine if a market has resolved and what the winning outcome was? Is there a status field or separate resolution endpoint?

27. Are there any restrictions on trading certain markets programmatically (e.g., geo-restrictions, market-specific rules)?

## Technical Infrastructure Questions

28. What blockchain network does Polymarket operate on, and what RPC endpoints should be used for on-chain queries?

29. Is there an official Polymarket SDK or client library, or must all integrations use raw REST API calls?

30. How do you handle order nonces to prevent replay attacks when signing orders?

31. What is the recommended approach for maintaining a persistent session or connection for high-frequency rebalancing operations?

32. Are there any webhooks or callback mechanisms to receive notifications when orders are filled or positions change?
