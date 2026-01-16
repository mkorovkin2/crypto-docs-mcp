# Technical Questions: Market Lifecycle Tracker

## Polymarket API & Infrastructure

1. What is the base URL for the Polymarket API, and does it require authentication for accessing market data?

2. Is there a dedicated REST endpoint for listing all markets, and what pagination or cursor-based mechanisms does it support?

3. Does Polymarket provide a GraphQL API in addition to REST, and if so, what schema fields are available for market lifecycle data?

4. What are the rate limits imposed on the Polymarket API for polling market data, and are there different tiers for authenticated vs. unauthenticated requests?

## Market Creation Detection

5. Is there a specific API endpoint that returns newly created markets, or must you poll a general markets endpoint and track deltas locally?

6. What fields in the market object indicate creation timestamp, and what datetime format does the API use?

7. Does the API support filtering markets by creation date range to efficiently detect new markets without fetching the entire market list?

8. What market metadata is available at creation time (e.g., question text, category, tags, resolution source, end date)?

9. Are there any WebSocket connections or Server-Sent Events (SSE) streams available for real-time market creation notifications?

## Market States & Lifecycle

10. What are the exact lifecycle states a Polymarket market can be in (e.g., open, closed, resolved, settled, disputed)?

11. How are these states represented in the API response—is there a single status field or multiple boolean flags?

12. What triggers the transition between each lifecycle state, and can these transitions be reversed?

13. Is there an API field that indicates the expected resolution date versus the actual resolution date?

14. How does the API represent markets that have been voided or cancelled, and what state values indicate this?

## Market Resolution Events

15. What API endpoint or field indicates when a market has been resolved, and what resolution outcome data is returned?

16. Does the resolution response include the oracle or data source that was used to determine the outcome?

17. How is the resolution outcome represented—as a binary value, percentage, or categorical identifier?

18. Is there a resolution timestamp field separate from the settlement timestamp?

19. What happens in the API response when a market resolution is disputed, and how is this state represented?

## Settlement Process

20. What is the distinction between market resolution and market settlement in Polymarket's architecture?

21. Is there a delay period between resolution and settlement, and if so, how is this represented in the API?

22. What API endpoint or field indicates when a market has been fully settled and payouts have been processed?

23. Does the settlement process occur on-chain, and if so, what blockchain and smart contract addresses are involved?

24. How can you track the settlement transaction hash or on-chain confirmation via the API?

## Event Streaming & Webhooks

25. Does Polymarket offer webhook registration for market lifecycle events, and what is the endpoint for configuring webhooks?

26. What event types can be subscribed to via webhooks (e.g., market_created, market_resolved, market_settled)?

27. If WebSocket support exists, what is the connection URL and what message format is used for lifecycle events?

28. What authentication mechanism is required for WebSocket connections or webhook callbacks?

29. How does Polymarket handle webhook delivery failures—is there retry logic or a dead letter queue?

## On-Chain Integration

30. What blockchain does Polymarket use for market contracts, and what are the relevant contract addresses?

31. Are there specific smart contract events (e.g., MarketCreated, MarketResolved) that can be monitored directly on-chain?

32. What is the ABI for the Polymarket market factory or conditional token contracts?

33. How do on-chain market identifiers (condition IDs) map to the API's market identifiers?

34. Is there an indexer or subgraph available for querying Polymarket's on-chain market data?

## Filtering & Query Capabilities

35. What query parameters does the API support for filtering markets by category, tag, or keyword?

36. Can you filter markets by their current lifecycle state in a single API call?

37. Does the API support sorting markets by creation date, resolution date, or volume?

38. Is there a way to subscribe to or query markets matching specific criteria (e.g., markets containing certain keywords)?

39. What fields are indexed and searchable versus those that require client-side filtering?

## Data Consistency & Reliability

40. What is the typical latency between a market state change and its reflection in the API?

41. How does the API handle eventual consistency, and are there cache headers or ETags to manage this?

42. Is there a changelog or event log endpoint that provides an ordered sequence of all market state transitions?

43. What error codes and retry strategies should be implemented when the API returns inconsistent state data?

44. Does Polymarket provide a sandbox or testnet environment for testing market lifecycle integrations?
