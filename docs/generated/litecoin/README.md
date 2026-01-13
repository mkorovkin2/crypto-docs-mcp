# Litecoin Core Documentation

> An experimental digital currency enabling instant payments to anyone, anywhere in the world using peer-to-peer technology with no central authority.

**Version:** Latest (Master Branch)
**Language:** C++
**License:** MIT
**Repository:** https://github.com/litecoin-project/litecoin

## Quick Links

| I want to... | Go to... |
|--------------|----------|
| Get started quickly | [Getting Started](./getting-started.md) |
| Build from source | [Building Guide](./building-from-source.md) |
| Understand the architecture | [Architecture Overview](./architecture-overview.md) |
| See module documentation | [Modules Index](./modules/index.md) |
| Find RPC APIs | [RPC API Reference](./api-reference.md) |
| View code examples | [Examples](./examples/index.md) |
| Contribute to the project | [Contributing Guide](./guides/contributing.md) |

---

## What is Litecoin?

Litecoin is an experimental digital currency that enables instant payments to anyone, anywhere in the world. Litecoin uses peer-to-peer technology to operate with no central authority: managing transactions and issuing money are carried out collectively by the network.

**Key Features:**

- **Faster Block Generation:** 2.5-minute block times (4x faster than Bitcoin)
- **Scrypt Mining Algorithm:** Memory-hard proof-of-work
- **84 Million Coin Supply:** 4x larger than Bitcoin's 21 million
- **MWEB (MimbleWimble Extension Blocks):** Enhanced privacy features
- **SegWit Support:** Segregated Witness for scalability
- **Lightning Network Ready:** Instant, low-fee transactions

---

## Documentation Structure

### Getting Started

New to Litecoin Core? Start here.

| Guide | Description | Est. Time |
|-------|-------------|-----------|
| [Getting Started](./getting-started.md) | Your first steps with Litecoin Core | 5 min |
| [Quick Start Guide](./quick-start-guide.md) | Rapid setup and configuration | 10 min |
| [Building from Source](./building-from-source.md) | Compile Litecoin Core yourself | 30 min |
| [Configuration](./configuration.md) | Configure your Litecoin node | 15 min |

### Architecture

Understanding how Litecoin Core is built.

| Document | Description |
|----------|-------------|
| [Architecture Overview](./architecture-overview.md) | High-level system design and components |
| [Detailed Architecture](./architecture.md) | In-depth technical architecture |
| [Data Flow](./architecture/data-flow.md) | Transaction and block flow through the system |
| [Module Relationships](./architecture/module-relationships.md) | How components interact |

### Core Modules

Documentation for each major module in Litecoin Core.

| Module | Purpose | Status |
|--------|---------|--------|
| [Consensus](./modules/consensus/README.md) | Consensus rules and validation | Stable |
| [Primitives](./modules/primitives/README.md) | Basic data structures (blocks, transactions) | Stable |
| [Validation](./modules/validation/README.md) | Block and transaction validation | Stable |
| [Script](./modules/script/README.md) | Script execution and verification | Stable |
| [Crypto](./modules/crypto/README.md) | Cryptographic primitives | Stable |
| [MWEB](./modules/mweb/README.md) | MimbleWimble Extension Blocks | Beta |
| [Wallet](./modules/wallet/README.md) | Wallet functionality | Stable |
| [RPC](./modules/rpc/README.md) | JSON-RPC interface | Stable |
| [Qt](./modules/qt/README.md) | GUI implementation | Stable |
| [Net](./modules/net/README.md) | P2P networking | Stable |
| [Policy](./modules/policy/README.md) | Transaction and block policies | Stable |
| [Util](./modules/util/README.md) | Utility functions | Stable |
| [Interfaces](./modules/interfaces/README.md) | Internal interfaces | Stable |
| [Index](./modules/index/README.md) | Blockchain indexes | Stable |

[View all modules →](./modules/index.md)

### API Reference

Complete API documentation for developers.

| API Type | Description |
|----------|-------------|
| [RPC API Reference](./api-reference.md) | JSON-RPC method documentation |
| [C++ API Reference](./cpp-api-reference.md) | Internal C++ API documentation |
| [Script API](./script-api.md) | Bitcoin Script opcodes and usage |
| [REST Interface](./rest-interface.md) | Unauthenticated REST endpoints |

