# Architecture Documentation

> Detailed architectural documentation for Litecoin Core, covering design, data flow, and system interactions.

---

## Overview

This section contains detailed architectural documentation that goes beyond the high-level overview. Here you'll find in-depth analysis of system design, data structures, algorithms, and component interactions.

**Audience:** Senior developers, system architects, researchers
**Prerequisites:** Understanding of [Architecture Overview](../architecture-overview.md)

---

## Architecture Documents

### Data Flow

**File:** [data-flow.md](./data-flow.md)

Comprehensive data flow diagrams and explanations.

**Contents:**
- Transaction lifecycle flow
- Block validation flow
- Network message flow
- Wallet synchronization flow
- MWEB transaction flow
- Index update flow

**Transaction Flow Diagram:**
```
User/Application
    ↓ [Create Transaction]
Wallet
    ↓ [Sign Transaction]
Mempool Validation
    ↓ [Accept to Mempool]
P2P Network
    ↓ [Broadcast]
Mempool (Other Nodes)
    ↓ [Include in Block]
Miner
    ↓ [Mine Block]
Block Validation
    ↓ [Add to Chain]
Blockchain
    ↓ [Confirm Transaction]
User/Application
```

---

### Module Relationships

**File:** [module-relationships.md](./module-relationships.md)

Detailed dependency graphs and interaction patterns.

**Contents:**
- Module dependency graph
- Interface boundaries
- Layered architecture
- Component interactions
- Circular dependency resolution

**Dependency Layers:**
```
Layer 5 (Application):
    ├── qt (GUI)
    ├── init (Initialization)
    └── main entry points

Layer 4 (Services):
    ├── wallet (Wallet services)
    ├── miner (Mining)
    ├── rpc (RPC server)
    └── net (Networking)

Layer 3 (Core Logic):
    ├── validation (Validation engine)
    ├── consensus (Consensus rules)
    └── mweb (MWEB logic)

Layer 2 (Data Structures):
    ├── primitives (Blocks, transactions)
    ├── script (Script processing)
    └── policy (Policies)

Layer 1 (Foundation):
    ├── crypto (Cryptography)
    └── util (Utilities)
```

---

### Threading Model

**File:** [threading-model.md](./threading-model.md)

Detailed analysis of threading architecture.

**Contents:**
- Thread overview
- Thread lifecycle
- Synchronization primitives
- Lock ordering
- Deadlock prevention
- Thread-safe patterns

**Thread Categories:**

1. **Main Threads**
   - Main thread
   - Message handler
   - Script verification pool
   - RPC worker threads

2. **Background Threads**
   - Scheduled flush
   - Import thread
   - Tor control
   - DNSeed resolution

3. **Per-Connection Threads**
   - Send thread
   - Receive thread

**Critical Locks:**
```cpp
// Lock hierarchy (must be acquired in this order):
1. cs_main          // Main validation lock
2. cs_wallet        // Wallet lock
3. cs_vNodes        // Network nodes lock
4. cs_mapLocalHost  // Local interface lock

// Example correct locking:
LOCK(cs_main);
LOCK(wallet->cs_wallet);  // OK

// Example WRONG locking (will deadlock):
LOCK(wallet->cs_wallet);
LOCK(cs_main);  // DEADLOCK!
```

---

### Memory Management

**File:** [memory-management.md](./memory-management.md)

Memory allocation strategies and cache management.

**Contents:**
- Memory pools
- UTXO cache architecture
- Block cache
- Mempool memory management
- Smart pointers usage
- Memory limits and eviction

**Memory Layout:**
```
Total Memory (~1-6 GB typical):

┌─────────────────────────────────────┐
│  UTXO Cache (300-5000 MB)           │  Configurable
│  - Coins database cache             │  -dbcache=N
│  - Frequently accessed UTXOs        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Mempool (300-500 MB)               │  Configurable
│  - Unconfirmed transactions         │  -maxmempool=N
│  - Fee estimation data              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Block Validation (100-200 MB)      │  Dynamic
│  - Block being validated            │
│  - Undo data                        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Network Buffers (50-100 MB)        │  Per connection
│  - Send buffers                     │
│  - Receive buffers                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Wallet (50-200 MB per wallet)      │  Per wallet
│  - Keys and addresses               │
│  - Transaction history              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Other (100-200 MB)                 │  Fixed
│  - Code and data                    │
│  - Indexes                          │
└─────────────────────────────────────┘
```

**Cache Eviction Strategies:**
- LRU (Least Recently Used)
- Priority-based
- Size-based
- Age-based

---

### Database Design

**File:** [database-design.md](./database-design.md)

Database architecture and storage strategies.

**Contents:**
- LevelDB structure
- Key-value schema
- Indexing strategies
- Compaction and maintenance
- Backup and recovery

**Database Structure:**

