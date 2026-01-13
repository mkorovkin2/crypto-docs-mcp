# Reference Documentation

> Quick reference materials, glossaries, and comprehensive listings for Litecoin Core.

---

## Overview

This section provides reference materials that you'll consult frequently during development, integration, or research.

**Contents:**
- Glossary of terms
- File index with descriptions
- BIPs relevant to Litecoin
- Release notes and history
- Dependencies and versions
- Command-line options
- Configuration reference
- Error codes

---

## Quick Links

| Reference | Description |
|-----------|-------------|
| [Glossary](#glossary) | Terms and definitions |
| [File Index](#file-index) | All source files |
| [BIPs](#bips) | Bitcoin Improvement Proposals |
| [Release Notes](#release-notes) | Version history |
| [Dependencies](#dependencies) | External libraries |
| [CLI Options](#cli-options) | Command-line arguments |
| [Configuration](#configuration) | Config file reference |
| [Error Codes](#error-codes) | Error messages |

---

## Glossary

**File:** [glossary.md](./glossary.md)

Comprehensive glossary of terms used in Litecoin Core and cryptocurrency in general.

### A-C

**Address**
A Litecoin address is a string of alphanumeric characters used to receive payments. Addresses are derived from public keys using cryptographic hashing.

**ASIC (Application-Specific Integrated Circuit)**
Specialized hardware designed specifically for mining cryptocurrencies. Scrypt-ASIC devices are used for Litecoin mining.

**Base58Check**
An encoding scheme used for Litecoin addresses that includes a checksum and excludes ambiguous characters (0, O, I, l).

**Bech32**
A new address format (BIP173) that provides better error detection. Used for native SegWit addresses (starting with 'ltc1').

**BIP (Bitcoin Improvement Proposal)**
Design documents providing information or describing new features for Bitcoin/Litecoin.

**Block**
A collection of transactions bundled together and added to the blockchain. Litecoin blocks are generated approximately every 2.5 minutes.

**Blockchain**
A distributed ledger of all transactions in chronological order, secured by proof-of-work.

**Block Height**
The number of blocks in the chain between a given block and the genesis block.

**Coinbase Transaction**
The first transaction in a block, created by the miner, which generates new coins as a reward.

**Consensus Rules**
The set of rules that all nodes must follow to validate blocks and transactions.

**[View Complete Glossary →](./glossary.md)**

---

## File Index

**File:** [file-index.md](./file-index.md)

Comprehensive listing of all source files in Litecoin Core with descriptions and purposes.

### Source Directory Structure

```
src/
├── consensus/          # Consensus rules
├── primitives/         # Basic data structures
├── script/             # Script execution
├── wallet/             # Wallet functionality
├── mweb/               # MWEB implementation
├── crypto/             # Cryptographic functions
├── rpc/                # RPC server
├── qt/                 # GUI implementation
├── net*                # Networking
├── validation.*        # Block/tx validation
├── init.*              # Initialization
└── miner.*             # Mining code
```

### Core Files

| File | Lines | Purpose | Module |
|------|-------|---------|--------|
| `validation.cpp/h` | ~8,000 | Main validation logic | validation |
| `net.cpp/h` | ~3,500 | Network management | net |
| `wallet/wallet.cpp/h` | ~5,000 | Wallet implementation | wallet |
| `script/interpreter.cpp/h` | ~1,800 | Script execution | script |
| `consensus/validation.h` | ~150 | Validation state | consensus |
| `primitives/block.h` | ~200 | Block structure | primitives |
| `primitives/transaction.h` | ~400 | Transaction structure | primitives |

### Module Files

**Consensus Module:**
- `consensus/consensus.h` - Consensus constants
- `consensus/merkle.cpp/h` - Merkle tree implementation
- `consensus/params.h` - Consensus parameters
- `consensus/tx_check.cpp/h` - Transaction checking
- `consensus/tx_verify.cpp/h` - Transaction verification

**Script Module:**
- `script/interpreter.cpp/h` - Script interpreter
- `script/script.cpp/h` - Script data structure
- `script/standard.cpp/h` - Standard script types
- `script/sign.cpp/h` - Script signing
- `script/descriptor.cpp/h` - Output descriptors

**MWEB Module:**
- `mweb/mweb_node.cpp/h` - MWEB coordinator
- `mweb/mweb_wallet.cpp/h` - MWEB wallet
- `mweb/mweb_miner.cpp/h` - MWEB mining
- `mweb/mweb_transact.cpp/h` - MWEB transactions

**[View Complete File Index →](./file-index.md)**

---

## BIPs

**File:** [bips.md](./bips.md)

Bitcoin Improvement Proposals relevant to Litecoin Core.

### Implemented BIPs

| BIP | Title | Status | Version |
|-----|-------|--------|---------|
| BIP9 | Version bits with timeout and delay | Active | 0.13.0+ |
| BIP11 | M-of-N Standard Transactions | Active | 0.6.0+ |
| BIP13 | Address Format for pay-to-script-hash | Active | 0.6.3+ |
| BIP14 | Protocol Version and User Agent | Active | 0.6.0+ |
| BIP16 | Pay to Script Hash | Active | 0.6.3+ |
| BIP21 | URI Scheme | Active | 0.6.0+ |
| BIP22 | getblocktemplate - Fundamentals | Active | 0.7.0+ |
| BIP23 | getblocktemplate - Pooled Mining | Active | 0.7.0+ |
| BIP30 | Duplicate transactions | Active | 0.6.0+ |
| BIP31 | Pong message | Active | 0.6.1+ |
| BIP32 | Hierarchical Deterministic Wallets | Active | 0.13.0+ |
| BIP34 | Block v2, Height in Coinbase | Active | 0.10.0+ |
| BIP35 | mempool message | Active | 0.7.0+ |
| BIP37 | Connection Bloom filtering | Active | 0.8.0+ |
| BIP39 | Mnemonic code for generating deterministic keys | Active | 0.13.0+ |
| BIP44 | Multi-Account Hierarchy for Deterministic Wallets | Active | 0.13.0+ |
| BIP61 | Reject P2P message | Active | 0.9.0+ |
| BIP65 | OP_CHECKLOCKTIMEVERIFY | Active | 0.11.2+ |
| BIP66 | Strict DER signatures | Active | 0.10.0+ |
| BIP68 | Relative lock-time using consensus-enforced sequence numbers | Active | 0.13.0+ |
| BIP70-73 | Payment Protocol | Active | 0.9.0+ |
| BIP111 | NODE_BLOOM service bit | Active | 0.13.0+ |
| BIP112 | CHECKSEQUENCEVERIFY | Active | 0.13.0+ |
| BIP113 | Median time-past as endpoint for lock-time calculations | Active | 0.13.0+ |
| BIP125 | Opt-in Full Replace-by-Fee Signaling | Active | 0.13.0+ |
| BIP130 | sendheaders message | Active | 0.12.0+ |
| BIP141 | Segregated Witness (Consensus layer) | Active | 0.13.0+ |
| BIP143 | Transaction Signature Verification for Version 0 Witness Program | Active | 0.13.0+ |
| BIP144 | Segregated Witness (Peer Services) | Active | 0.13.0+ |
| BIP152 | Compact Block Relay | Active | 0.13.0+ |
| BIP157 | Client Side Block Filtering | Active | 0.19.0+ |
| BIP158 | Compact Block Filters for Light Clients | Active | 0.19.0+ |
| BIP173 | Base32 address format for native v0-16 witness outputs | Active | 0.16.0+ |
| BIP174 | Partially Signed Bitcoin Transaction Format | Active | 0.17.0+ |

### Planned BIPs

| BIP | Title | Status |
|-----|-------|--------|
| BIP340-342 | Schnorr Signatures for secp256k1 / Taproot / Tapscript | Planned |

**[View Complete BIP List →](./bips.md)**

---

## Release Notes

**File:** [release-notes.md](./release-notes.md)

Version history and release notes for all Litecoin Core versions.

### Recent Releases

#### Version 0.21.4 (Latest Stable)

**Release Date:** 2023-XX-XX

**Major Features:**
- MWEB (MimbleWimble Extension Blocks)
- Enhanced privacy features
- Performance improvements
- Bug fixes

**Breaking Changes:**
- None

**[Full Release Notes →](./release-notes.md#0214)

#### Version 0.21.3

**Release Date:** 2023-XX-XX

**Changes:**
- Security fixes
- Bug fixes
- Performance improvements

#### Version 0.21.2

**Release Date:** 2022-XX-XX

**Changes:**
- MWEB activation
- Network improvements
- Wallet enhancements

### Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.21.4 | 2023 | MWEB, privacy features |
| 0.21.3 | 2023 | Security fixes |
| 0.21.2 | 2022 | MWEB activation |
| 0.21.1 | 2021 | Bug fixes |
| 0.21.0 | 2021 | Major release |
| 0.18.1 | 2019 | SegWit activation |
| 0.17.1 | 2019 | Performance |
| 0.16.3 | 2018 | Stability |

**[View Complete Version History →](./release-notes.md)**

---

## Dependencies

**File:** [dependencies.md](./dependencies.md)

External libraries and their versions required to build and run Litecoin Core.

### Build Dependencies

| Dependency | Version | Purpose | Required |
|------------|---------|---------|----------|
| Boost | 1.64.0+ | C++ libraries | Yes |
| libevent | 2.0.22+ | Event notification | Yes |
| libdb | 4.8+ | Wallet database (legacy) | Optional |
| libsqlite3 | 3.7.17+ | Wallet database (modern) | Optional |
| Qt | 5.9.5+ | GUI framework | Optional |
| OpenSSL | 1.0.1+ | Cryptography | No* |
| libsecp256k1 | - | Signature verification | Bundled |
| libzmq | 4.0.0+ | ZeroMQ messaging | Optional |
| miniupnpc | 1.5+ | UPnP support | Optional |
| natpmp | - | NAT-PMP support | Optional |

*OpenSSL is not required; internal crypto is used instead.

### Runtime Dependencies

| Dependency | Purpose | Required |
|------------|---------|----------|
| System C++ library | Basic runtime | Yes |
| System C library | Basic runtime | Yes |
| pthread | Threading | Yes |
| libatomic | Atomic operations | Platform-dependent |

### Platform-Specific

**Ubuntu/Debian:**
```bash
sudo apt-get install build-essential libtool autotools-dev automake pkg-config \
  bsdmainutils python3 libssl-dev libevent-dev libboost-all-dev \
  libdb-dev libdb++-dev libsqlite3-dev libzmq3-dev libminiupnpc-dev \
  libnatpmp-dev qtbase5-dev qttools5-dev-tools qttools5-dev
```

**macOS:**
```bash
brew install automake berkeley-db4 libtool boost miniupnpc pkg-config \
  python qt5 zmq sqlite
```

**[View Complete Dependencies →](./dependencies.md)**

---

## CLI Options

**File:** [cli-options.md](./cli-options.md)

Complete reference of all command-line options for litecoind and litecoin-qt.

### Global Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-?` | flag | - | Print help message and exit |
| `-version` | flag | - | Print version and exit |
| `-conf=<file>` | path | litecoin.conf | Configuration file |
| `-datadir=<dir>` | path | ~/.litecoin | Data directory |
| `-testnet` | flag | false | Use testnet |
| `-regtest` | flag | false | Use regression test mode |
| `-signet` | flag | false | Use signet |

### Node Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-daemon` | flag | false | Run as daemon |
| `-server` | flag | false | Accept RPC connections |
| `-maxconnections=<n>` | int | 125 | Maximum peer connections |
| `-port=<port>` | int | 9333 | Listen port |
| `-bind=<addr>` | string | - | Bind to address |
| `-listen` | flag | true | Accept incoming connections |
| `-discover` | flag | true | Discover own IP address |
| `-dns` | flag | true | Allow DNS lookups |
| `-dnsseed` | flag | true | Query DNS seeds |
| `-addnode=<ip>` | string | - | Add peer |
| `-connect=<ip>` | string | - | Connect only to peer |
| `-maxreceivebuffer=<n>` | int | 5000 | Max per-connection receive buffer (KB) |
| `-maxsendbuffer=<n>` | int | 1000 | Max per-connection send buffer (KB) |
| `-onlynet=<net>` | string | - | Only connect to nodes in network |

### RPC Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-rpcuser=<user>` | string | - | RPC username |
| `-rpcpassword=<pw>` | string | - | RPC password |
| `-rpcport=<port>` | int | 9332 | RPC port |
| `-rpcbind=<addr>` | string | - | RPC bind address |
| `-rpcallowip=<ip>` | string | - | Allow RPC from IP |
| `-rpcthreads=<n>` | int | 4 | RPC threads |

### Wallet Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-wallet=<name>` | string | - | Specify wallet |
| `-walletdir=<dir>` | path | - | Wallet directory |
| `-disablewallet` | flag | false | Disable wallet |
| `-keypool=<n>` | int | 1000 | Key pool size |
| `-fallbackfee=<amt>` | decimal | 0.00001 | Fallback fee rate |
| `-mintxfee=<amt>` | decimal | 0.00001 | Minimum tx fee rate |
| `-paytxfee=<amt>` | decimal | 0 | Fee rate |
| `-txconfirmtarget=<n>` | int | 6 | Confirmation target |

### Performance Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-dbcache=<n>` | int | 450 | Database cache size (MB) |
| `-par=<n>` | int | CPU count | Script verification threads |
| `-maxmempool=<n>` | int | 300 | Max mempool size (MB) |
| `-maxorphantx=<n>` | int | 100 | Max orphan transactions |
| `-blockreconstructionextratxn=<n>` | int | 100 | Extra tx for compact blocks |

### Debug Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-debug=<category>` | string | - | Debug category |
| `-debuglogfile=<file>` | path | debug.log | Debug log file |
| `-printtoconsole` | flag | false | Print to console |
| `-logtimestamps` | flag | true | Log timestamps |
| `-shrinkdebugfile` | flag | true | Shrink debug log on start |

**[View Complete CLI Reference →](./cli-options.md)**

---

## Configuration

**File:** [configuration.md](./configuration.md)

Complete reference for litecoin.conf configuration file.

### Configuration File Format

```ini
# Comments start with #

# Boolean options
server=1
testnet=0

# Numeric options
maxconnections=256
dbcache=4096

# String options
rpcuser=myuser
rpcpassword=mypassword

# List options (can appear multiple times)
addnode=node1.litecoin.org
addnode=node2.litecoin.org

# Address options
rpcallowip=192.168.1.0/24
bind=0.0.0.0:9333
```

### Sample Configurations

**Basic Node:**
```ini
# Basic full node
server=1
daemon=1
txindex=1
listen=1
```

**High-Performance Node:**
```ini
# Optimized for performance
dbcache=4096
maxconnections=256
par=8
maxmempool=500
```

**Mining Node:**
```ini
# Mining configuration
server=1
rpcuser=miner
rpcpassword=secure_password
rpcallowip=192.168.1.0/24
```

**Privacy Node:**
```ini
# Enhanced privacy
proxy=127.0.0.1:9050
onlynet=onion
listen=0
```

**[View Complete Configuration Reference →](./configuration.md)**

---

## Error Codes

**File:** [error-codes.md](./error-codes.md)

Reference for error codes returned by Litecoin Core.

### RPC Error Codes

| Code | Name | Description |
|------|------|-------------|
| -1 | RPC_MISC_ERROR | Generic error |
| -3 | RPC_TYPE_ERROR | Invalid type |
| -5 | RPC_INVALID_ADDRESS_OR_KEY | Invalid address or key |
| -8 | RPC_OUT_OF_MEMORY | Out of memory |
| -20 | RPC_DATABASE_ERROR | Database error |
| -22 | RPC_DESERIALIZATION_ERROR | Deserialization error |
| -25 | RPC_VERIFY_ERROR | Verification error |
| -26 | RPC_VERIFY_REJECTED | Transaction rejected |
| -27 | RPC_VERIFY_ALREADY_IN_CHAIN | Already in chain |
| -28 | RPC_IN_WARMUP | Client still warming up |

### Validation Errors

| Name | Description |
|------|-------------|
| REJECT_INVALID | Invalid transaction/block |
| REJECT_OBSOLETE | Obsolete version |
| REJECT_DUPLICATE | Duplicate transaction |
| REJECT_NONSTANDARD | Non-standard transaction |
| REJECT_DUST | Dust output |
| REJECT_INSUFFICIENTFEE | Insufficient fee |

### Script Errors

| Error | Description |
|-------|-------------|
| SCRIPT_ERR_OK | No error |
| SCRIPT_ERR_UNKNOWN_ERROR | Unknown error |
| SCRIPT_ERR_EVAL_FALSE | Script evaluated to false |
| SCRIPT_ERR_OP_RETURN | OP_RETURN encountered |
| SCRIPT_ERR_VERIFY | VERIFY operation failed |
| SCRIPT_ERR_INVALID_STACK_OPERATION | Invalid stack operation |
| SCRIPT_ERR_SIG_DER | Invalid DER signature |
| SCRIPT_ERR_SIG_HASHTYPE | Invalid signature hash type |

**[View Complete Error Code Reference →](./error-codes.md)**

---

## Additional References

### Chain Parameters

**File:** [chain-parameters.md](./chain-parameters.md)

Network-specific parameters for mainnet, testnet, and regtest.

### P2P Protocol

**File:** [p2p-protocol.md](./p2p-protocol.md)

Complete P2P protocol message reference.

### RPC Methods

**File:** [rpc-methods.md](./rpc-methods.md)

Alphabetical listing of all RPC methods with signatures.

### File Formats

**File:** [file-formats.md](./file-formats.md)

Format specifications for data files (blocks, wallet, peers, etc.).

---

## Search and Navigation

### By Category

- **Terminology:** [Glossary](./glossary.md)
- **Source Code:** [File Index](./file-index.md)
- **Standards:** [BIPs](./bips.md)
- **History:** [Release Notes](./release-notes.md)
- **Setup:** [Dependencies](./dependencies.md), [Configuration](./configuration.md)
- **Operations:** [CLI Options](./cli-options.md)
- **Troubleshooting:** [Error Codes](./error-codes.md)

### Alphabetical Index

[A](#a) | [B](#b) | [C](#c) | [D](#d) | [E](#e) | [F](#f) | [G](#g) | [H](#h) | [I](#i) | [J](#j) | [K](#k) | [L](#l) | [M](#m) | [N](#n) | [O](#o) | [P](#p) | [Q](#q) | [R](#r) | [S](#s) | [T](#t) | [U](#u) | [V](#v) | [W](#w) | [X](#x) | [Y](#y) | [Z](#z)

---

## See Also

- [API Reference](../api-reference.md) - RPC API documentation
- [Guides](../guides/index.md) - Developer guides
- [Examples](../examples/index.md) - Code examples
- [Modules](../modules/index.md) - Module documentation

---

## Navigation

← [README](../README.md) | [Glossary](./glossary.md) | [File Index](./file-index.md) →

---

*Last Updated: 2026-01-12*
*Part of the Litecoin Core Documentation Project*
