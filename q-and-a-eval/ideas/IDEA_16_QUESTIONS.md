# Technical Questions: Liquidity Provision Bot for Polymarket

## Orderbook and Midprice Calculation

1. What is the exact API endpoint for fetching the current orderbook for a specific market on Polymarket, and what is the response structure (bid/ask arrays, price levels, quantities)?

2. How frequently is the orderbook data updated, and is there a WebSocket endpoint for real-time orderbook streaming rather than polling?

3. Does Polymarket provide a native midprice or mark price in their API, or must it be calculated manually from the best bid and best ask?

4. What is the tick size (minimum price increment) for orders on Polymarket markets, and does this vary by market type?

## Order Placement and Management

5. What is the API endpoint and required payload structure for placing limit orders on Polymarket? What authentication method is required (API keys, signatures, wallet-based)?

6. How are order prices specified in the API (decimal, basis points, integer representation)? What precision constraints apply?

7. What is the maximum number of open orders allowed per market or per account?

8. Is there a batch order placement API that allows submitting multiple orders in a single request, or must each order be placed individually?

9. What is the API endpoint for canceling orders? Can orders be canceled individually, in batches, or is there a "cancel all" endpoint for a specific market?

10. What are the rate limits for order placement and cancellation API calls? Are there separate limits for reads vs. writes?

## Order Status and Fill Notifications

11. How can open orders be queried? Is there an endpoint that returns all active orders for an account with their current status?

12. Does Polymarket provide WebSocket streams or webhook callbacks for order fill notifications, or must order status be polled?

13. What order statuses are possible (e.g., open, partially filled, filled, canceled, expired), and how are these represented in the API response?

14. How is partial fill information exposed? Does the API return filled quantity, remaining quantity, and average fill price?

15. Is there a unique order ID assigned by Polymarket upon order creation, and how should this be used for tracking and reconciliation?

## Fee Structure

16. What are the current maker and taker fee percentages on Polymarket? Are maker fees zero or rebated?

17. How are fees deducted—from the filled amount, charged separately, or embedded in the settlement price?

18. Are there any volume-based fee tiers or incentive programs for liquidity providers that affect the fee calculation?

19. Where in the API response can fee information be found for executed trades?

## Inventory and Position Management

20. What API endpoint provides current position sizes and average entry prices for holdings in a specific market?

21. Is there an API for retrieving account balance and available margin/collateral for placing new orders?

22. Are there any position limits enforced by Polymarket that would affect inventory management strategies?

## Technical Integration Details

23. What blockchain or settlement layer does Polymarket use, and are there any on-chain components required for order placement (e.g., signatures, approvals)?

24. What is the typical latency for order placement and cancellation API calls under normal conditions?

25. Does Polymarket use a Central Limit Order Book (CLOB) model, and if so, what is the matching engine's price-time priority logic?

26. Are there any specific SDK libraries (Python, JavaScript, etc.) officially provided or recommended for interacting with the Polymarket API?

27. What authentication mechanism is used for API access—API keys, OAuth, or cryptographic wallet signatures?

28. How should the bot handle order expiration? Is there a time-in-force parameter (GTC, IOC, GTD) available when placing orders?

29. What error codes and error response formats does the API return, particularly for rejected orders or rate limit violations?

30. Is there a testnet or sandbox environment available for testing the liquidity provision bot without risking real funds?