### Code Examples

Practical examples and use cases.

| Example Category | Description |
|------------------|-------------|
| [Transaction Examples](./examples/transaction-examples.md) | Creating and signing transactions |
| [Wallet Examples](./examples/wallet-examples.md) | Wallet operations and management |
| [RPC Examples](./examples/rpc-examples.md) | Using the RPC interface |
| [Script Examples](./examples/script-examples.md) | Script creation and validation |
| [Crypto Examples](./examples/crypto-examples.md) | Cryptographic operations |
| [MWEB Examples](./examples/mweb-examples.md) | MimbleWimble transactions |
| [Workflow Examples](./examples/workflow-examples.md) | Common development workflows |
| [Integration Examples](./examples/integration-examples.md) | Integrating with external systems |

[View all examples →](./examples/index.md)

### Developer Guides

In-depth guides for contributors and developers.

| Guide | Description |
|-------|-------------|
| [Development Setup](./guides/development.md) | Setting up your development environment |
| [Testing Guide](./guides/testing.md) | Running and writing tests |
| [Debugging Guide](./guides/debugging.md) | Debugging techniques and tools |
| [Contributing](./guides/contributing.md) | How to contribute to Litecoin Core |
| [Pull Request Process](./guides/pull-request-process.md) | Submitting PRs and code review |
| [Coding Standards](./guides/coding-standards.md) | Code style and conventions |
| [Release Process](./guides/release-process.md) | How releases are made |

### Concepts

Deep dives into key Litecoin concepts.

| Concept | Description |
|---------|-------------|
| [Consensus Mechanisms](./concepts/consensus.md) | How Litecoin achieves consensus |
| [Scrypt Mining](./concepts/scrypt-mining.md) | The Scrypt proof-of-work algorithm |
| [MimbleWimble](./concepts/mimblewimble.md) | Privacy through MWEB |
| [UTXO Model](./concepts/utxo.md) | Unspent Transaction Output model |
| [SegWit](./concepts/segwit.md) | Segregated Witness implementation |
| [Lightning Network](./concepts/lightning.md) | Second-layer payment channels |
| [Address Types](./concepts/addresses.md) | Different address formats |

### Reference

Additional reference material.

| Document | Description |
|----------|-------------|
| [Glossary](./reference/glossary.md) | Terms and definitions |
| [File Index](./reference/file-index.md) | All source files with descriptions |
| [BIPs](./reference/bips.md) | Bitcoin Improvement Proposals relevant to Litecoin |
| [Release Notes](./reference/release-notes.md) | Version history and changes |
| [Dependencies](./reference/dependencies.md) | External libraries and versions |
| [Command-Line Options](./reference/cli-options.md) | All command-line arguments |

---

## Key Differences from Bitcoin

Litecoin is based on the Bitcoin protocol but includes several key modifications:

1. **Block Time:** 2.5 minutes vs Bitcoin's 10 minutes
2. **Supply:** 84 million LTC vs 21 million BTC
3. **Mining Algorithm:** Scrypt vs SHA-256
4. **Difficulty Retargeting:** Every 2016 blocks (approximately 3.5 days)
5. **MWEB:** Optional privacy layer not present in Bitcoin Core

---

## Project Structure

```
litecoin/
├── src/                    # Source code
│   ├── consensus/          # Consensus rules
│   ├── primitives/         # Basic data structures
│   ├── script/             # Script execution
│   ├── wallet/             # Wallet functionality
│   ├── mweb/               # MimbleWimble extension
│   ├── crypto/             # Cryptographic functions
│   ├── rpc/                # RPC server
│   ├── qt/                 # GUI code
│   ├── net*                # Networking
│   ├── validation.*        # Block/tx validation
│   ├── init.*              # Initialization
│   └── miner.*             # Mining code
├── test/                   # Test suite
│   ├── functional/         # Python functional tests
│   └── util/               # Test utilities
├── doc/                    # Original documentation
│   ├── build-*.md          # Build instructions
│   └── mweb/               # MWEB documentation
├── contrib/                # Tools and utilities
└── depends/                # Dependency management

```

