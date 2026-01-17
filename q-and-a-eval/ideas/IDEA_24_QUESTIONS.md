# Technical Implementation Questions: Drawdown Monitor for Polymarket

## API Authentication and Access

1. What authentication method does Polymarket use for API access (API keys, OAuth, wallet signatures), and how are credentials securely managed for automated monitoring services?

2. Are there separate API endpoints or authentication scopes required for read-only position monitoring versus write operations like order cancellation?

3. What are the rate limits for Polymarket API endpoints, and how should a monitoring service handle rate limiting when polling multiple positions frequently?

## Real-Time Position and PnL Tracking

4. Does Polymarket provide WebSocket connections for real-time position updates, or must position data be polled via REST endpoints?

5. What is the exact API endpoint and response schema for fetching current open positions, including entry price, current value, and unrealized PnL?

6. How is PnL calculated in the Polymarket API response—is it provided directly, or must it be computed from position cost basis and current market prices?

7. What latency can be expected when querying position data, and how frequently can positions be polled without hitting rate limits?

8. Does the API provide historical position snapshots or only current state, and how would a drawdown monitor track peak equity values over time?

9. How does Polymarket handle position data for markets that have resolved versus markets still active—are these returned in separate endpoints?

## Account Balance and Equity Monitoring

10. What API endpoint returns the total account equity, including both USDC balance and the value of all open positions?

11. How is collateral/margin tracked in the API for positions, and what fields indicate available versus locked funds?

12. Does Polymarket provide a single endpoint for portfolio-level metrics (total value, total PnL, drawdown percentage), or must these be aggregated from individual position data?

13. How are deposits and withdrawals reflected in the API, and how should a drawdown monitor distinguish between actual losses and balance changes from fund movements?

## Order Cancellation and Trading Pause

14. What is the API endpoint and required parameters for canceling open orders, and can multiple orders be canceled in a single batch request?

15. Is there an API method to cancel all open orders for an account with a single call, or must each order be canceled individually?

16. What response codes or error messages indicate successful versus failed order cancellations, and how should the monitor handle partial failures?

17. How quickly do order cancellations execute via the API, and is there a confirmation mechanism to verify orders have been removed from the order book?

18. Are there any restrictions on canceling orders during high-volatility periods or near market resolution times?

## Position Reduction and Liquidation

19. What API endpoints are available for placing market orders to reduce or close positions, and what parameters control execution (market vs. limit, time-in-force)?

20. Does Polymarket support IOC (Immediate-or-Cancel) or FOK (Fill-or-Kill) order types that would be useful for emergency position reduction?

21. How does the API handle partial fills when attempting to close a position, and what is the response schema for fill information?

22. Are there minimum order sizes or position reduction increments enforced by the API?

23. What slippage or price impact information is available before executing a position reduction, and can the API provide order book depth data?

24. How are positions in illiquid markets handled—does the API provide liquidity metrics or warnings when attempting to close large positions?

## Error Handling and Edge Cases

25. What error codes does the Polymarket API return for common failure scenarios (insufficient balance, invalid order, market closed)?

26. How should the monitor handle API timeouts or connection failures during critical protective actions?

27. Does Polymarket have a sandbox or testnet environment for testing drawdown monitoring and automated order cancellation without risking real funds?

28. Are there any API maintenance windows or known downtime periods that the monitoring service should account for?

## Market-Specific Considerations

29. How does the API differentiate between binary outcome markets and multi-outcome markets when reporting position values?

30. What happens to open orders and positions when a market resolves—are there specific API events or status changes to monitor?

31. Does the API provide market metadata (resolution time, trading hours, liquidity) that would inform drawdown protection strategies?

32. How are fees (trading fees, resolution fees) reflected in the API, and should they be factored into PnL and drawdown calculations?
