# Technical Questions: Cross-Exchange Indexer for Polymarket

## Polymarket API Access and Authentication

1. What is the base URL for Polymarket's public API, and does it require API key authentication for accessing market price data?

2. Are there rate limits on Polymarket's API endpoints, and if so, what are the specific thresholds for price/odds queries?

3. Does Polymarket provide a WebSocket endpoint for real-time price streaming, and what is the connection protocol and message format?

## Market Data and Price Retrieval

4. What is the exact API endpoint structure for fetching current bid/ask prices and last traded prices for a specific market on Polymarket?

5. How are market prices represented in Polymarket's API response - as decimals (0.0-1.0), percentages, or some other format?

6. Does Polymarket expose order book depth data via API, and if so, what fields are included (price levels, quantities, timestamps)?

7. What is the polling frequency limitation for fetching price updates if WebSocket streaming is not available?

## Market Identification and Mapping

8. What is the structure of Polymarket's market identifier (condition ID, market slug, or numeric ID), and how can these be programmatically discovered?

9. Does Polymarket provide an API endpoint to list all active markets with their metadata, including market titles, descriptions, and resolution criteria?

10. How does Polymarket handle multi-outcome markets (more than binary yes/no), and how are the individual outcome tokens identified in the API?

11. Is there a CLOB (Central Limit Order Book) API separate from the AMM pricing, and how do the identifiers differ between these systems?

## Data Format and Normalization

12. What timestamp format does Polymarket use in API responses (Unix epoch, ISO 8601), and what timezone are timestamps referenced to?

13. How does Polymarket represent token amounts and prices - in wei, USDC units with specific decimal precision, or normalized values?

14. Does Polymarket's API provide historical price/OHLCV data, and if so, what time intervals are supported?

## Cross-Exchange Comparison Technical Details

15. Does Polymarket expose the underlying smart contract addresses for markets, enabling on-chain price verification as a fallback?

16. What is the latency typically observed between order execution and API price update reflection on Polymarket?

17. Are there any known discrepancies between Polymarket's displayed UI prices and API-returned prices that need to be accounted for?

## Integration and Infrastructure

18. Does Polymarket provide official SDK libraries (JavaScript, Python) for API integration, or is direct REST/WebSocket implementation required?

19. What are the CORS policies for Polymarket's API endpoints if building a browser-based indexer component?

20. Does Polymarket's API support bulk queries for multiple markets in a single request to optimize data ingestion for large-scale indexing?

21. Are there any GraphQL endpoints available for Polymarket data that might provide more flexible querying for cross-market comparisons?

22. How does Polymarket handle market resolution in the API - are there specific status fields or events that indicate a market has resolved?
