# Core Concepts

> Deep dives into the fundamental concepts and technologies behind Litecoin Core.

---

## Overview

This section provides comprehensive explanations of the core concepts, technologies, and mechanisms that make Litecoin work. These guides go beyond implementation details to explain the "why" and "how" of Litecoin's design.

**Audience:** Researchers, developers, students, and anyone wanting to understand Litecoin deeply.

---

## Fundamental Concepts

### Blockchain Concepts

#### Consensus Mechanisms

**File:** [consensus.md](./consensus.md)

Understanding how Litecoin achieves agreement across the network.

**Key Topics:**
- Proof of Work (PoW)
- Nakamoto Consensus
- Longest chain rule
- Difficulty adjustment
- Orphan blocks and reorganizations
- 51% attacks and security

**Consensus Rules:**
```
Block Validity:
- Block size limit: 1 MB base (4 MB weight)
- Block time target: 150 seconds (2.5 minutes)
- Difficulty adjustment: Every 2016 blocks
- Halving interval: 840,000 blocks
- Proof of work: Scrypt algorithm
- Block reward: 12.5 LTC (current era)
```

**Litecoin vs Bitcoin Consensus:**
| Aspect | Litecoin | Bitcoin |
|--------|----------|---------|
| Block Time | 2.5 minutes | 10 minutes |
| Difficulty Adjust | ~3.5 days | ~2 weeks |
| Total Supply | 84 million | 21 million |
| PoW Algorithm | Scrypt | SHA-256 |

---

#### Scrypt Mining

**File:** [scrypt-mining.md](./scrypt-mining.md)

Understanding Litecoin's proof-of-work algorithm.

**What is Scrypt?**

Scrypt is a memory-hard key derivation function designed to make it costly to perform large-scale custom hardware attacks. It was chosen for Litecoin to be ASIC-resistant (though Scrypt ASICs now exist).

**Algorithm Overview:**
```
Scrypt Parameters (Litecoin):
- N = 1024 (iterations)
- r = 1 (block size)
- p = 1 (parallelization)
- Output: 256 bits

scrypt(input) = PBKDF2(password, salt, N, r, p, dkLen)
```

**Mining Process:**
1. Get block header
2. Increment nonce
3. Compute Scrypt hash
4. Compare to target
5. If valid, submit block
6. Otherwise, repeat from step 2

**Memory Requirements:**
- Litecoin Scrypt: ~128 KB memory
- Designed to use more RAM than SHA-256
- Harder to parallelize on GPUs initially
- Eventually ASIC-mined like Bitcoin

**Hardware Evolution:**
| Era | Hardware | Hash Rate |
|-----|----------|-----------|
| 2011-2013 | CPU | 1-10 KH/s |
| 2012-2014 | GPU | 100-1000 KH/s |
| 2013-2015 | FPGA | 1-10 MH/s |
| 2014+ | ASIC | 100+ MH/s |

---

### Transaction Model

#### UTXO Model

**File:** [utxo.md](./utxo.md)

Understanding the Unspent Transaction Output model.

**What is UTXO?**

Litecoin uses a UTXO (Unspent Transaction Output) model rather than an account/balance model. Each transaction consumes previous outputs and creates new ones.

**UTXO Lifecycle:**
```
1. Transaction creates outputs
        ↓
2. Outputs are unspent (UTXO)
        ↓
3. New transaction spends UTXO
        ↓
4. UTXO is removed from set
        ↓
5. New UTXOs are created
```

**Example Transaction:**
```
Inputs:
  [0] Previous TX: abc123..., Output: 0, Amount: 1.5 LTC
  [1] Previous TX: def456..., Output: 1, Amount: 0.8 LTC
  Total Input: 2.3 LTC

Outputs:
  [0] To: LTC_ADDRESS_1, Amount: 1.0 LTC
  [1] To: LTC_ADDRESS_2 (change), Amount: 1.2998 LTC
  Fee: 0.0002 LTC

Total Output: 2.2998 LTC
Total Input - Total Output = Fee
```

**UTXO Set:**
- All unspent outputs in the blockchain
- Stored in memory (with disk cache)
- Critical for validation
- ~2-4 GB in size
- Grows over time

**Benefits:**
- Parallel validation
- Clear ownership
- Privacy through change addresses
- Efficient pruning

---

### Privacy and Scalability

#### MimbleWimble

**File:** [mimblewimble.md](./mimblewimble.md)

Understanding Litecoin's privacy layer.

**What is MimbleWimble?**

MimbleWimble is a privacy-focused blockchain protocol that Litecoin implements through Extension Blocks (MWEB). It provides confidential transactions and improved scalability through transaction cut-through.

**Key Features:**
1. **Confidential Transactions**
   - Hidden amounts
   - Cryptographic commitments
   - Pedersen commitments
   - Range proofs

