# Litecoin Core Technical Glossary

> Comprehensive glossary of technical terms used in Litecoin Core documentation and codebase.

---

## A

### Address
A string of alphanumeric characters representing a destination for Litecoin payments. Multiple formats exist: P2PKH (legacy), P2SH, Bech32 (SegWit), and MWEB.

### addrv2
P2P protocol message (BIP 155) enabling relay of Tor V3 addresses and other network types.

---

## B

### Base58
Encoding scheme for legacy addresses that excludes visually similar characters (0, O, I, l).

### Bech32
Address format for SegWit (BIP 173). Litecoin mainnet prefix: `ltc1`. More efficient error detection.

### Bech32m
Improved Bech32 variant (BIP 350) for Taproot addresses.

### BIP (Bitcoin Improvement Proposal)
Design documents for protocol changes. Litecoin implements many BIPs with modifications.

### Block
Collection of transactions with a header, chained together via cryptographic hashes. Litecoin targets 2.5-minute block intervals.

### Block Height
Number of blocks before a given block. Genesis block has height 0.

### Blockchain
Distributed ledger of all transactions, consisting of linked blocks.

---

## C

### CBlockUndo
Data structure for reverting blocks during reorganizations. Contains spent UTXO data.

### Coinbase Transaction
First transaction in every block, creating new litecoins as mining reward.

### Commitment
Cryptographic proof binding data without revealing it. Used extensively in MWEB.

### Compact Blocks
Bandwidth optimization (BIP 152) sending block headers and short transaction IDs.

### Consensus Rules
Rules all network participants must follow to agree on blockchain state.

---

## D

### Descriptor
Output descriptors (BIP 380+) describe how to derive addresses. Modern wallet standard.

### Difficulty
Measure of how hard it is to find a valid block hash. Adjusts every 2016 blocks.

### DKSAP
Dual-Key Stealth Address Protocol used in MWEB for privacy.

---

## E

### Extension Block
Mechanism (LIP 002) for new protocols without changing existing consensus rules. MWEB is an extension block.

---

## F

### Fee
Difference between inputs and outputs, paid to miners. Measured in litoshi/vbyte.

---

## G

### Genesis Block
First block (height 0). Created October 7, 2011 by Charlie Lee.

---

## H

### HD Wallet
Hierarchical Deterministic wallet (BIP 32) deriving all keys from single seed.

### HogAddr
Special address holding coins pegged into MWEB.

### HogEx
Integrating Transaction - final transaction in MWEB blocks connecting extension block to main chain.

---

## L

### LevelDB
Key-value database for UTXO set, block index, and MWEB data.

### LIP (Litecoin Improvement Proposal)
Protocol upgrade proposals specific to Litecoin.

### Litoshi
Smallest Litecoin unit. 1 LTC = 100,000,000 litoshi.

---

## M

### Mempool
Memory pool of unconfirmed transactions awaiting block inclusion.

### Merkle Root
Single hash committing to all transactions in a block via Merkle tree.

### MimbleWimble
Privacy protocol with confidential transactions and UTXO pruning. Implemented as MWEB.

### Mining
Creating blocks by finding valid proof-of-work using Scrypt algorithm.

### Multisig
Scripts requiring multiple signatures (m-of-n) to spend funds.

### MWEB (MimbleWimble Extension Block)
Litecoin's optional privacy feature. Provides confidential transactions and stealth addresses.

**Features:**
- Hidden amounts (Pedersen commitments)
- Stealth addresses (unlinkable payments)
- Non-interactive transactions
- Activated May 19, 2022

---

## N

### Node
Computer running Litecoin Core, validating and relaying transactions/blocks.

---

## O

### OP_CHECKLOCKTIMEVERIFY (CLTV)
Opcode (BIP 65) requiring transaction lock until specific time/height.

### OP_CHECKSEQUENCEVERIFY (CSV)
Opcode (BIP 112) enforcing relative lock-times.

---

## P

### P2PKH (Pay-to-Public-Key-Hash)
Original address format. Prefix: `L` or `M` (mainnet).