```
Blockchain Database (LevelDB):
├── Block Index
│   Key: 'b' + block_hash
│   Value: CDiskBlockIndex
│
├── UTXO Set
│   Key: 'C' + txid + output_index
│   Value: Coin (compressed)
│
├── Transaction Index (optional)
│   Key: 't' + txid
│   Value: CDiskTxPos
│
├── Block File Info
│   Key: 'f' + file_number
│   Value: CBlockFileInfo
│
└── Best Block
    Key: 'B'
    Value: block_hash

Wallet Database (BDB/SQLite):
├── Keys
│   Key: 'key' + pubkey
│   Value: privkey (encrypted)
│
├── Metadata
│   Key: 'keymeta' + pubkey
│   Value: CKeyMetadata
│
├── Transactions
│   Key: 'tx' + txid
│   Value: CWalletTx
│
└── Settings
    Key: 'setting' + name
    Value: value
```

---

### Network Architecture

**File:** [network-architecture.md](./network-architecture.md)

P2P network design and protocols.

**Contents:**
- Network topology
- Peer selection
- Connection management
- Message format
- Inventory system
- Block relay strategies

**Network Layers:**

```
┌──────────────────────────────────────┐
│  Application Layer                   │
│  - Block/Transaction relay           │
│  - Address advertisement             │
│  - Ping/Pong                         │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│  P2P Protocol Layer                  │
│  - Message framing                   │
│  - Message types                     │
│  - Checksumming                      │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│  Transport Layer                     │
│  - TCP connections                   │
│  - Socket management                 │
│  - Buffer management                 │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│  Network Layer                       │
│  - IP routing                        │
│  - NAT traversal                     │
│  - Tor support                       │
└──────────────────────────────────────┘
```

**Message Types:**
| Category | Messages |
|----------|----------|
| Handshake | version, verack |
| Control | ping, pong, reject, sendheaders |
| Inventory | inv, getdata, notfound |
| Blocks | block, headers, getblocks, getheaders |
| Transactions | tx, mempool |
| Addresses | addr, getaddr |

---

### Validation Pipeline

**File:** [validation-pipeline.md](./validation-pipeline.md)

Step-by-step block and transaction validation.

**Contents:**
- Validation stages
- Checkpoints
- Script verification
- UTXO management
- Reorganization handling

**Block Validation Stages:**

```
Stage 1: Pre-Checks
├── Check block size
├── Check PoW
├── Check timestamp
└── Check version

Stage 2: Context Checks
├── Check height
├── Check previous block
├── Check difficulty
└── Check coinbase

Stage 3: Transaction Checks
├── For each transaction:
│   ├── Check syntax
│   ├── Check inputs exist
│   ├── Check amounts
│   └── Check scripts
└── Check merkle root

Stage 4: UTXO Updates
├── Connect block
├── Update UTXO set
├── Create undo data
└── Update indexes

Stage 5: Finalization
├── Mark block as validated
├── Update chain tip
├── Notify subscribers
└── Relay to peers
```

---

### Consensus Implementation

**File:** [consensus-implementation.md](./consensus-implementation.md)

How consensus rules are implemented and enforced.

**Contents:**
- Consensus critical code
- Soft fork activation
- Hard fork prevention
- Rule versioning
- Testing consensus changes

**Soft Fork Activation (BIP9):**
```
State Machine:

DEFINED → STARTED → LOCKED_IN → ACTIVE
                  ↓
              FAILED

States:
- DEFINED: Waiting for start time
- STARTED: Signaling period active
- LOCKED_IN: Threshold reached, grace period
- ACTIVE: Rules now enforced
- FAILED: Timeout without activation
```

---

### MWEB Architecture

**File:** [mweb-architecture.md](./mweb-architecture.md)

Detailed MWEB implementation architecture.

**Contents:**
- Extension block design
- PMMR structure
- Stealth address scheme
- Peg-in/peg-out mechanism
- Cut-through optimization

**MWEB Components:**

```
┌─────────────────────────────────────┐
│  MWEB Extension Block                │
│  ┌─────────────────────────────┐    │
│  │  Kernel Set                 │    │
│  │  - Transaction kernels      │    │
│  │  - Excess signatures        │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  Input Set (PMMR)           │    │
│  │  - Previous outputs spent   │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  Output Set (PMMR)          │    │
│  │  - New outputs created      │    │
│  │  - Rangeproofs              │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  Peg-In/Peg-Out Txs         │    │
│  │  - LTC → MWEB transfers     │    │
│  │  - MWEB → LTC transfers     │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

### Wallet Architecture

**File:** [wallet-architecture.md](./wallet-architecture.md)

Internal wallet implementation details.

**Contents:**
- Wallet database schema
- Key management hierarchy
- Transaction building process
- Coin selection algorithms
- Fee estimation integration

**Wallet Components:**

```
CWallet
├── ScriptPubKeyMan (Key Management)
│   ├── LegacyScriptPubKeyMan
│   │   └── Keypool management
│   └── DescriptorScriptPubKeyMan
│       └── Descriptor-based keys
│
├── WalletDatabase (Storage)
│   ├── BerkeleyDatabase (Legacy)
│   └── SQLiteDatabase (Modern)
│
├── TransactionRecord (History)
│   └── Transaction metadata
│
└── CoinSelection (UTXO Management)
    ├── Knapsack solver
    ├── Branch and bound
    └── SRD (Single Random Draw)