2. **No Addresses**
   - Stealth addresses
   - Interactive transactions
   - Enhanced privacy

3. **Transaction Cut-Through**
   - Remove intermediate transactions
   - Smaller blockchain
   - Better scalability

**MWEB Architecture:**
```
┌─────────────────────────────────────┐
│      Litecoin Main Block            │
│  ┌──────────────────────────────┐   │
│  │  Regular Transactions        │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │  MWEB Extension Block        │   │
│  │  - Confidential Transactions │   │
│  │  - Peg-in/Peg-out            │   │
│  │  - PMMR updates              │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Peg-In/Peg-Out:**
- **Peg-In:** Move LTC from main chain to MWEB
- **Peg-Out:** Move LTC from MWEB to main chain
- Atomic operations
- No trusted third party

**Privacy Properties:**
- Amount confidentiality
- Transaction graph obfuscation
- No address reuse
- Stealth addresses

---

#### SegWit

**File:** [segwit.md](./segwit.md)

Understanding Segregated Witness.

**What is SegWit?**

Segregated Witness (SegWit) is a protocol upgrade that separates signature data from transaction data, fixing transaction malleability and enabling second-layer solutions.

**Benefits:**
1. **Transaction Malleability Fix**
   - Signatures separate from tx ID
   - Enables Lightning Network
   - Safe for payment channels

2. **Block Capacity Increase**
   - Block weight instead of block size
   - Up to 4x capacity
   - Backwards compatible

3. **Script Versioning**
   - Future upgrades easier
   - No hard forks needed
   - Cleaner upgrades

**Address Types:**
| Type | Format | Example | SegWit |
|------|--------|---------|--------|
| Legacy | P2PKH | L... | No |
| P2SH-SegWit | P2SH | M... | Yes (wrapped) |
| Native SegWit | Bech32 | ltc1... | Yes (native) |

**Transaction Weight:**
```
Weight = (base_size × 3) + total_size

where:
- base_size = non-witness data
- total_size = base_size + witness_size
```

---

### Layer 2

#### Lightning Network

**File:** [lightning.md](./lightning.md)

Understanding Litecoin's Layer 2 scaling solution.

**What is Lightning Network?**

The Lightning Network is a second-layer payment protocol that operates on top of Litecoin, enabling instant, low-fee transactions through payment channels.

**Key Concepts:**

1. **Payment Channels**
   - Bidirectional
   - Off-chain transactions
   - On-chain opening/closing
   - Updates signed by both parties

2. **Routing**
   - Multi-hop payments
   - Onion routing for privacy
   - Atomic swaps
   - Source-based routing

3. **Hash Time Locked Contracts (HTLCs)**
   - Conditional payments
   - Cryptographic hash locks
   - Time locks
   - Secure multi-hop routing

**Channel Lifecycle:**
```
1. Open Channel
   - Create funding transaction
   - Both parties sign
   - Broadcast to blockchain

2. Update Channel
   - Off-chain transactions
   - Commitment transactions
   - Revocation of old states

3. Close Channel
   - Cooperative close (preferred)
   - Force close (unilateral)
   - Broadcast final state
```

**Benefits:**
- Instant payments
- Low fees (~1 satoshi)
- High throughput
- Privacy
- Scalability

---

### Security

#### Cryptography

**File:** [cryptography.md](./cryptography.md)

Understanding the cryptographic foundations.

**Cryptographic Primitives:**

1. **Hash Functions**
   - SHA-256: General hashing
   - RIPEMD-160: Address generation
   - SHA-256d: Double SHA-256 for tx/block IDs
   - Scrypt: Proof of work

2. **Digital Signatures**
   - ECDSA: Current signature scheme
   - secp256k1 curve
   - Schnorr: Future upgrade
   - Key recovery

3. **Key Derivation**
   - BIP32: HD wallets
   - BIP39: Mnemonic seeds
   - BIP44: Account structure
   - PBKDF2: Password-based derivation

**Address Generation:**
```
Private Key (256 bits)
    ↓ ECDSA
Public Key (compressed 33 bytes)
    ↓ SHA-256
    ↓ RIPEMD-160
Public Key Hash (20 bytes)
    ↓ Base58Check (P2PKH) or Bech32 (SegWit)
