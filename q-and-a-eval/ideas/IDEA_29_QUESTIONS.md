# Technical Questions: Market Resolution Alerting Service (Idea 29)

## Polymarket API and Resolution Data

1. What Polymarket API endpoints provide information about market resolution times, and what is the structure of the response data?

2. Does the Polymarket API expose a dedicated endpoint for querying upcoming market resolutions within a specific time window?

3. What fields in the Polymarket market metadata indicate the expected resolution date/time, and are these stored as Unix timestamps or ISO 8601 strings?

4. How does Polymarket handle markets with variable or conditional resolution times (e.g., "resolves when event concludes"), and how is this represented in the API?

5. Is there a webhook or WebSocket subscription mechanism provided by Polymarket to receive real-time notifications when a market's resolution status changes?

6. What are the possible resolution states a Polymarket market can have (e.g., pending, resolving, resolved, disputed), and which API field contains this status?

7. Does the Polymarket API provide historical resolution data, including the actual timestamp when a market was resolved versus its originally scheduled resolution time?

8. What rate limits apply to Polymarket API endpoints when polling for resolution status updates across multiple markets?

9. How does the Polymarket API represent resolution criteria and resolution sources in the market metadata?

10. Is there a bulk endpoint to fetch resolution information for multiple markets in a single API call, or must each market be queried individually?

## Resolution Event Detection

11. What is the typical latency between a market being resolved on-chain and that resolution status being reflected in the Polymarket API?

12. Does Polymarket provide an event feed or changelog endpoint that lists recent resolution events across all markets?

13. How can you distinguish between a market that resolved normally versus one that was resolved through a dispute or UMA oracle process via the API?

14. What Polymarket API fields indicate whether a market resolution is final or still subject to challenge/dispute period?

15. Are there separate API endpoints for the CLOB (Central Limit Order Book) system versus on-chain resolution data, and how do they differ in resolution information?

## Integration Considerations

16. What authentication mechanisms are required to access resolution-related endpoints on the Polymarket API?

17. Does Polymarket's Gamma API or any other secondary API provide additional resolution metadata not available in the primary API?

18. How does Polymarket handle time zones in resolution timestamps, and is there a standard time zone used across all API responses?

19. What is the recommended polling interval for checking market resolution status without exceeding rate limits?

20. Are there any Polymarket SDK libraries (JavaScript, Python, etc.) that provide helper methods for monitoring resolution events?