### P2SH (Pay-to-Script-Hash)
Pays to hash of redeem script (BIP 13). Enables complex spending conditions.

### P2WPKH (Pay-to-Witness-Public-Key-Hash)
Native SegWit single-key format. Uses Bech32 (`ltc1...`).

### P2WSH (Pay-to-Witness-Script-Hash)
Native SegWit script format for multisig, etc.

### Pedersen Commitment
Cryptographic commitment hiding amounts while allowing validation. Formula: `C = v*H + r*G`.

### Peg-in
Moving litecoins from main chain into MWEB.

### Peg-out
Moving litecoins from MWEB back to main chain.

### PMMR (Prunable Merkle Mountain Range)
Data structure for MWEB UTXO commitments. Enables efficient pruning.

### Proof-of-Work (PoW)
Consensus mechanism where miners find hash below target. Litecoin uses Scrypt.

### PSBT (Partially Signed Bitcoin Transaction)
Format (BIP 174) for incomplete transactions. Used with hardware wallets.

---

## R

### RBF (Replace-By-Fee)
Feature (BIP 125) allowing replacement of unconfirmed transactions with higher-fee versions.

### Regtest
Local testing mode with instant block generation and no real value.

### Reorg
Blockchain reorganization switching to different chain with more cumulative work.

### RPC (Remote Procedure Call)
JSON-RPC interface for communicating with litecoind. Default port: 9332.

---

## S

### Schnorr Signatures
Signature scheme used in MWEB and Taproot. Enables aggregation.

### Scrypt
Memory-hard proof-of-work algorithm used by Litecoin (vs Bitcoin's SHA-256).

**Parameters:** N=1024, r=1, p=1

### Script
Stack-based programming language for transaction spending conditions.

### SegWit (Segregated Witness)
Protocol upgrade (BIP 141) separating signatures from transaction data. Fixes malleability, enables scaling.

### secp256k1
Elliptic curve used for Litecoin cryptography.

### secp256k1-zkp
Extended curve library with zero-knowledge proofs for MWEB.

### Soft Fork
Backward-compatible protocol upgrade. Old nodes accept new blocks.

### SPV (Simplified Payment Verification)
Light client verification using only headers and Merkle proofs.

### Stealth Address
MWEB address scheme where recipient's address is never visible on-chain.

---

## T

### Taproot
Upgrade (BIP 340/341/342) with Schnorr signatures and improved scripting.

### Testnet
Alternative blockchain for testing without real value.

### Transaction
Signed message transferring value from inputs to outputs.

### txid
Transaction identifier (hash). 64-character hex string.

---

## U

### UTXO (Unspent Transaction Output)
Output not yet spent. Set of UTXOs represents current coin ownership.

---

## V

### Virtual Byte (vbyte)
Transaction size unit accounting for SegWit discount. `vbytes = weight / 4`.

### View Tag
1-byte optimization in MWEB stealth addresses for faster scanning.

---

## W

### Wallet
Software managing private keys and creating transactions.

### Witness
Signature/public key data in SegWit transactions.

---

## X

### xpub (Extended Public Key)
BIP 32 key for deriving child public keys. Watch-only wallet support.

### xprv (Extended Private Key)
BIP 32 key for deriving child private keys. Must be kept secret.

---

## Z

### ZMQ (ZeroMQ)
Messaging library for publishing blockchain events to external applications.

---

## Network Parameters

| Network | P2P Port | RPC Port | Address Prefix |
|---------|----------|----------|----------------|
| Mainnet | 9333 | 9332 | L, M, ltc1 |
| Testnet | 19335 | 19332 | m, n, tltc1 |
| Regtest | 19444 | 19443 | m, n |

---

## References

- [Litecoin Core Source](https://github.com/litecoin-project/litecoin)
- [Bitcoin Improvement Proposals](https://github.com/bitcoin/bips)
- [MWEB Documentation](modules/mweb/)

---

**Documentation Version**: 1.0.0
**Last Updated**: 2026-01-12
