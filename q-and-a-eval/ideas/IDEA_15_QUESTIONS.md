# Technical Questions: Settlement Audit Tool for Polymarket

## API and Data Access

1. What Polymarket API endpoints are available to retrieve resolved market outcomes, and what authentication is required to access them?

2. Does Polymarket provide a dedicated API for querying historical resolution data, or must this be derived from general market endpoints?

3. What is the structure and schema of the resolution response data returned by Polymarket APIs (e.g., resolution timestamp, outcome value, resolution source)?

4. Are there rate limits on Polymarket API calls when batch-querying large numbers of resolved markets for audit purposes?

5. Does Polymarket expose webhook or event-based notifications when a market resolves, or must resolution status be polled?

## Oracle and Resolution Mechanics

6. Which oracle system(s) does Polymarket use for market resolution (e.g., UMA, Chainlink, custom oracle), and how can resolution data be verified on-chain?

7. What smart contract addresses and ABIs are needed to directly query resolution outcomes from Polymarket's on-chain oracle contracts?

8. How is the resolution outcome represented on-chain (e.g., numeric values, boolean, price feeds), and what data transformation is needed to interpret it?

9. What is the dispute resolution process for Polymarket markets, and how can an audit tool detect if a market resolution was disputed or overturned?

10. Are there multiple resolution sources or fallback oracles for a single market, and how can an audit tool identify which source was ultimately used?

## Settlement and Payout Data

11. What API endpoints or contract methods expose settlement payout data, including the final payout ratios for winning and losing positions?

12. How does Polymarket handle partial resolutions or multi-outcome markets, and what data structures represent these settlement scenarios?

13. Is there a distinction between resolution time and settlement time in Polymarket data, and how can both timestamps be retrieved?

14. What data is available to verify that payouts were correctly distributed according to the resolution outcome?

15. How are edge cases like market cancellations or "invalid" resolutions represented in the API and on-chain data?

## Historical Records and Data Integrity

16. Does Polymarket maintain an archive or historical database of all resolved markets, and what is the retention period for this data?

17. Can resolved market metadata (original market description, resolution criteria, expiration date) be retrieved after resolution for audit comparison?

18. What identifiers (market ID, condition ID, token addresses) are needed to uniquely identify and track a market through its lifecycle to resolution?

19. Are there subgraph deployments (e.g., The Graph) for Polymarket that provide indexed historical resolution data for efficient querying?

20. How can an audit tool retrieve the original resolution criteria or rules that were defined when the market was created?

## External Source Comparison

21. Does Polymarket expose metadata about the external data sources or APIs that were designated as authoritative for resolution?

22. What format and precision are used for resolution outcomes (e.g., decimal places, rounding rules) to ensure accurate comparison with external sources?

23. How can an audit tool map Polymarket market identifiers to corresponding events or data points in external sources (e.g., sports APIs, election results)?

24. Are there documented resolution rules or rubrics published by Polymarket that define how edge cases and ambiguous outcomes should be resolved?

## Technical Integration

25. What SDKs, client libraries, or official code examples does Polymarket provide for interacting with resolution and settlement data?

26. Does Polymarket use CLOB (Central Limit Order Book) or CTF (Conditional Token Framework) contracts, and how does this affect resolution data retrieval?

27. What blockchain network(s) does Polymarket operate on, and what RPC endpoints are recommended for querying on-chain resolution data?

28. How can an audit tool differentiate between test/sandbox markets and production markets when querying resolution data?

29. What error codes or response statuses indicate resolution data is pending, unavailable, or in dispute?

30. Are there known latency or synchronization delays between on-chain resolution and API data availability that an audit tool should account for?
