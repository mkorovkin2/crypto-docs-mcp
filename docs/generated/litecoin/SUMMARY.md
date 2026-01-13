# Litecoin Core Documentation - Table of Contents

## Introduction

* [README](README.md)
* [What is Litecoin?](README.md#what-is-litecoin)
* [Quick Links](README.md#quick-links)

---

## Getting Started

* [Getting Started](getting-started.md)
* [Quick Start Guide](quick-start-guide.md)
* [Building from Source](building-from-source.md)
  * [Unix/Linux Build](building-from-source.md#unix-linux)
  * [macOS Build](building-from-source.md#macos)
  * [Windows Build](building-from-source.md#windows)
  * [FreeBSD Build](building-from-source.md#freebsd)
  * [OpenBSD Build](building-from-source.md#openbsd)
  * [NetBSD Build](building-from-source.md#netbsd)
* [Configuration](configuration.md)
  * [Command-Line Options](configuration.md#command-line-options)
  * [Configuration File](configuration.md#configuration-file)
  * [Data Directory](configuration.md#data-directory)

---

## Architecture

* [Architecture Overview](architecture-overview.md)
  * [System Components](architecture-overview.md#system-components)
  * [Data Flow](architecture-overview.md#data-flow)
  * [Component Interactions](architecture-overview.md#component-interactions)
* [Detailed Architecture](architecture.md)
  * [Core Layer](architecture.md#core-layer)
  * [Consensus Layer](architecture.md#consensus-layer)
  * [Network Layer](architecture.md#network-layer)
  * [Storage Layer](architecture.md#storage-layer)
  * [Application Layer](architecture.md#application-layer)
* [Architecture Documents](architecture/index.md)
  * [Data Flow Diagrams](architecture/data-flow.md)
  * [Module Relationships](architecture/module-relationships.md)
  * [Threading Model](architecture/threading-model.md)
  * [Memory Management](architecture/memory-management.md)
  * [Database Design](architecture/database-design.md)

---

## Core Modules

* [Modules Overview](modules/index.md)

### Consensus Module
* [Consensus Overview](modules/consensus/README.md)
  * [Consensus Rules](modules/consensus/rules.md)
  * [Block Validation](modules/consensus/block-validation.md)
  * [Transaction Validation](modules/consensus/transaction-validation.md)
  * [Merkle Trees](modules/consensus/merkle.md)
  * [Consensus Parameters](modules/consensus/parameters.md)

### Primitives Module
* [Primitives Overview](modules/primitives/README.md)
  * [Block Structure](modules/primitives/block.md)
  * [Transaction Structure](modules/primitives/transaction.md)
  * [UTXO Model](modules/primitives/utxo.md)
  * [Serialization](modules/primitives/serialization.md)

### Validation Module
* [Validation Overview](modules/validation/README.md)
  * [Chain Validation](modules/validation/chain-validation.md)
  * [Mempool Management](modules/validation/mempool.md)
  * [Block Connection](modules/validation/block-connection.md)
  * [Reorganization Handling](modules/validation/reorg.md)
  * [UTXO Cache](modules/validation/utxo-cache.md)

### Script Module
* [Script Overview](modules/script/README.md)
  * [Script Interpreter](modules/script/interpreter.md)
  * [Script Opcodes](modules/script/opcodes.md)
  * [Standard Scripts](modules/script/standard-scripts.md)
  * [Script Verification](modules/script/verification.md)
  * [Signature Validation](modules/script/signatures.md)
  * [Descriptors](modules/script/descriptors.md)

### Crypto Module
* [Crypto Overview](modules/crypto/README.md)
  * [Hash Functions](modules/crypto/hashing.md)
  * [ECDSA](modules/crypto/ecdsa.md)
  * [Schnorr Signatures](modules/crypto/schnorr.md)
  * [Key Management](modules/crypto/keys.md)
  * [Scrypt Algorithm](modules/crypto/scrypt.md)
  * [Encryption/Decryption](modules/crypto/encryption.md)

### MWEB Module
* [MWEB Overview](modules/mweb/README.md)
  * [MimbleWimble Basics](modules/mweb/basics.md)
  * [Extension Blocks](modules/mweb/extension-blocks.md)
  * [Stealth Addresses](modules/mweb/stealth-addresses.md)
  * [PMMR (Prunable MMR)](modules/mweb/pmmr.md)
  * [Transaction Building](modules/mweb/transactions.md)
  * [Mining Changes](modules/mweb/mining.md)
  * [Light Client Support](modules/mweb/light-clients.md)

### Wallet Module
* [Wallet Overview](modules/wallet/README.md)
  * [Wallet Architecture](modules/wallet/architecture.md)
  * [Key Management](modules/wallet/keys.md)
  * [Address Generation](modules/wallet/addresses.md)
  * [Transaction Creation](modules/wallet/transaction-creation.md)
  * [Coin Selection](modules/wallet/coin-selection.md)
  * [Wallet Database](modules/wallet/database.md)
  * [Wallet Encryption](modules/wallet/encryption.md)
  * [Descriptor Wallets](modules/wallet/descriptors.md)
  * [MWEB Wallet](modules/wallet/mweb.md)

### RPC Module
* [RPC Overview](modules/rpc/README.md)
  * [RPC Server](modules/rpc/server.md)
  * [RPC Methods](modules/rpc/methods.md)
  * [Authentication](modules/rpc/authentication.md)
  * [Error Handling](modules/rpc/errors.md)
  * [Batch Requests](modules/rpc/batch.md)

### Qt/GUI Module
* [Qt Overview](modules/qt/README.md)
  * [GUI Architecture](modules/qt/architecture.md)
  * [Main Window](modules/qt/main-window.md)
  * [Wallet Interface](modules/qt/wallet-interface.md)
  * [Transaction View](modules/qt/transaction-view.md)
  * [Settings Dialog](modules/qt/settings.md)

### Network Module
* [Network Overview](modules/net/README.md)
  * [P2P Protocol](modules/net/p2p-protocol.md)
  * [Connection Management](modules/net/connections.md)
  * [Message Processing](modules/net/messages.md)
  * [Peer Discovery](modules/net/peer-discovery.md)
  * [Network Security](modules/net/security.md)
  * [Tor Support](modules/net/tor.md)

### Policy Module
* [Policy Overview](modules/policy/README.md)
  * [Transaction Policies](modules/policy/transactions.md)
  * [Block Policies](modules/policy/blocks.md)
  * [Fee Estimation](modules/policy/fees.md)
  * [Dust Limits](modules/policy/dust.md)
  * [Standardness Rules](modules/policy/standardness.md)

### Util Module
* [Util Overview](modules/util/README.md)
  * [String Utilities](modules/util/string.md)
  * [Time Functions](modules/util/time.md)
  * [Logging](modules/util/logging.md)
  * [Threading](modules/util/threading.md)
  * [Filesystem](modules/util/filesystem.md)

### Interfaces Module
* [Interfaces Overview](modules/interfaces/README.md)
  * [Chain Interface](modules/interfaces/chain.md)
  * [Wallet Interface](modules/interfaces/wallet.md)
  * [Node Interface](modules/interfaces/node.md)
  * [Handler Interface](modules/interfaces/handler.md)

### Index Module
* [Index Overview](modules/index/README.md)
  * [Transaction Index](modules/index/txindex.md)
  * [Block Filter Index](modules/index/blockfilter.md)
  * [Address Index](modules/index/addrindex.md)

---

## API Reference

* [API Overview](api-reference.md)

### RPC API
* [Blockchain RPCs](api-reference.md#blockchain)
  * [getblockchaininfo](api/rpc/blockchain/getblockchaininfo.md)
  * [getblock](api/rpc/blockchain/getblock.md)
  * [getblockcount](api/rpc/blockchain/getblockcount.md)
  * [getblockhash](api/rpc/blockchain/getblockhash.md)
  * [gettxout](api/rpc/blockchain/gettxout.md)
* [Wallet RPCs](api-reference.md#wallet)
  * [getbalance](api/rpc/wallet/getbalance.md)
  * [getnewaddress](api/rpc/wallet/getnewaddress.md)
  * [sendtoaddress](api/rpc/wallet/sendtoaddress.md)
  * [createwallet](api/rpc/wallet/createwallet.md)
  * [listunspent](api/rpc/wallet/listunspent.md)
* [Network RPCs](api-reference.md#network)
  * [getpeerinfo](api/rpc/network/getpeerinfo.md)
  * [getnetworkinfo](api/rpc/network/getnetworkinfo.md)
  * [addnode](api/rpc/network/addnode.md)
* [Mining RPCs](api-reference.md#mining)
  * [getmininginfo](api/rpc/mining/getmininginfo.md)
  * [getblocktemplate](api/rpc/mining/getblocktemplate.md)
  * [submitblock](api/rpc/mining/submitblock.md)
* [Utility RPCs](api-reference.md#utility)
  * [validateaddress](api/rpc/util/validateaddress.md)
  * [estimatesmartfee](api/rpc/util/estimatesmartfee.md)

### C++ API
* [C++ API Reference](cpp-api-reference.md)
  * [Core Classes](cpp-api/core-classes.md)
  * [Validation Functions](cpp-api/validation.md)
  * [Utility Functions](cpp-api/utilities.md)

### Script API
* [Script API Reference](script-api.md)
  * [Opcodes](script-api.md#opcodes)
  * [Standard Scripts](script-api.md#standard-scripts)
  * [Script Templates](script-api.md#templates)

### REST API
* [REST Interface](rest-interface.md)
  * [GET Block](rest-interface.md#get-block)
  * [GET Transaction](rest-interface.md#get-transaction)
  * [GET Chaininfo](rest-interface.md#get-chaininfo)

---

## Code Examples

* [Examples Index](examples/index.md)

### Transaction Examples
* [Transaction Examples](examples/transaction-examples.md)
  * [Creating Raw Transactions](examples/transaction-examples.md#creating-raw)
  * [Signing Transactions](examples/transaction-examples.md#signing)
  * [Broadcasting Transactions](examples/transaction-examples.md#broadcasting)
  * [Multi-Signature Transactions](examples/transaction-examples.md#multisig)
  * [SegWit Transactions](examples/transaction-examples.md#segwit)

### Wallet Examples
* [Wallet Examples](examples/wallet-examples.md)
  * [Creating a Wallet](examples/wallet-examples.md#create-wallet)
  * [Backing Up Wallets](examples/wallet-examples.md#backup)
  * [Importing Keys](examples/wallet-examples.md#import-keys)
  * [HD Wallet Setup](examples/wallet-examples.md#hd-wallet)
  * [Descriptor Wallets](examples/wallet-examples.md#descriptors)

### RPC Examples
* [RPC Examples](examples/rpc-examples.md)
  * [Using curl](examples/rpc-examples.md#curl)
  * [Python Client](examples/rpc-examples.md#python)
  * [JavaScript Client](examples/rpc-examples.md#javascript)
  * [Batch Requests](examples/rpc-examples.md#batch)

### Script Examples
* [Script Examples](examples/script-examples.md)
  * [P2PKH Script](examples/script-examples.md#p2pkh)
  * [P2SH Script](examples/script-examples.md#p2sh)
  * [Time-Locked Scripts](examples/script-examples.md#timelocks)
  * [Custom Scripts](examples/script-examples.md#custom)

### Crypto Examples
* [Crypto Examples](examples/crypto-examples.md)
  * [Key Generation](examples/crypto-examples.md#key-generation)
  * [Signing Data](examples/crypto-examples.md#signing)
  * [Verifying Signatures](examples/crypto-examples.md#verification)
  * [Address Derivation](examples/crypto-examples.md#addresses)

### MWEB Examples
* [MWEB Examples](examples/mweb-examples.md)
  * [Creating MWEB Transaction](examples/mweb-examples.md#create-tx)
  * [Pegging In/Out](examples/mweb-examples.md#pegging)
  * [Stealth Addresses](examples/mweb-examples.md#stealth)

### Workflow Examples
* [Workflow Examples](examples/workflow-examples.md)
  * [Development Workflow](examples/workflow-examples.md#development)
  * [Testing Workflow](examples/workflow-examples.md#testing)
  * [Release Workflow](examples/workflow-examples.md#release)

### Integration Examples
* [Integration Examples](examples/integration-examples.md)
  * [Exchange Integration](examples/integration-examples.md#exchange)
  * [Payment Processor](examples/integration-examples.md#payment)
  * [Block Explorer](examples/integration-examples.md#explorer)

### Cookbook
* [Code Cookbook](cookbook.md)
  * [Common Tasks](cookbook.md#common-tasks)
  * [Quick Recipes](cookbook.md#recipes)
  * [Best Practices](cookbook.md#best-practices)

---

## Developer Guides

* [Guides Index](guides/index.md)

### Development
* [Development Setup](guides/development.md)
  * [Environment Setup](guides/development.md#environment)
  * [IDE Configuration](guides/development.md#ide)
  * [Building Dependencies](guides/development.md#dependencies)
  * [Debugging Setup](guides/development.md#debugging)

### Testing
* [Testing Guide](guides/testing.md)
  * [Unit Tests](guides/testing.md#unit-tests)
  * [Functional Tests](guides/testing.md#functional-tests)
  * [Fuzz Tests](guides/testing.md#fuzz-tests)
  * [Benchmarks](guides/testing.md#benchmarks)
  * [Writing Tests](guides/testing.md#writing-tests)

### Debugging
* [Debugging Guide](guides/debugging.md)
  * [Debug Logging](guides/debugging.md#logging)
  * [Using GDB](guides/debugging.md#gdb)
  * [Using LLDB](guides/debugging.md#lldb)
  * [Common Issues](guides/debugging.md#common-issues)

### Contributing
* [Contributing Guide](guides/contributing.md)
  * [Getting Started](guides/contributing.md#getting-started)
  * [Finding Issues](guides/contributing.md#finding-issues)
  * [Making Changes](guides/contributing.md#making-changes)
  * [Submitting PRs](guides/contributing.md#submitting-prs)

### Pull Request Process
* [Pull Request Process](guides/pull-request-process.md)
  * [PR Guidelines](guides/pull-request-process.md#guidelines)
  * [Review Process](guides/pull-request-process.md#review)
  * [Merging](guides/pull-request-process.md#merging)

### Coding Standards
* [Coding Standards](guides/coding-standards.md)
  * [Code Style](guides/coding-standards.md#style)
  * [Naming Conventions](guides/coding-standards.md#naming)
  * [Documentation](guides/coding-standards.md#documentation)
  * [Best Practices](guides/coding-standards.md#best-practices)

### Release Process
* [Release Process](guides/release-process.md)
  * [Version Numbering](guides/release-process.md#versioning)
  * [Release Checklist](guides/release-process.md#checklist)
  * [Gitian Building](guides/release-process.md#gitian)

---

## Concepts

* [Concepts Index](concepts/index.md)

### Consensus
* [Consensus Mechanisms](concepts/consensus.md)
  * [Proof of Work](concepts/consensus.md#pow)
  * [Difficulty Adjustment](concepts/consensus.md#difficulty)
  * [Chain Selection](concepts/consensus.md#chain-selection)

### Mining
* [Scrypt Mining](concepts/scrypt-mining.md)
  * [Scrypt Algorithm](concepts/scrypt-mining.md#algorithm)
  * [Memory Requirements](concepts/scrypt-mining.md#memory)
  * [ASIC Resistance](concepts/scrypt-mining.md#asic)

### Privacy
* [MimbleWimble](concepts/mimblewimble.md)
  * [Confidential Transactions](concepts/mimblewimble.md#confidential)
  * [Cut-Through](concepts/mimblewimble.md#cutthrough)
  * [Privacy Properties](concepts/mimblewimble.md#privacy)

### Transaction Model
* [UTXO Model](concepts/utxo.md)
  * [Transaction Inputs](concepts/utxo.md#inputs)
  * [Transaction Outputs](concepts/utxo.md#outputs)
  * [Coin Selection](concepts/utxo.md#selection)

### Scalability
* [SegWit](concepts/segwit.md)
  * [Segregated Witness](concepts/segwit.md#segregated-witness)
  * [Benefits](concepts/segwit.md#benefits)
  * [Activation](concepts/segwit.md#activation)

### Layer 2
* [Lightning Network](concepts/lightning.md)
  * [Payment Channels](concepts/lightning.md#channels)
  * [Routing](concepts/lightning.md#routing)
  * [Integration](concepts/lightning.md#integration)

### Addresses
* [Address Types](concepts/addresses.md)
  * [Legacy Addresses](concepts/addresses.md#legacy)
  * [P2SH Addresses](concepts/addresses.md#p2sh)
  * [Bech32 Addresses](concepts/addresses.md#bech32)
  * [MWEB Addresses](concepts/addresses.md#mweb)

### Security
* [Security Model](concepts/security.md)
  * [Cryptographic Security](concepts/security.md#crypto)
  * [Network Security](concepts/security.md#network)
  * [Wallet Security](concepts/security.md#wallet)

---

## Reference

* [Reference Index](reference/index.md)

### Glossary
* [Glossary](reference/glossary.md)
  * [A-C](reference/glossary.md#a-c)
  * [D-F](reference/glossary.md#d-f)
  * [G-L](reference/glossary.md#g-l)
  * [M-R](reference/glossary.md#m-r)
  * [S-Z](reference/glossary.md#s-z)

### File Reference
* [File Index](reference/file-index.md)
  * [Source Files](reference/file-index.md#source)
  * [Test Files](reference/file-index.md#tests)
  * [Configuration Files](reference/file-index.md#config)

### BIPs
* [Bitcoin Improvement Proposals](reference/bips.md)
  * [Relevant BIPs](reference/bips.md#relevant)
  * [Implementation Status](reference/bips.md#status)

### Release Notes
* [Release Notes](reference/release-notes.md)
  * [Version History](reference/release-notes.md#history)
  * [Breaking Changes](reference/release-notes.md#breaking)
  * [Upgrade Guide](reference/release-notes.md#upgrade)

### Dependencies
* [Dependencies](reference/dependencies.md)
  * [Build Dependencies](reference/dependencies.md#build)
  * [Runtime Dependencies](reference/dependencies.md#runtime)
  * [Version Requirements](reference/dependencies.md#versions)

### CLI Reference
* [Command-Line Options](reference/cli-options.md)
  * [Global Options](reference/cli-options.md#global)
  * [Node Options](reference/cli-options.md#node)
  * [Wallet Options](reference/cli-options.md#wallet)
  * [RPC Options](reference/cli-options.md#rpc)

### Configuration
* [Configuration Reference](reference/configuration.md)
  * [litecoin.conf](reference/configuration.md#litecoin-conf)
  * [Environment Variables](reference/configuration.md#env-vars)
  * [Data Directory](reference/configuration.md#datadir)

### Error Codes
* [Error Codes](reference/error-codes.md)
  * [RPC Errors](reference/error-codes.md#rpc)
  * [Validation Errors](reference/error-codes.md#validation)
  * [Network Errors](reference/error-codes.md#network)

---

## Appendices

### Performance
* [Performance Tuning](appendix/performance.md)
  * [Database Tuning](appendix/performance.md#database)
  * [Memory Optimization](appendix/performance.md#memory)
  * [Network Optimization](appendix/performance.md#network)

### Security
* [Security Best Practices](appendix/security-practices.md)
  * [Node Security](appendix/security-practices.md#node)
  * [Wallet Security](appendix/security-practices.md#wallet)
  * [Network Security](appendix/security-practices.md#network)

### Troubleshooting
* [Troubleshooting](appendix/troubleshooting.md)
  * [Common Issues](appendix/troubleshooting.md#common)
  * [Debug Logs](appendix/troubleshooting.md#logs)
  * [FAQ](appendix/troubleshooting.md#faq)

### Migration
* [Migration Guides](appendix/migration.md)
  * [From Bitcoin Core](appendix/migration.md#from-bitcoin)
  * [Wallet Migration](appendix/migration.md#wallet)
  * [Version Upgrades](appendix/migration.md#upgrades)

---

## External Resources

* [Official Website](https://litecoin.org)
* [GitHub Repository](https://github.com/litecoin-project/litecoin)
* [Litecoin Wiki](https://litecoin.info/)
* [LitecoinTalk Forums](https://litecointalk.io/)
* [Developer Mailing List](https://groups.google.com/forum/#!forum/litecoin-dev)
* [Doxygen Documentation](https://doxygen.bitcoincore.org/)

---

*Last Updated: 2026-01-12*
*Generated by crypto-docs-mcp*