```

---

### RPC Architecture

**File:** [rpc-architecture.md](./rpc-architecture.md)

JSON-RPC server implementation.

**Contents:**
- Server design
- Request handling pipeline
- Authentication mechanisms
- Response formatting
- Error handling

**RPC Request Pipeline:**

```
HTTP Request
    ↓
HTTP Server
    ↓
Authentication Check
    ↓
JSON Parser
    ↓
Method Router
    ↓
Parameter Validation
    ↓
Method Handler
    ↓
Result Formatting
    ↓
JSON Response
    ↓
HTTP Response
```

---

### Performance Architecture

**File:** [performance-architecture.md](./performance-architecture.md)

Performance-critical design decisions.

**Contents:**
- Caching strategies
- Parallelization techniques
- I/O optimization
- Network optimization
- Profiling results

**Performance Bottlenecks:**

| Component | Bottleneck | Solution |
|-----------|------------|----------|
| Validation | Script verification | Parallel verification |
| Database | Disk I/O | Large cache, batch writes |
| Network | Bandwidth | Compact blocks, filters |
| Mempool | Memory usage | Size limits, eviction |

---

### Security Architecture

**File:** [security-architecture.md](./security-architecture.md)

Security design principles and implementations.

**Contents:**
- Defense in depth
- Attack surface minimization
- Cryptographic security
- Network security
- Process isolation

**Security Layers:**

```
Layer 1: Cryptographic Security
- ECDSA signatures
- Scrypt PoW
- Hash functions

Layer 2: Consensus Security
- Strict validation
- PoW requirement
- Difficulty adjustment

Layer 3: Network Security
- Peer banning
- Rate limiting
- DoS protection

Layer 4: Process Security
- Privilege separation
- Sandboxing
- Resource limits

Layer 5: Operational Security
- Key management
- Backup procedures
- Monitoring
```

---

### Testing Architecture

**File:** [testing-architecture.md](./testing-architecture.md)

Testing infrastructure and strategies.

**Contents:**
- Test framework architecture
- Test categories
- Mocking strategies
- CI/CD pipeline
- Coverage analysis

---

## Diagrams and Visualizations

### Component Diagram

**File:** [component-diagram.md](./component-diagram.md)

UML component diagrams for major subsystems.

---

### Sequence Diagrams

**File:** [sequence-diagrams.md](./sequence-diagrams.md)

Interaction diagrams for key operations:
- Transaction creation and broadcast
- Block validation and relay
- Wallet synchronization
- RPC request handling

---

### State Diagrams

**File:** [state-diagrams.md](./state-diagrams.md)

State machines for:
- Peer connection lifecycle
- Block validation states
- Wallet transaction states

---

## Design Documents

### Design Principles

**File:** [design-principles.md](./design-principles.md)

Core design principles guiding Litecoin Core development.

**Principles:**
1. Security first
2. Decentralization
3. Backward compatibility
4. Performance
5. Code quality
6. Documentation

---

### Design Patterns

**File:** [design-patterns.md](./design-patterns.md)

Common design patterns used in the codebase.

**Patterns:**
- Singleton (ChainActive)
- Observer (Signals)
- Strategy (Coin selection)
- Factory (Transaction creation)
- Command (RPC)

---

### API Design

**File:** [api-design.md](./api-design.md)

Principles for internal and external API design.

---

## Performance Analysis

### Benchmarks

**File:** [benchmarks.md](./benchmarks.md)

Performance benchmarks and results.

**Key Metrics:**
- Block validation time
- Transaction throughput
- Memory usage
- Disk I/O
- Network bandwidth

---

### Profiling Results

**File:** [profiling-results.md](./profiling-results.md)

Results from performance profiling sessions.

---

## Future Architecture

### Planned Changes

**File:** [future-architecture.md](./future-architecture.md)

Upcoming architectural changes and improvements.

**Topics:**
- Process separation
- Modularization
- Protocol upgrades
- Scalability improvements

---

## See Also

- [Architecture Overview](../architecture-overview.md) - High-level overview
- [Modules](../modules/index.md) - Module documentation
- [Concepts](../concepts/index.md) - Core concepts
- [Guides](../guides/index.md) - Developer guides

---

## Navigation

← [Architecture Overview](../architecture-overview.md) | [Modules](../modules/index.md) | [Concepts](../concepts/index.md) →

---

*Last Updated: 2026-01-12*
*Part of the Litecoin Core Documentation Project*
