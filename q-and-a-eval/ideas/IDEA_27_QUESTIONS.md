# Fee Impact Analyzer - Technical Implementation Questions

## Polymarket API and Fee Structure

1. What endpoints does the Polymarket API provide for retrieving current fee rates (maker fees, taker fees)?

2. Does Polymarket expose fee information directly in their order/trade response objects, or must fees be calculated separately?

3. What is the exact fee calculation formula used by Polymarket for both maker and taker orders?

4. Are there different fee tiers based on trading volume, and if so, how can a user's current fee tier be programmatically determined?

5. Does Polymarket charge fees on the notional value of the trade, the collateral amount, or some other basis?

6. How are fees represented in the API responses - as absolute values, percentages, or basis points?

## Gas Fees and Blockchain Costs

7. What blockchain does Polymarket operate on, and how should gas fees be estimated for trade execution?

8. Are there separate gas costs for order placement, order cancellation, and trade settlement that need to be tracked independently?

9. Does Polymarket batch transactions or use any Layer 2 solutions that affect gas fee calculations?

10. Is there an API endpoint or method to estimate gas costs before submitting a transaction?

11. How do gas fees vary between different order types (market orders vs. limit orders)?

## Historical Fee Data

12. Does Polymarket provide historical fee data through their API, or must this be calculated from historical trade records?

13. What historical trade data fields are available that would allow reconstruction of fees paid on past transactions?

14. Is there a way to query a user's total fees paid over a specific time period?

15. How far back does Polymarket retain historical trade and fee data accessible via API?

## Fee Calculation Edge Cases

16. How are fees calculated for partial order fills - are they proportional to the filled amount?

17. Are there any fee rebates or negative maker fees offered by Polymarket under certain conditions?

18. How are fees handled when an order transitions from maker to taker (e.g., a limit order that crosses the spread)?

19. Are there minimum fee thresholds or rounding rules that affect small trades?

20. Do fees differ between binary outcome markets and other market types on Polymarket?

## API Integration Details

21. What authentication is required to access fee-related endpoints in the Polymarket API?

22. Are there rate limits on API endpoints that would affect real-time fee monitoring?

23. Does the Polymarket WebSocket feed include fee information in trade update messages?

24. What is the data format and structure of fee-related fields in API responses (JSON schema)?

25. Are there separate API endpoints for querying personal trading fees versus market-wide fee structures?

## Settlement and Resolution Fees

26. Are there any fees associated with market resolution or claiming winnings from settled markets?

27. How are fees calculated for positions that are held through market resolution versus positions closed before resolution?

28. Does withdrawing funds from Polymarket incur additional fees that should be factored into strategy calculations?

## Fee Transparency and Updates

29. How does Polymarket communicate fee structure changes, and is there an API endpoint for current fee schedules?

30. Are fee changes applied retroactively to open orders, or only to new orders placed after the change?

31. Is there a changelog or versioned documentation for Polymarket's fee structure history?
