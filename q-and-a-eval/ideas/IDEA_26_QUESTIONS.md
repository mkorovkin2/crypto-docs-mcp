# Technical Questions: Trade Copying Service for Polymarket

## API and Integration Questions

1. Does Polymarket provide a public API for querying another user's trade history or open positions, or is this data only accessible to the account owner?

2. What authentication mechanism does Polymarket use for API access (API keys, OAuth, wallet signatures), and can a single application authenticate on behalf of multiple user accounts?

3. Is there a WebSocket or streaming API available from Polymarket to receive real-time trade execution events, or must trades be polled from a REST endpoint?

4. What is the structure of Polymarket's order placement API, and what parameters are required to execute a market or limit order programmatically?

5. Does Polymarket support any form of account delegation or sub-account management that would allow a third-party service to execute trades on behalf of users without holding their private keys?

6. What are the rate limits on Polymarket's trading and data APIs, and how would these constraints affect a service copying trades to multiple follower accounts simultaneously?

7. How does Polymarket handle order execution—is it through on-chain transactions, an off-chain order book with on-chain settlement, or a hybrid approach?

8. What wallet infrastructure does Polymarket use (e.g., embedded wallets, smart contract wallets), and what signing requirements exist for trade execution?

9. Is there an official Polymarket SDK or client library available, and what programming languages are supported?

10. How can a service detect when a lead account's trade has been filled versus when it was merely submitted, and what latency should be expected between these events?

## Account and Authorization Questions

11. What is the process for a user to authorize a third-party application to execute trades on their Polymarket account?

12. Does Polymarket support EIP-712 typed data signatures or permit-style approvals for delegated trading?

13. Are there any on-chain or off-chain permission systems that allow read access to another account's trading activity with their consent?

14. What smart contract interactions are required to place trades on Polymarket, and what gas costs are associated with each transaction?

15. How does Polymarket handle USDC approvals and collateral management for trading, and would a copy-trading service need to manage these separately for each follower account?

## Event Monitoring Questions

16. Does Polymarket emit on-chain events for trade executions that can be monitored via blockchain event subscriptions?

17. What is the typical latency between a trade being executed and it appearing in Polymarket's API responses or event streams?

18. Are there webhook capabilities or push notification systems available through Polymarket for trade events?

19. How can a service differentiate between different order types (market, limit, partial fills) when monitoring trade activity?

20. What data fields are included in trade event payloads (e.g., market ID, outcome, price, size, timestamp, transaction hash)?

## Execution and Scaling Questions

21. What is the maximum order size or position limit enforced by Polymarket, and how would this affect scaled copy trades?

22. How does Polymarket handle partial order fills, and how should a copy-trading service handle scenarios where the lead's order fills but follower orders cannot due to liquidity?

23. Are there any anti-front-running protections or transaction ordering guarantees that would affect the timing of copy trades?

24. What error codes and failure scenarios does the Polymarket API return, and how should a copy-trading service handle rejected orders?

25. Does Polymarket provide any sandbox or testnet environment for developing and testing trading integrations before deploying to production?
