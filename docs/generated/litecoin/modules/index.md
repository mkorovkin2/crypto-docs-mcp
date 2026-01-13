# Litecoin Core Modules

> Complete module documentation for Litecoin Core, organized by functional area.

---

## Overview

Litecoin Core is organized into modular components, each responsible for specific functionality. This modular architecture promotes code organization, maintainability, and testing.

**Total Modules:** 14 major modules
**Language:** C++ (C++17 standard)
**Build System:** Autotools / CMake

---

## Module Categories

### Core Modules
Essential modules that form the foundation of Litecoin Core.

| Module | Purpose | Dependencies | Status |
|--------|---------|--------------|--------|
| [Consensus](#consensus) | Consensus rules and validation | primitives, crypto | Stable |
| [Primitives](#primitives) | Basic data structures | crypto | Stable |
| [Validation](#validation) | Block and transaction validation | consensus, script | Stable |
| [Script](#script) | Script execution engine | crypto | Stable |
| [Crypto](#crypto) | Cryptographic primitives | - | Stable |

### Feature Modules
Modules implementing major features.

| Module | Purpose | Dependencies | Status |
|--------|---------|--------------|--------|
| [MWEB](#mweb) | MimbleWimble Extension Blocks | crypto, primitives | Beta |
| [Wallet](#wallet) | Wallet functionality | primitives, script | Stable |
| [Miner](#miner) | Mining and block assembly | consensus, validation | Stable |

### Service Modules
Modules providing services and interfaces.

| Module | Purpose | Dependencies | Status |
|--------|---------|--------------|--------|
| [RPC](#rpc) | JSON-RPC interface | validation, wallet | Stable |
| [Qt](#qt) | Graphical user interface | wallet, rpc | Stable |
| [Net](#net) | P2P networking | validation | Stable |

### Supporting Modules
Utility and infrastructure modules.

| Module | Purpose | Dependencies | Status |
|--------|---------|--------------|--------|
| [Policy](#policy) | Transaction policies | primitives | Stable |
| [Util](#util) | Utility functions | - | Stable |
| [Interfaces](#interfaces) | Internal interfaces | - | Stable |
| [Index](#index) | Blockchain indexes | validation | Stable |

---

## Core Modules

### Consensus

**Location:** `src/consensus/`

The consensus module implements the core consensus rules that all Litecoin nodes must follow. This is the most critical module for network compatibility.

**Key Files:**
- `consensus.h` - Consensus constants
- `merkle.cpp/h` - Merkle tree implementation
- `params.h` - Consensus parameters
- `tx_check.cpp/h` - Transaction checking
- `tx_verify.cpp/h` - Transaction verification
- `validation.h` - Validation state

**Key Concepts:**
- Block validation rules
- Transaction validation rules
- Merkle tree construction
- Consensus parameter management

**Documentation:**
- [Consensus Module README](./consensus/README.md)
- [Consensus Rules](./consensus/rules.md)
- [Block Validation](./consensus/block-validation.md)
- [Transaction Validation](./consensus/transaction-validation.md)

**Example Usage:**
```cpp
// Check basic transaction validity
CValidationState state;
if (!CheckTransaction(tx, state)) {
    return error("Invalid transaction: %s", state.GetRejectReason());
}
```

---

### Primitives

**Location:** `src/primitives/`

The primitives module defines the basic data structures used throughout Litecoin Core, including blocks and transactions.

**Key Files:**
- `block.cpp/h` - Block structure
- `transaction.cpp/h` - Transaction structure

**Key Classes:**
- `CBlock` - Block data structure
- `CTransaction` - Transaction data structure
- `CTxIn` - Transaction input
- `CTxOut` - Transaction output

**Documentation:**
- [Primitives Module README](./primitives/README.md)
- [Block Structure](./primitives/block.md)
- [Transaction Structure](./primitives/transaction.md)
- [Serialization](./primitives/serialization.md)

**Example Usage:**
```cpp
// Create a transaction output
CTxOut output(nValue, scriptPubKey);

// Create a transaction
CMutableTransaction tx;
tx.vin.push_back(CTxIn(prevout));
tx.vout.push_back(output);
```

---

### Validation

**Location:** `src/validation.cpp/h` (plus supporting files)

The validation module is responsible for validating blocks and transactions, maintaining the UTXO set, and managing the blockchain state.

**Key Files:**
- `validation.cpp/h` - Main validation logic
- `txmempool.cpp/h` - Mempool management
- `coins.cpp/h` - UTXO management
- `chain.cpp/h` - Chain data structures

**Key Responsibilities:**
- Block connection and disconnection
- UTXO set management
- Mempool management
- Chain reorganization
- Fee estimation

**Documentation:**
- [Validation Module README](./validation/README.md)
- [Chain Validation](./validation/chain-validation.md)
- [Mempool Management](./validation/mempool.md)
- [UTXO Cache](./validation/utxo-cache.md)

**Example Usage:**
```cpp
// Accept transaction to mempool
CValidationState state;
if (!AcceptToMemoryPool(mempool, state, tx, &fMissingInputs)) {
    return error("Transaction rejected: %s", state.GetRejectReason());
}
```

---

### Script

**Location:** `src/script/`

The script module implements Bitcoin Script execution and verification, including all opcodes and script validation logic.

**Key Files:**
- `interpreter.cpp/h` - Script interpreter
- `script.cpp/h` - Script data structure
- `standard.cpp/h` - Standard script types
- `sign.cpp/h` - Script signing
- `descriptor.cpp/h` - Output descriptors

**Key Features:**
- Stack-based script execution
- Signature verification
- Standard script recognition
- Output descriptors
- Script size limits

**Documentation:**
- [Script Module README](./script/README.md)
- [Script Interpreter](./script/interpreter.md)
- [Script Opcodes](./script/opcodes.md)
- [Script Verification](./script/verification.md)

**Example Usage:**
```cpp
// Verify script
ScriptError serror;
if (!VerifyScript(scriptSig, scriptPubKey, &scriptWitness, flags, checker, &serror)) {
    return error("Script verification failed: %s", ScriptErrorString(serror));
}
```

---

### Crypto

**Location:** `src/crypto/`

The crypto module provides cryptographic primitives used throughout Litecoin Core, including hashing, encryption, and key management.

**Key Files:**
- `sha256.cpp/h` - SHA-256 hashing
- `ripemd160.cpp/h` - RIPEMD-160 hashing
- `scrypt.cpp/h` - Scrypt algorithm
- `aes.cpp/h` - AES encryption
- `hmac_sha256.cpp/h` - HMAC-SHA256
- `hmac_sha512.cpp/h` - HMAC-SHA512

**Key Features:**
- Hash functions (SHA-256, SHA-512, RIPEMD-160)
- Scrypt proof-of-work
- AES encryption/decryption
- HMAC functions
- Hardware acceleration (when available)

**Documentation:**
- [Crypto Module README](./crypto/README.md)
- [Hash Functions](./crypto/hashing.md)
- [Scrypt Algorithm](./crypto/scrypt.md)
- [Encryption](./crypto/encryption.md)

**Example Usage:**
```cpp
// Compute SHA-256 hash
uint256 hash;
CSHA256().Write(data, len).Finalize(hash.begin());

// Compute Scrypt
uint256 powHash;
scrypt_1024_1_1_256(BEGIN(nBlockHeader), BEGIN(powHash));
```

---

## Feature Modules

### MWEB

**Location:** `src/mweb/`

The MWEB (MimbleWimble Extension Block) module implements privacy features through extension blocks, providing optional confidential transactions.

**Key Files:**
- `mweb_node.cpp/h` - MWEB node coordinator
- `mweb_wallet.cpp/h` - MWEB wallet
- `mweb_miner.cpp/h` - MWEB mining
- `mweb_transact.cpp/h` - MWEB transactions
- `mweb_policy.cpp/h` - MWEB policies

**Key Features:**
- Confidential transactions
- Stealth addresses
- Transaction cut-through
- PMMR (Prunable Merkle Mountain Range)
- Peg-in/peg-out mechanism

**Documentation:**
- [MWEB Module README](./mweb/README.md)
- [MimbleWimble Basics](./mweb/basics.md)
- [Extension Blocks](./mweb/extension-blocks.md)
- [Stealth Addresses](./mweb/stealth-addresses.md)
- [PMMR](./mweb/pmmr.md)

**Example Usage:**
```cpp
// Create MWEB transaction
MWEB::Tx mwebTx = mwebWallet.CreateTransaction(outputs);

// Add to extension block
extensionBlock.AddTransaction(mwebTx);
```

---

### Wallet

**Location:** `src/wallet/`

The wallet module manages keys, addresses, and transactions for users. It supports multiple wallet types and features.

**Key Files:**
- `wallet.cpp/h` - Main wallet implementation
- `scriptpubkeyman.cpp/h` - Script/key management
- `walletdb.cpp/h` - Wallet database
- `coinselection.cpp/h` - Coin selection algorithms
- `feebumper.cpp/h` - Fee bumping (RBF)

**Key Features:**
- HD wallet support (BIP32/BIP44)
- Descriptor wallets
- Multi-wallet support
- Coin control
- Fee estimation
- MWEB wallet integration
- Watch-only addresses

**Documentation:**
- [Wallet Module README](./wallet/README.md)
- [Wallet Architecture](./wallet/architecture.md)
- [Key Management](./wallet/keys.md)
- [Transaction Creation](./wallet/transaction-creation.md)
- [Coin Selection](./wallet/coin-selection.md)

**Example Usage:**
```cpp
// Create and send transaction
CMutableTransaction tx;
CAmount fee;
if (!wallet.CreateTransaction(recipients, tx, fee, error)) {
    return error("Failed to create transaction: %s", error);
}
wallet.CommitTransaction(tx);
```

---

### Miner

**Location:** `src/miner.cpp/h`

The miner module handles block assembly and mining operations, including transaction selection and block template creation.

**Key Files:**
- `miner.cpp/h` - Mining and block assembly
- `pow.cpp/h` - Proof-of-work functions

**Key Features:**
- Block template creation
- Transaction prioritization
- Fee optimization
- Scrypt mining
- MWEB block assembly

**Documentation:**
- [Miner Module README](./miner/README.md)
- [Block Assembly](./miner/block-assembly.md)
- [Transaction Selection](./miner/transaction-selection.md)
- [Mining Guide](./miner/mining-guide.md)

**Example Usage:**
```cpp
// Create block template
BlockAssembler assembler(chainparams);
std::unique_ptr<CBlockTemplate> pblocktemplate = assembler.CreateNewBlock(scriptPubKey);
```

---

## Service Modules

### RPC

**Location:** `src/rpc/`

The RPC module provides the JSON-RPC interface for interacting with Litecoin Core programmatically.

**Key Files:**
- `server.cpp/h` - RPC server
- `blockchain.cpp` - Blockchain RPCs
- `rawtransaction.cpp` - Transaction RPCs
- `mining.cpp` - Mining RPCs
- `net.cpp` - Network RPCs

**Key Features:**
- 100+ RPC methods
- HTTP/HTTPS transport
- Authentication support
- Batch requests
- Named parameters

**Documentation:**
- [RPC Module README](./rpc/README.md)
- [RPC Server](./rpc/server.md)
- [RPC Methods](./rpc/methods.md)
- [Authentication](./rpc/authentication.md)

**Example Usage:**
```cpp
// Register RPC command
RPCHelpMan getblockcount{
    "getblockcount",
    "Returns the number of blocks in the longest blockchain.",
    {},
    RPCResult{RPCResult::Type::NUM, "", "The current block count"},
    RPCExamples{HelpExampleCli("getblockcount", "")},
    [&](const RPCHelpMan& self, const JSONRPCRequest& request) -> UniValue {
        return ::ChainActive().Height();
    }
};
```

---

### Qt

**Location:** `src/qt/`

The Qt module implements the graphical user interface using the Qt framework.

**Key Files:**
- `bitcoin.cpp` - Main application
- `bitcoingui.cpp/h` - Main window
- `walletview.cpp/h` - Wallet view
- `transactionview.cpp/h` - Transaction list
- `sendcoinsdialog.cpp/h` - Send dialog

**Key Features:**
- Cross-platform GUI
- Wallet management
- Transaction history
- Address book
- Settings configuration
- Network traffic monitor

**Documentation:**
- [Qt Module README](./qt/README.md)
- [GUI Architecture](./qt/architecture.md)
- [Main Window](./qt/main-window.md)
- [Wallet Interface](./qt/wallet-interface.md)

---

### Net

**Location:** `src/net.cpp/h` and related files

The net module handles P2P networking, peer management, and message processing.

**Key Files:**
- `net.cpp/h` - Network manager
- `net_processing.cpp/h` - Message processing
- `netaddress.cpp/h` - Network addresses
- `netbase.cpp/h` - Network utilities
- `banman.cpp/h` - Ban management

**Key Features:**
- P2P protocol implementation
- Peer discovery and management
- Message relay
- Block propagation
- DoS protection
- Tor support

**Documentation:**
- [Net Module README](./net/README.md)
- [P2P Protocol](./net/p2p-protocol.md)
- [Connection Management](./net/connections.md)
- [Message Processing](./net/messages.md)

---

## Supporting Modules

### Policy

**Location:** `src/policy/`

The policy module defines non-consensus transaction and block policies.

**Key Files:**
- `policy.cpp/h` - Policy constants
- `fees.cpp/h` - Fee estimation
- `rbf.cpp/h` - Replace-by-fee

**Key Features:**
- Transaction standardness rules
- Fee estimation
- Dust limits
- RBF (Replace-By-Fee)
- Minimum relay fee

**Documentation:**
- [Policy Module README](./policy/README.md)
- [Transaction Policies](./policy/transactions.md)
- [Fee Estimation](./policy/fees.md)

---

### Util

**Location:** `src/util/`

The util module provides utility functions and helpers used throughout the codebase.

**Key Files:**
- `system.cpp/h` - System utilities
- `string.cpp/h` - String utilities
- `time.cpp/h` - Time functions
- `threadnames.cpp/h` - Thread naming
- `strencodings.cpp/h` - String encoding

**Key Features:**
- String manipulation
- Time utilities
- Threading helpers
- Filesystem operations
- Logging framework

**Documentation:**
- [Util Module README](./util/README.md)
- [String Utilities](./util/string.md)
- [Time Functions](./util/time.md)
- [Logging](./util/logging.md)

---

### Interfaces

**Location:** `src/interfaces/`

The interfaces module defines abstract interfaces for inter-module communication.

**Key Files:**
- `chain.cpp/h` - Chain interface
- `wallet.cpp/h` - Wallet interface
- `node.cpp/h` - Node interface
- `handler.cpp/h` - Event handlers

**Key Features:**
- Module decoupling
- Clean boundaries
- Testability
- Process isolation preparation

**Documentation:**
- [Interfaces Module README](./interfaces/README.md)
- [Chain Interface](./interfaces/chain.md)
- [Wallet Interface](./interfaces/wallet.md)

---

### Index

**Location:** `src/index/`

The index module provides optional blockchain indexes for faster lookups.

**Key Files:**
- `txindex.cpp/h` - Transaction index
- `blockfilterindex.cpp/h` - Block filter index
- `base.cpp/h` - Base index class

**Key Features:**
- Transaction index (txindex)
- Block filter index (BIP157)
- Spent index
- Address index (optional)

**Documentation:**
- [Index Module README](./index/README.md)
- [Transaction Index](./index/txindex.md)
- [Block Filter Index](./index/blockfilter.md)

---

## Module Dependency Graph

```
Application Layer:
    qt ──────────┐
                 │
Service Layer:   │
    rpc ─────────┼───────┐
    wallet ──────┤       │
    miner ───────┤       │
                 │       │
Core Layer:      │       │
    validation ──┴───────┤
    mweb ────────────────┤
    script ──────────────┤
    consensus ───────────┤
                         │
Foundation Layer:        │
    primitives ──────────┤
    crypto ──────────────┤
    policy ──────────────┤
    net ─────────────────┤
    util ────────────────┘
    interfaces
    index
```

---

## Module Statistics

### Lines of Code (Approximate)

| Module | LOC | Files | Complexity |
|--------|-----|-------|------------|
| Validation | ~8,000 | 10 | High |
| Wallet | ~7,000 | 25 | High |
| Qt | ~15,000 | 80 | Medium |
| Script | ~3,000 | 15 | High |
| Net | ~5,000 | 15 | High |
| RPC | ~4,000 | 15 | Medium |
| Consensus | ~1,500 | 10 | Critical |
| MWEB | ~5,000 | 15 | High |
| Crypto | ~2,000 | 15 | High |
| Others | ~10,000 | 50+ | Varies |

**Total:** ~60,000 lines of C++ code (excluding tests and dependencies)

---

## Testing

Each module has corresponding test coverage:

### Unit Tests
Located in `src/test/`
- `consensus_tests.cpp`
- `script_tests.cpp`
- `transaction_tests.cpp`
- `wallet_tests.cpp`
- `crypto_tests.cpp`
- And many more...

### Functional Tests
Located in `test/functional/`
- Python-based integration tests
- Test entire workflows
- Test module interactions

### Fuzz Tests
Located in `src/test/fuzz/`
- Automated fuzzing
- Input generation
- Edge case discovery

---

## Development Guidelines

### Adding a New Module

1. **Create directory:** `src/your_module/`
2. **Add to build system:** Update `Makefile.am`
3. **Define interfaces:** Clear public API
4. **Write tests:** Comprehensive coverage
5. **Document:** README and code comments
6. **Review dependencies:** Minimize coupling

### Module Best Practices

- **Single Responsibility:** Each module has one clear purpose
- **Loose Coupling:** Minimize dependencies between modules
- **High Cohesion:** Related functionality stays together
- **Clear Interfaces:** Well-defined public APIs
- **Comprehensive Tests:** Unit and integration tests
- **Documentation:** Code comments and module README

---

## See Also

- [Architecture Overview](../architecture-overview.md) - System architecture
- [API Reference](../api-reference.md) - API documentation
- [Examples](../examples/index.md) - Code examples
- [Development Guide](../guides/development.md) - Development setup
- [Contributing](../guides/contributing.md) - How to contribute

---

## Navigation

← [README](../README.md) | [Architecture Overview](../architecture-overview.md) | [Examples](../examples/index.md) →

---

*Last Updated: 2026-01-12*
*Part of the Litecoin Core Documentation Project*