---

## Quick Start Commands

### Running Litecoin Core

```bash
# Start the GUI
./litecoin-qt

# Start the daemon
./litecoind -daemon

# Check status
./litecoin-cli getblockchaininfo

# Stop the daemon
./litecoin-cli stop
```

### Common RPC Commands

```bash
# Get wallet balance
./litecoin-cli getbalance

# Create new address
./litecoin-cli getnewaddress

# Send transaction
./litecoin-cli sendtoaddress "LTC_ADDRESS" 0.1

# Get block count
./litecoin-cli getblockcount
```

---

## System Requirements

### Minimum Requirements

- **OS:** Windows 7+, macOS 10.14+, or Linux (64-bit)
- **RAM:** 2 GB (4 GB recommended)
- **Disk:** 50 GB free space (for full blockchain)
- **Network:** Broadband connection

### Recommended for Development

- **OS:** Ubuntu 20.04+ or macOS 12+
- **RAM:** 8 GB or more
- **Disk:** 100 GB SSD
- **CPU:** 4+ cores
- **Network:** Fast, stable connection

---

## Support and Community

### Getting Help

- **IRC:** #litecoin-dev on Freenode
- **Mailing List:** [litecoin-dev](https://groups.google.com/forum/#!forum/litecoin-dev)
- **Forums:** [LitecoinTalk](https://litecointalk.io/)
- **Wiki:** [Litecoin Wiki](https://litecoin.info/)

### Reporting Issues

- **Bug Reports:** [GitHub Issues](https://github.com/litecoin-project/litecoin/issues)
- **Security Issues:** Contact maintainers privately (see SECURITY.md)

### Project Links

- **Website:** https://litecoin.org
- **GitHub:** https://github.com/litecoin-project/litecoin
- **Twitter:** [@LitecoinProject](https://twitter.com/LitecoinProject)
- **Reddit:** [r/litecoin](https://www.reddit.com/r/litecoin/)

---

## Development Status

Litecoin Core is actively maintained and under continuous development. The `master` branch is regularly built and tested but may not be completely stable. Official releases are tagged and available on the [releases page](https://github.com/litecoin-project/litecoin/releases).

### Recent Features

- **MWEB (v0.21+):** MimbleWimble Extension Blocks for optional privacy
- **Taproot (Planned):** Schnorr signatures and improved scripting
- **Descriptor Wallets:** Modern wallet architecture
- **SQLite Support:** Alternative to BDB for wallet database

---

## Testing

Litecoin Core includes comprehensive test coverage:

- **Unit Tests:** C++ tests using Boost.Test
- **Functional Tests:** Python integration tests
- **Fuzz Tests:** Automated fuzzing for security
- **Benchmarks:** Performance testing suite

```bash
# Run unit tests
make check

# Run functional tests
test/functional/test_runner.py

# Run specific test
test/functional/wallet_basic.py
```

---

## Building

Litecoin Core can be built on multiple platforms:

- [Unix/Linux Build](./building-from-source.md#unix-linux)
- [macOS Build](./building-from-source.md#macos)
- [Windows Build](./building-from-source.md#windows)
- [FreeBSD Build](./building-from-source.md#freebsd)

Quick build (Unix):

```bash
./autogen.sh
./configure
make
make check  # Run tests
```

---

## License

Litecoin Core is released under the terms of the MIT license. See [COPYING](https://github.com/litecoin-project/litecoin/blob/master/COPYING) for more information or visit https://opensource.org/licenses/MIT.

---

## Navigation

This documentation is organized to help you find information quickly:

- **New users:** Start with [Getting Started](./getting-started.md)
- **Developers:** Check [Development Setup](./guides/development.md)
- **Integrators:** See [RPC API Reference](./api-reference.md) and [Examples](./examples/index.md)
- **Contributors:** Read [Contributing Guide](./guides/contributing.md)
- **Researchers:** Explore [Architecture](./architecture-overview.md) and [Concepts](./concepts/index.md)

---

*Documentation generated by crypto-docs-mcp on 2026-01-12*
*For the latest updates, visit the [Litecoin Core repository](https://github.com/litecoin-project/litecoin)*
