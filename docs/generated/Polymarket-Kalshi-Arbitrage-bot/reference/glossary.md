# Glossary

> Terms and definitions used in the Polymarket-Kalshi Arbitrage Bot

## A

**Arbitrage**
Simultaneously buying and selling the same asset in different markets to profit from price differences.

**Ask**
The lowest price a seller is willing to accept. Also called the "offer."

**Atomic**
An operation that completes entirely or not at all, with no intermediate state visible to other threads.

**AtomicOrderbook**
The bot's lock-free orderbook implementation using bit-packed `AtomicU64` storage.

## B

**Basis Points (BPS)**
One hundredth of a percent (0.01%). 100 bps = 1%.

**Bid**
The highest price a buyer is willing to pay.

**Bit-packing**
Storing multiple values in a single integer by using specific bit ranges for each value.

## C

**Cache Line**
A block of memory (typically 64 bytes) that CPUs load together. Aligning data to cache line boundaries prevents false sharing.

**CAS (Compare-and-Swap)**
An atomic operation that updates a value only if it matches an expected current value.

**Circuit Breaker**
A risk management pattern that halts trading when predefined limits are exceeded.

**CLOB (Central Limit Order Book)**
An order matching system that matches buyers and sellers based on price and time priority.

**Cost Basis**
The average price paid for a position, used to calculate profit/loss.

## D

**Deduplication**
Preventing duplicate orders from being submitted for the same market.

**Discovery**
The process of matching markets between Kalshi and Polymarket by event name.

## E

**Edge**
The expected profit margin on a trade, typically expressed in basis points.

**Exposure**
The total amount of capital at risk in open positions.

## F

**False Sharing**
When unrelated data on the same cache line causes unnecessary cache invalidation between CPU cores.

**Fill**
The execution of an order. A complete fill means the entire order quantity was executed.

**FxHash**
A fast, non-cryptographic hash function optimized for hash table lookups.

## G

**Guaranteed Profit**
The minimum profit locked in by a fully hedged arbitrage position, regardless of market outcome.

## H

**Heartbeat**
A periodic signal indicating a connection is still alive.

**Hedged**
A position where risk is offset by an opposing position in a related market.

## I

**In-Flight**
An order that has been submitted but not yet confirmed as filled or rejected.

## K

**Kalshi**
A regulated US prediction market exchange operated as a CFTC-regulated DCM.

## L

**Lock-Free**
A concurrency approach that avoids mutex locks in favor of atomic operations.

**Leg**
One side of a multi-part trade. Arbitrage positions have two legs (one per platform).

## M

**Maker**
A trader who adds liquidity by placing limit orders. Often receives fee rebates.

**Market Pair**
A matched set of equivalent markets on Kalshi and Polymarket.

**Memory Ordering**
Rules governing how atomic operations synchronize memory visibility between threads.

## N

**NEON**
ARM's SIMD instruction set, used on Apple Silicon and ARM servers.

## O

**Orderbook**
A list of buy and sell orders for a market, organized by price level.

## P

**Partial Fill**
An order that is only partially executed, leaving unfilled quantity.

**Polymarket**
A decentralized prediction market built on Polygon.

**Position**
The net quantity of contracts held in a market (positive = long, negative = short).

**P&L (Profit and Loss)**
The financial result of trading activity, either realized (closed) or unrealized (open).

## R

**Rate Limiting**
Restricting the frequency of API calls to comply with exchange limits.

**Release/Acquire**
Memory ordering semantics that ensure visibility of memory writes across threads.

## S

**SIMD (Single Instruction Multiple Data)**
CPU instructions that operate on multiple data points in parallel.

**Spread**
The difference between the best bid and best ask prices.

**SSE/AVX**
Intel/AMD SIMD instruction sets (Streaming SIMD Extensions / Advanced Vector Extensions).

## T

**Taker**
A trader who removes liquidity by matching existing orders. Usually pays fees.

**Ticker**
A unique identifier for a market (e.g., "NFL-KC-DET-2024").

**Token ID**
Polymarket's unique identifier for a market outcome.

**Trip**
When a circuit breaker activates and halts trading.

**TTL (Time To Live)**
How long cached data remains valid before requiring refresh.

## W

**WebSocket**
A protocol for bidirectional, real-time communication between client and server.

**wide**
A Rust crate providing portable SIMD operations across different CPU architectures.

## Y

**YES/NO**
Binary outcome tokens in prediction markets. YES pays $1 if the event occurs, NO pays $1 if it doesn't.

---

## See Also

- [Concepts Overview](../concepts/index.md)
- [API Reference](../api/index.md)
- [Architecture Overview](../architecture/index.md)