Address
```

---

### Addresses

#### Address Types

**File:** [addresses.md](./addresses.md)

Understanding different Litecoin address formats.

**Address Format Comparison:**

| Type | Prefix | Length | Example | Script Type |
|------|--------|--------|---------|-------------|
| Legacy P2PKH | L | 34 | LhSjt4... | Pay-to-PubKey-Hash |
| P2SH | M | 34 | MVKw5x... | Pay-to-Script-Hash |
| P2SH-SegWit | M | 34 | MUUv8R... | Wrapped SegWit |
| Bech32 | ltc1 | 42-62 | ltc1q5n... | Native SegWit |
| MWEB | (encoded) | Varies | - | Stealth Address |

**Legacy Addresses (P2PKH):**
```
Format: Base58Check
Prefix: 48 (0x30) = 'L'
Checksum: First 4 bytes of SHA256(SHA256(data))
Structure: [version][public_key_hash][checksum]
```

**P2SH Addresses:**
```
Format: Base58Check
Prefix: 50 (0x32) = 'M' or 5 (0x05) = '3'
Used for: Multi-sig, SegWit wrapped
Structure: [version][script_hash][checksum]
```

**Bech32 Addresses:**
```
Format: Bech32 (BIP173)
HRP: ltc (human-readable part)
Witness version: 0-16
Better: Error detection, lowercase only
Structure: ltc1[witness_version][witness_program]
```

---

## Advanced Concepts

### Network Topology

**File:** [network-topology.md](./network-topology.md)

Understanding P2P network structure and behavior.

**Topics:**
- Peer discovery
- Network partitioning
- Eclipse attacks
- Sybil attacks
- Network resilience

---

### Script System

**File:** [script-system.md](./script-system.md)

Deep dive into Bitcoin Script.

**Topics:**
- Stack-based execution
- Opcodes and their behavior
- Script templates
- Script size limits
- Advanced patterns (HTLC, etc.)

---

### Fee Market

**File:** [fee-market.md](./fee-market.md)

Understanding transaction fees and the fee market.

**Topics:**
- Fee estimation
- Replace-By-Fee (RBF)
- Child-Pays-For-Parent (CPFP)
- Fee sniping
- Optimal fee strategies

---

### Blockchain Security

**File:** [security-model.md](./security-model.md)

Understanding security assumptions and attack vectors.

**Topics:**
- 51% attacks
- Double-spend attacks
- Selfish mining
- Time warp attacks
- Long-range attacks
- Eclipse attacks

---

## Comparison Topics

### Litecoin vs Bitcoin

**File:** [litecoin-vs-bitcoin.md](./litecoin-vs-bitcoin.md)

**Key Differences:**
| Aspect | Litecoin | Bitcoin |
|--------|----------|---------|
| Block Time | 2.5 min | 10 min |
| Total Supply | 84M | 21M |
| PoW Algorithm | Scrypt | SHA-256 |
| Difficulty Retarget | 3.5 days | 2 weeks |
| MWEB | Yes | No |

---

### Consensus Mechanisms

**File:** [consensus-comparison.md](./consensus-comparison.md)

Comparing different consensus mechanisms:
- Proof of Work
- Proof of Stake
- Delegated Proof of Stake
- And their tradeoffs

---

## Historical Context

### Evolution of Litecoin

**File:** [litecoin-history.md](./litecoin-history.md)

**Timeline:**
- 2011: Created by Charlie Lee
- 2013: First ASIC resistance claims
- 2017: SegWit activation
- 2019: MimbleWimble development starts
- 2021: MWEB testnet
- 2022: MWEB mainnet activation

---

## Future Concepts

### Taproot

**File:** [taproot.md](./taproot.md)

Planned upgrade bringing Schnorr signatures and improved scripting.

**Benefits:**
- Privacy improvements
- Script flexibility
- Lower fees
- MAST (Merkelized Abstract Syntax Trees)

---

### Cross-Chain Atomic Swaps

**File:** [atomic-swaps.md](./atomic-swaps.md)

**How It Works:**
1. Hash Time Locked Contracts
2. Secret revelation
3. Trustless exchange
4. No intermediary needed

---

## Learning Path

### Beginner Path

1. [Blockchain Basics](./blockchain-basics.md)
2. [UTXO Model](./utxo.md)
3. [Addresses](./addresses.md)
4. [Transactions](./transactions-explained.md)

### Intermediate Path

5. [Script System](./script-system.md)
6. [Consensus Mechanisms](./consensus.md)
7. [Mining](./scrypt-mining.md)
8. [SegWit](./segwit.md)

### Advanced Path

9. [MimbleWimble](./mimblewimble.md)
10. [Lightning Network](./lightning.md)
11. [Security Model](./security-model.md)
12. [Protocol Design](./protocol-design.md)

---

## See Also

- [Architecture Overview](../architecture-overview.md) - System design
- [Modules](../modules/index.md) - Implementation details
- [Examples](../examples/index.md) - Practical examples
- [Guides](../guides/index.md) - Developer guides

---

## Navigation

← [README](../README.md) | [Architecture](../architecture-overview.md) | [Modules](../modules/index.md) →

---

*Last Updated: 2026-01-12*
*Part of the Litecoin Core Documentation Project*
