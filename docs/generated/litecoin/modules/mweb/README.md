# MWEB (MimbleWimble Extension Block) Module

> Litecoin's opt-in privacy feature providing confidential transactions and stealth addresses.

## Overview

MWEB (MimbleWimble Extension Blocks) is Litecoin's implementation of the MimbleWimble protocol as an optional extension block. It provides enhanced privacy features while maintaining compatibility with existing infrastructure.

**Activation:** May 19, 2022 (Block 2,257,920)
**Status:** Active on Mainnet

## Key Features

### Confidential Transactions
- Transaction amounts are hidden using Pedersen commitments
- Validators can verify inputs equal outputs without knowing values
- Range proofs ensure amounts are positive

### Stealth Addresses
- Recipient addresses are never visible on-chain
- Each payment creates a unique one-time address
- Non-interactive (sender doesn't need receiver online)

### Scalability
- Spent outputs can be pruned
- PMMR data structure enables efficient state commitment
- Optional participation reduces blockchain bloat

## Architecture

```
+-------------------+     +-------------------+
|   Main Chain      |     |   Extension Block |
|                   |     |                   |
|  Regular TXs      |<--->|   MWEB TXs        |
|  HogEx TX --------|---->|   (Confidential)  |
|                   |     |                   |
+-------------------+     +-------------------+
         ^                         ^
         |                         |
    Peg-in/out                MWEB-to-MWEB
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| libmw | `src/libmw/` | Core MimbleWimble library |
| mw integration | `src/mw/` | Litecoin integration layer |
| secp256k1-zkp | `src/secp256k1-zkp/` | Cryptographic primitives |

## Key Concepts

### HogEx (Integrating Transaction)
The final transaction in each block that connects MWEB to the main chain:
- Moves pegged-in coins to HogAddr
- Distributes pegged-out coins
- Commits to MWEB state

### HogAddr
Special address holding all coins currently in MWEB. Not spendable directly.

### PMMR (Prunable Merkle Mountain Range)
Data structure for UTXO commitments:
- Append-only
- Efficient proofs
- Prunable spent outputs

### Stealth Address Protocol (DKSAP)
Dual-key scheme with:
- **Scan Key (A):** Identifies incoming payments
- **Spend Key (B):** Authorizes spending

## Usage

### Generate MWEB Address

```bash
litecoin-cli getnewaddress "" mweb
```

### Peg-in (Main Chain → MWEB)

```bash
# Send to MWEB address from regular wallet
litecoin-cli sendtoaddress "ltcmweb1..." 10.0
```

### MWEB-to-MWEB Transaction

```bash
# Fully confidential transaction
litecoin-cli sendtoaddress "ltcmweb1..." 5.0
```

### Peg-out (MWEB → Main Chain)

```bash
# Send to regular address from MWEB balance
litecoin-cli sendtoaddress "ltc1..." 5.0
```

### Check MWEB Balance

```bash
litecoin-cli getbalances
# Shows regular and MWEB balances separately
```

## Source Files

### Core Library (`src/libmw/`)

| File | Purpose |
|------|---------|
| `libmw/include/mw/` | Public API headers |
| `libmw/src/consensus/` | MWEB consensus rules |
| `libmw/src/crypto/` | Cryptographic operations |
| `libmw/src/db/` | MWEB database operations |
| `libmw/src/mmr/` | PMMR implementation |
| `libmw/src/node/` | Node-level MWEB operations |
| `libmw/src/wallet/` | Wallet MWEB support |

### Integration Layer (`src/mw/`)

| File | Purpose |
|------|---------|
| `mw/mweb_node.h/cpp` | Node integration |
| `mw/mweb_wallet.h/cpp` | Wallet integration |
| `mw/mweb_miner.h/cpp` | Mining integration |
| `mw/mweb_transact.h/cpp` | Transaction building |

### Cryptographic Primitives (`src/secp256k1-zkp/`)

Extended secp256k1 with:
- Schnorr signatures
- Pedersen commitments
- Bulletproofs (range proofs)
- MuSig aggregation

## Key Classes

### `mw::Block`
MWEB block structure containing:
- Kernel commitment
- Owner offsets
- MWEB transactions
- PMMR data

### `mw::Transaction`
Confidential transaction with:
- Blinded inputs/outputs
- Kernels (excess values)
- Range proofs

### `mw::StealthAddress`
Stealth address (A, B public keys) for receiving private payments.

### `MWEB::Node`
High-level node interface:
- `ValidateBlock()` - Validate MWEB block
- `ConnectBlock()` - Apply block to state
- `BuildNextBlock()` - Build block template

### `MWEB::Wallet`
Wallet interface:
- `ScanForOutputs()` - Find owned outputs
- `CreateTransaction()` - Build MWEB tx
- `GetBalance()` - Query MWEB balance

## Consensus Rules

### Block Validation
1. Verify HogEx transaction structure
2. Validate all MWEB transactions
3. Verify PMMR commitment
4. Check kernel signatures
5. Validate range proofs

### Transaction Validation
1. Sum of inputs = Sum of outputs + fees
2. All range proofs valid
3. Kernel signature valid
4. No double spends

### Peg-in Rules
- Must spend to valid MWEB output
- Amount committed correctly
- Range proof valid

### Peg-out Rules
- Must be included in HogEx
- Kernel signature valid
- Output to valid Litecoin address

## Mining Integration

Miners must:
1. Include `"mweb"` in getblocktemplate rules
2. Preserve HogEx transaction unchanged
3. Append MWEB data when submitting blocks

```bash
litecoin-cli getblocktemplate '{"rules": ["segwit", "mweb"]}'
```

See `doc/mweb/mining-changes.md` for details.

## Database Storage

### LevelDB Tables

| Prefix | Content |
|--------|---------|
| `O` | MWEB UTXOs |
| `M` | MMR info |
| `L` | Leaf data |

### Files

| File | Content |
|------|---------|
| `mweb/O*.dat` | Hash file |
| `mweb/leaf*.dat` | Leafset |
| `mweb/prun*.dat` | PruneList |

## Privacy Considerations

**What MWEB hides:**
- Transaction amounts (confidential)
- Recipient addresses (stealth)
- Transaction graph (within MWEB)

**What remains visible:**
- Peg-in transactions (on main chain)
- Peg-out transactions (on main chain)
- Total coins in MWEB (HogAddr balance)
- Block structure

**Best practices:**
- Use MWEB-to-MWEB for maximum privacy
- Minimize peg-in/peg-out linkage
- Use consistent amounts when pegging

## Testing

```bash
# Run MWEB-specific tests
test/functional/mweb_*.py

# Unit tests
src/test/mweb_*.cpp
```

## Documentation

- [MWEB Overview](../../doc/mweb/design.md)
- [Stealth Addresses](../../doc/mweb/stealth-addresses.md)
- [Mining Changes](../../doc/mweb/mining-changes.md)
- [PMMR Design](../../doc/mweb/pmmr.md)
- [Light Clients](../../doc/mweb/light-clients.md)

## References

- [LIP 002](https://github.com/litecoin-project/lips) - Extension Blocks
- [LIP 003](https://github.com/litecoin-project/lips) - MWEB Specification
- [LIP 004](https://github.com/litecoin-project/lips) - Stealth Addresses
- [MimbleWimble Paper](https://scalingbitcoin.org/papers/mimblewimble.txt)

---

**Documentation Version**: 1.0.0
**Module Version**: 0.21.4
