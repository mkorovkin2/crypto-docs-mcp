# Litecoin Core Architecture Overview

> A comprehensive overview of the Litecoin Core system architecture, component interactions, and data flow.

---

## Table of Contents

- [Introduction](#introduction)
- [High-Level Architecture](#high-level-architecture)
- [System Components](#system-components)
- [Data Flow](#data-flow)
- [Component Interactions](#component-interactions)
- [Threading Model](#threading-model)
- [Storage Architecture](#storage-architecture)
- [Network Architecture](#network-architecture)
- [Module Dependencies](#module-dependencies)

---

## Introduction

Litecoin Core is a full node implementation of the Litecoin cryptocurrency network. It implements the complete protocol specification, including consensus rules, peer-to-peer networking, blockchain validation, and wallet functionality. The architecture is designed to be modular, secure, and performant.

### Design Principles

1. **Security First:** All consensus-critical code is heavily tested and reviewed
2. **Modularity:** Clear separation of concerns between components
3. **Performance:** Optimized for validation speed and memory efficiency
4. **Compatibility:** Maintains compatibility with Bitcoin Core improvements
5. **Extensibility:** Designed to support future protocol enhancements

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  litecoin-qt │  │  litecoind   │  │ litecoin-cli │          │
│  │    (GUI)     │  │   (Daemon)   │  │    (CLI)     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼─────────────────┐
│         │      Interface Layer (IPC/RPC)      │                 │
│  ┌──────▼──────────────────▼──────────────────▼───────┐         │
│  │         RPC Server / JSON-RPC Interface             │         │
│  └──────────────────────┬──────────────────────────────┘         │
└─────────────────────────┼────────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────────────┐
│                         │        Core Layer                       │
│  ┌──────────────────────▼─────────────────────────────┐          │
│  │              Node (ChainstateManager)              │          │
│  └──┬────────────┬────────────┬────────────┬─────────┘          │
│     │            │            │            │                     │
│  ┌──▼────┐  ┌───▼────┐  ┌───▼────┐  ┌───▼────┐                │
│  │Wallet │  │Mempool │  │Chainst.│  │ MWEB   │                │
│  │Manager│  │Manager │  │Manager │  │ Node   │                │
│  └───────┘  └────────┘  └────────┘  └────────┘                │
└─────────────────────────────────────────────────────────────────┘
          │            │            │            │
┌─────────┼────────────┼────────────┼────────────┼────────────────┐
│         │   Consensus & Validation Layer       │                │
│  ┌──────▼─────┐  ┌──────────┐  ┌────────────────────┐          │
│  │ Validation │  │  Script  │  │   Consensus Rules  │          │
│  │   Engine   │  │Interpreter│  │  (Block/Tx Check)  │          │
│  └────────────┘  └──────────┘  └────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
          │            │            │
┌─────────┼────────────┼────────────┼────────────────────────────┐
│         │      Storage Layer       │                            │
│  ┌──────▼─────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐      │
│  │  LevelDB   │  │   BDB   │  │  SQLite  │  │  FlatDB  │      │
│  │ (Blockchain)│ │(Wallet) │  │ (Wallet) │  │(Indexes) │      │
│  └────────────┘  └─────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────────────────────┘
          │
┌─────────┼─────────────────────────────────────────────────────┐
│         │          Network Layer                               │
│  ┌──────▼──────────────────────────────────────┐              │
│  │           P2P Network Manager                │              │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │              │
│  │  │  Peer    │  │ Message  │  │  Block   │  │              │
│  │  │Discovery │  │Processing│  │ Relay    │  │              │
│  │  └──────────┘  └──────────┘  └──────────┘  │              │
│  └──────────────────────┬───────────────────────┘              │
└─────────────────────────┼────────────────────────────────────┘
                          │
                   ┌──────▼──────┐
                   │   Network   │
                   │   (TCP/IP)  │
                   └─────────────┘
```

---

## System Components

### 1. Application Layer

#### litecoin-qt (GUI)
- **Purpose:** Graphical user interface for Litecoin Core
- **Technology:** Qt framework (C++)
- **Features:**
  - Wallet management
  - Transaction creation and viewing
  - Network status monitoring
  - Settings configuration
  - Address book management
  - MWEB transaction support

#### litecoind (Daemon)
- **Purpose:** Headless server daemon
- **Usage:** Background service, production deployments
- **Features:**
  - Full node operation
  - RPC server
  - Wallet service (optional)
  - No GUI overhead

#### litecoin-cli (CLI)
- **Purpose:** Command-line RPC client
- **Usage:** Interact with litecoind
- **Features:**
  - Execute RPC commands
  - Batch operations
  - Scripting support

### 2. Interface Layer

#### RPC Server
- **Protocol:** JSON-RPC 1.0
- **Transport:** HTTP/HTTPS
- **Authentication:** Basic Auth / Cookie-based
- **Features:**
  - ~100+ RPC methods
  - Batch request support
  - Named parameters
  - Error handling

**Key RPC Categories:**
- **Blockchain:** Block and chain queries
- **Wallet:** Wallet operations
- **Network:** Peer management
- **Mining:** Mining operations
- **Utility:** Various utilities

#### REST Interface
- **Protocol:** HTTP REST
- **Format:** Binary, JSON, HEX
- **Endpoints:**
  - GET `/rest/block/`
  - GET `/rest/tx/`
  - GET `/rest/chaininfo`
  - GET `/rest/headers/`

### 3. Core Layer

#### Node (ChainstateManager)
The central orchestrator managing all blockchain state and operations.

**Responsibilities:**
- Coordinate validation
- Manage chain state
- Handle reorganizations
- Prune blockchain data
- Maintain UTXO set

**Key Classes:**
- `ChainstateManager`: Main coordinator
- `CChainState`: Individual chain state
- `CCoinsViewCache`: UTXO cache
- `BlockManager`: Block storage management

#### Wallet Manager
Manages one or more wallet instances.

**Features:**
- Multi-wallet support
- HD wallet support
- Descriptor wallets
- MWEB wallet integration
- Fee estimation
- Coin control

**Key Classes:**
- `CWallet`: Main wallet class
- `ScriptPubKeyMan`: Script/key manager
- `WalletDatabase`: Database abstraction
- `CoinSelection`: Coin selection algorithms

#### Mempool Manager
Manages unconfirmed transactions.

**Responsibilities:**
- Transaction validation
- Fee estimation
- Replacement policies (RBF)
- Transaction relay
- Eviction policies

**Key Classes:**
- `CTxMemPool`: Main mempool
- `CTxMemPoolEntry`: Mempool entry
- `BlockAssembler`: Block template creation

#### MWEB Node
Handles MimbleWimble Extension Block functionality.

**Features:**
- MWEB block validation
- PMMR management
- Stealth address support
- Peg-in/peg-out operations

**Key Classes:**
- `MWEB::Node`: MWEB coordinator
- `MWEB::Wallet`: MWEB wallet
- `MWEB::Miner`: MWEB mining support

### 4. Consensus & Validation Layer

#### Validation Engine
Core validation logic for blocks and transactions.

**Components:**
- `ConnectBlock()`: Connect block to chain
- `DisconnectBlock()`: Handle reorganizations
- `CheckBlock()`: Consensus-level checks
- `AcceptBlock()`: Policy-level checks

**Validation Steps:**
1. Syntax validation
2. Contextual validation
3. Script validation
4. UTXO updates
5. Index updates

#### Script Interpreter
Executes and validates Bitcoin Script.

**Features:**
- Opcode execution
- Stack-based evaluation
- Signature verification
- SegWit support
- Taproot support (planned)

**Security Features:**
- Script size limits
- Opcode limits
- Stack size limits
- Signature validation caching

#### Consensus Rules
Implements Litecoin-specific consensus rules.

**Key Rules:**
- Block time: 2.5 minutes
- Block size: 1MB base (4MB weight)
- Difficulty adjustment: Every 2016 blocks
- Halving: Every 840,000 blocks
- Scrypt proof-of-work
- MWEB extension blocks

### 5. Storage Layer

#### LevelDB (Blockchain)
Primary blockchain database.

**Stores:**
- Block index
- UTXO set
- Transaction index (optional)
- Block undo data

**Characteristics:**
- Key-value store
- Fast writes
- Efficient range queries
- Automatic compression

#### BDB/SQLite (Wallet)
Wallet database backends.

**BDB (Legacy):**
- Berkeley DB
- Page-based storage
- Environment management

**SQLite (Modern):**
- Self-contained database
- Better reliability
- Easier backup/recovery

#### FlatDB (Indexes)
Simple flat file storage for indexes.

**Used For:**
- Address index
- Spent index
- Timestamp index

### 6. Network Layer

#### P2P Network Manager
Handles peer-to-peer communication.

**Components:**
- **Connection Manager:** Establishes and maintains connections
- **Message Handler:** Processes P2P messages
- **Inventory System:** Tracks known transactions/blocks
- **Block Relay:** Optimized block propagation

**P2P Messages:**
- `version/verack`: Handshake
- `inv`: Inventory announcement
- `getdata`: Request data
- `tx`: Transaction
- `block`: Block data
- `headers`: Block headers
- `ping/pong`: Keepalive

**Network Features:**
- **Bloom Filters:** SPV client support
- **Compact Blocks:** Bandwidth optimization
- **FIBRE:** Fast block relay
- **DNS Seeds:** Peer discovery
- **Tor Support:** Privacy

---

## Data Flow

### Transaction Flow

```
┌─────────────┐
│   User      │
│  (Wallet)   │
└──────┬──────┘
       │ 1. Create Transaction
       ▼
┌─────────────────┐
│  Transaction    │
│   Builder       │
└──────┬──────────┘
       │ 2. Sign Transaction
       ▼
┌─────────────────┐
│  Mempool        │
│  Validation     │
└──────┬──────────┘
       │ 3. Accept to Mempool
       ▼
┌─────────────────┐
│  P2P Relay      │
│  (Broadcast)    │
└──────┬──────────┘
       │ 4. Propagate to Peers
       ▼
┌─────────────────┐
│  Mining         │
│  (Block)        │
└──────┬──────────┘
       │ 5. Include in Block
       ▼
┌─────────────────┐
│  Block          │
│  Validation     │
└──────┬──────────┘
       │ 6. Add to Blockchain
       ▼
┌─────────────────┐
│  Confirmed      │
│  Transaction    │
└─────────────────┘
```

### Block Validation Flow

```
┌─────────────┐
│   P2P       │
│  Network    │
└──────┬──────┘
       │ 1. Receive Block
       ▼
┌─────────────────────┐
│  Syntax Check       │
│  (CheckBlock)       │
└──────┬──────────────┘
       │ 2. Check Structure
       ▼
┌─────────────────────┐
│  Context Check      │
│  (ContextualCheck)  │
└──────┬──────────────┘
       │ 3. Check with Chain
       ▼
┌─────────────────────┐
│  UTXO Validation    │
│  (ConnectBlock)     │
└──────┬──────────────┘
       │ 4. Apply Changes
       ▼
┌─────────────────────┐
│  Update Indexes     │
│  (UpdateIndexes)    │
└──────┬──────────────┘
       │ 5. Update State
       ▼
┌─────────────────────┐
│  Notify Wallet      │
│  (SyncTransaction)  │
└──────┬──────────────┘
       │ 6. Update Wallet
       ▼
┌─────────────────────┐
│  Relay to Peers     │
│  (RelayBlock)       │
└─────────────────────┘
```

### MWEB Transaction Flow

```
┌─────────────┐
│  MWEB       │
│  Wallet     │
└──────┬──────┘
       │ 1. Build MWEB Tx
       ▼
┌─────────────────┐
│  Stealth        │
│  Address Gen    │
└──────┬──────────┘
       │ 2. Create Output
       ▼
┌─────────────────┐
│  Rangeproof     │
│  Generation     │
└──────┬──────────┘
       │ 3. Prove Amount
       ▼
┌─────────────────┐
│  Kernel         │
│  Signature      │
└──────┬──────────┘
       │ 4. Sign Transaction
       ▼
┌─────────────────┐
│  MWEB           │
│  Validation     │
└──────┬──────────┘
       │ 5. Validate MWEB Rules
       ▼
┌─────────────────┐
│  Extension      │
│  Block          │
└──────┬──────────┘
       │ 6. Add to EB
       ▼
┌─────────────────┐
│  PMMR           │
│  Update         │
└─────────────────┘
```

---

## Component Interactions

### Wallet ↔ Node Interaction

```
┌──────────────┐                    ┌──────────────┐
│              │  1. GetBalance()   │              │
│    Wallet    │─────────────────→  │     Node     │
│              │                    │  (Chainstate)│
│              │  2. UTXO Set       │              │
│              │←─────────────────  │              │
│              │                    │              │
│              │  3. SendTx()       │              │
│              │─────────────────→  │              │
│              │                    │              │
│              │  4. TxAccepted     │              │
│              │←─────────────────  │              │
│              │                    │              │
│              │  5. NewBlock       │              │
│              │←─────────────────  │              │
│              │  (Notification)    │              │
└──────────────┘                    └──────────────┘
```

### Mempool ↔ Network Interaction

```
┌──────────────┐                    ┌──────────────┐
│              │  1. New Tx (inv)   │              │
│   Network    │─────────────────→  │   Mempool    │
│   (P2P)      │                    │              │
│              │  2. GetData        │              │
│              │←─────────────────  │              │
│              │                    │              │
│              │  3. Tx Data        │              │
│              │─────────────────→  │              │
│              │                    │              │
│              │  4. Validate       │              │
│              │                    │  (Internal)  │
│              │                    │              │
│              │  5. Relay (inv)    │              │
│              │←─────────────────  │              │
└──────────────┘                    └──────────────┘
```

### Validation ↔ Storage Interaction

```
┌──────────────┐                    ┌──────────────┐
│              │  1. GetCoin()      │              │
│  Validation  │─────────────────→  │   Storage    │
│   Engine     │                    │  (LevelDB)   │
│              │  2. UTXO Data      │              │
│              │←─────────────────  │              │
│              │                    │              │
│              │  3. UpdateUTXO     │              │
│              │─────────────────→  │              │
│              │                    │              │
│              │  4. WriteBlock     │              │
│              │─────────────────→  │              │
│              │                    │              │
│              │  5. Commit         │              │
│              │←─────────────────  │              │
└──────────────┘                    └──────────────┘
```

---

## Threading Model

Litecoin Core uses multiple threads to improve performance and responsiveness.

### Main Threads

```
┌─────────────────────────────────────────────────────────────┐
│  Main Thread                                                 │
│  - Initialization                                            │
│  - Event loop (Qt GUI)                                       │
│  - RPC request handling                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Message Handler Thread                                      │
│  - Process P2P messages                                      │
│  - Handle network events                                     │
│  - Inventory management                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Script Verification Threads (Pool)                          │
│  - Parallel script validation                                │
│  - Signature verification                                    │
│  - Configurable thread count                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  OpenConnections Thread                                      │
│  - Establish new peer connections                            │
│  - DNS seed resolution                                       │
│  - Connection management                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ScheduledFlush Thread                                       │
│  - Periodic database flushes                                 │
│  - UTXO cache management                                     │
│  - Wallet database flushes                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Import Thread                                               │
│  - Block import operations                                   │
│  - Blockchain reindex                                        │
│  - Bootstrap loading                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Wallet Threads (per wallet)                                 │
│  - Transaction scanning                                      │
│  - Address watching                                          │
│  - Balance calculation                                       │
└─────────────────────────────────────────────────────────────┘
```

### Thread Synchronization

**Mutexes/Locks:**
- `cs_main`: Main validation lock
- `cs_wallet`: Wallet operations lock
- `cs_vNodes`: Peer list lock
- `cs_mapLocalHost`: Network interface lock

**Lock Ordering:**
Critical to prevent deadlocks. Common order:
1. `cs_main`
2. `cs_wallet`
3. `cs_vNodes`

---

## Storage Architecture

### Database Layout

```
~/.litecoin/
├── blocks/                    # Block storage
│   ├── blk00000.dat          # Block data files
│   ├── blk00001.dat
│   ├── rev00000.dat          # Undo data files
│   └── index/                # Block index (LevelDB)
│       ├── 000003.log
│       └── CURRENT
├── chainstate/               # UTXO set (LevelDB)
│   ├── 000003.log
│   └── CURRENT
├── indexes/                  # Optional indexes
│   ├── txindex/             # Transaction index
│   └── blockfilter/         # Block filters
├── wallets/                 # Wallet directory
│   ├── wallet.dat           # Wallet (BDB/SQLite)
│   └── mweb_wallet.dat      # MWEB wallet data
├── mweb/                    # MWEB data
│   ├── pmmr/                # PMMR structure
│   └── store/               # MWEB store
├── debug.log                # Debug log
├── litecoin.conf            # Configuration
└── peers.dat                # Peer database
```

### Data Organization

**Block Storage:**
- **Format:** Raw blocks in .dat files
- **Indexing:** LevelDB index for quick lookup
- **Undo Data:** Allows block disconnection
- **Pruning:** Optional removal of old blocks

**UTXO Set:**
- **Format:** Compressed in LevelDB
- **Caching:** In-memory cache for performance
- **Flushing:** Periodic writes to disk
- **Size:** ~2-4 GB for full UTXO set

**Wallet Database:**
- **BDB:** Legacy format, page-based
- **SQLite:** Modern format, more reliable
- **Contents:** Keys, transactions, metadata
- **Encryption:** Optional wallet encryption

---

## Network Architecture

### Peer Connection Management

```
┌─────────────────────────────────────────────────────────┐
│  Peer Slots                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ Outbound   │  │  Inbound   │  │  Manual    │        │
│  │  (8-10)    │  │ (117 max)  │  │  (Custom)  │        │
│  └────────────┘  └────────────┘  └────────────┘        │
└─────────────────────────────────────────────────────────┘
```

**Connection Types:**
- **Outbound:** Initiated by local node (8-10 connections)
- **Inbound:** Initiated by remote peers (up to 117)
- **Manual:** Explicitly added with `-addnode`
- **Feeler:** Temporary connections for peer discovery

**Peer Selection:**
1. DNS seeds (initial)
2. Peer database (cached)
3. Address advertisements (ongoing)
4. Manual additions

### Message Processing Pipeline

```
Network Socket
    ↓
Receive Buffer
    ↓
Message Parser
    ↓
Message Validator
    ↓
┌─────────────────┐
│ Message Router  │
└────────┬────────┘
         ├──→ Block Handler
         ├──→ Transaction Handler
         ├──→ Inventory Handler
         ├──→ Address Handler
         └──→ Control Handler
```

---

## Module Dependencies

### Dependency Graph

```
                    ┌──────────┐
                    │   main   │
                    └─────┬────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
       ┌────▼────┐   ┌───▼────┐   ┌───▼────┐
       │ wallet  │   │  miner │   │   qt   │
       └────┬────┘   └───┬────┘   └───┬────┘
            │            │            │
            └────────┬───┴────────────┘
                     │
              ┌──────▼───────┐
              │ validation   │
              └──────┬───────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐ ┌───▼────┐ ┌───▼────┐
    │consensus│ │ script │ │  mweb  │
    └────┬────┘ └───┬────┘ └───┬────┘
         │          │          │
         └──────┬───┴──────────┘
                │
         ┌──────▼───────┐
         │  primitives  │
         └──────┬───────┘
                │
         ┌──────▼───────┐
         │    crypto    │
         └──────┬───────┘
                │
         ┌──────▼───────┐
         │     util     │
         └──────────────┘
```

### Layer Dependencies

**Layer 1 (Foundation):**
- `util/`: Utilities and helpers
- `crypto/`: Cryptographic primitives

**Layer 2 (Data Structures):**
- `primitives/`: Basic data types
- `script/`: Script processing

**Layer 3 (Core Logic):**
- `consensus/`: Consensus rules
- `validation/`: Validation logic
- `mweb/`: MWEB functionality

**Layer 4 (Services):**
- `wallet/`: Wallet services
- `miner/`: Mining functionality
- `net/`: Network services
- `rpc/`: RPC interface

**Layer 5 (Application):**
- `qt/`: GUI application
- `init/`: Initialization
- `main`: Main entry points

---

## Performance Considerations

### Optimization Strategies

1. **UTXO Caching**
   - In-memory cache of frequently accessed UTXOs
   - Reduces disk I/O significantly
   - Configurable cache size (`-dbcache`)

2. **Script Verification Parallelization**
   - Multi-threaded script validation
   - Scales with CPU cores
   - Critical for block validation speed

3. **Signature Caching**
   - Cache valid signatures
   - Prevents redundant verification
   - Particularly useful during reorganizations

4. **Compact Block Relay**
   - Transmit block headers + short tx IDs
   - Reduces bandwidth by ~90%
   - Relies on mempool synchronization

5. **Database Optimization**
   - LevelDB compaction
   - Bloom filters for lookups
   - Write buffering

### Memory Usage

**Typical Memory Profile:**
- **UTXO Cache:** 300-5000 MB (configurable)
- **Mempool:** 300-500 MB
- **Block Validation:** 100-200 MB
- **Network Buffers:** 50-100 MB
- **Wallet:** 50-200 MB per wallet
- **Other:** 100-200 MB

**Total:** ~1-6 GB depending on configuration

---

## Security Architecture

### Security Layers

1. **Cryptographic Security**
   - ECDSA signature verification
   - Scrypt proof-of-work
   - Hash-based data structures

2. **Consensus Security**
   - Strict validation rules
   - Proof-of-work requirement
   - Difficulty adjustment

3. **Network Security**
   - Peer banning
   - Rate limiting
   - DoS protection

4. **Wallet Security**
   - Private key encryption
   - Seed phrase backups
   - HD key derivation

5. **Process Isolation**
   - Separate wallet process (planned)
   - RPC authentication
   - File system permissions

---

## See Also

- [Detailed Architecture](./architecture.md) - In-depth technical architecture
- [Module Documentation](./modules/index.md) - Individual module documentation
- [Data Flow Diagrams](./architecture/data-flow.md) - Detailed data flow
- [Threading Model](./architecture/threading-model.md) - Threading details
- [Development Guide](./guides/development.md) - Development setup

---

## Navigation

← [README](./README.md) | [Detailed Architecture](./architecture.md) →

---

*Last Updated: 2026-01-12*
*Part of the Litecoin Core Documentation Project*
