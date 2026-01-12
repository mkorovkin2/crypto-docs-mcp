# Lock-Free Atomics

> Concurrent updates without mutex locks

## Overview

The Polymarket-Kalshi Arbitrage Bot uses lock-free atomic operations for all hot-path data updates. This eliminates mutex contention and enables sub-millisecond orderbook updates.

## Why Lock-Free?

Traditional mutex-based synchronization has several drawbacks for high-frequency trading:

1. **Priority Inversion** - A low-priority thread holding a lock blocks high-priority threads
2. **Convoy Effect** - Threads queue up waiting for a single lock
3. **Deadlock Risk** - Multiple locks can cause circular dependencies
4. **Context Switching** - Blocked threads require expensive context switches

Lock-free operations avoid all of these by using atomic CPU instructions (CAS - Compare and Swap).

## AtomicOrderbook Implementation

The `AtomicOrderbook` stores four 16-bit prices in a single 64-bit atomic:

```rust
#[repr(align(64))]  // Cache-line aligned to prevent false sharing
pub struct AtomicOrderbook {
    data: AtomicU64,
}

// Bit layout: [bid_yes:16][ask_yes:16][bid_no:16][ask_no:16]
```

### Packing and Unpacking

```rust
pub fn pack_orderbook(bid_yes: u16, ask_yes: u16, bid_no: u16, ask_no: u16) -> u64 {
    ((bid_yes as u64) << 48) | 
    ((ask_yes as u64) << 32) |
    ((bid_no as u64) << 16) | 
    (ask_no as u64)
}

pub fn unpack_orderbook(packed: u64) -> (u16, u16, u16, u16) {
    (
        ((packed >> 48) & 0xFFFF) as u16,  // bid_yes
        ((packed >> 32) & 0xFFFF) as u16,  // ask_yes
        ((packed >> 16) & 0xFFFF) as u16,  // bid_no
        (packed & 0xFFFF) as u16,          // ask_no
    )
}
```

### Atomic Update

Full orderbook replacement:

```rust
impl AtomicOrderbook {
    pub fn update(&self, bid_yes: u16, ask_yes: u16, bid_no: u16, ask_no: u16) {
        let packed = pack_orderbook(bid_yes, ask_yes, bid_no, ask_no);
        self.data.store(packed, Ordering::Release);
    }
    
    pub fn get(&self) -> (u16, u16, u16, u16) {
        unpack_orderbook(self.data.load(Ordering::Acquire))
    }
}
```

### Compare-and-Swap for Partial Updates

When only one price changes (e.g., just bid_yes):

```rust
impl AtomicOrderbook {
    pub fn update_bid_yes(&self, new_bid_yes: u16) {
        loop {
            let current = self.data.load(Ordering::Acquire);
            let (_, ask_yes, bid_no, ask_no) = unpack_orderbook(current);
            let new = pack_orderbook(new_bid_yes, ask_yes, bid_no, ask_no);
            
            match self.data.compare_exchange_weak(
                current, new,
                Ordering::AcqRel,
                Ordering::Acquire
            ) {
                Ok(_) => break,
                Err(_) => continue,  // Retry on concurrent modification
            }
        }
    }
}
```

## Memory Ordering

The bot uses `Acquire/Release` semantics:

| Operation | Ordering | Purpose |
|-----------|----------|---------|
| `store()` | Release | Ensure all prior writes are visible |
| `load()` | Acquire | Ensure all subsequent reads see current data |
| CAS | AcqRel | Both guarantees for read-modify-write |

## Cache Line Alignment

```rust
#[repr(align(64))]
pub struct AtomicOrderbook { ... }
```

This prevents **false sharing** - when two unrelated atomics on the same cache line cause cache invalidation ping-pong between CPU cores.

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Load | ~1 ns | Single CPU instruction |
| Store | ~5 ns | Cache invalidation overhead |
| CAS (uncontended) | ~10 ns | Full atomic cycle |
| CAS (contended) | ~50-500 ns | Retry loop + cache traffic |

## When to Use Lock-Free

**Good candidates:**
- Counters, flags, simple state
- Fixed-size data that fits in atomic types
- Hot paths with many readers, few writers

**Poor candidates:**
- Variable-length data (strings, vectors)
- Complex multi-field updates that need consistency
- Infrequently accessed data (mutex is simpler)

## See Also

- [types.rs Module](../modules/types.md)
- [Atomic Orderbook Concept](atomic-orderbook.md)
- [Compare-and-Swap Concept](compare-and-swap.md)
