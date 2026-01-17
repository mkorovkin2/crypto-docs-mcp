# Complete Project Onboarding Implementation Plan

## Overview

Add project-specific context strings for Beam, Secret Network, and Pirate Chain to bring them to the same "fully onboarded" status as Solana, Cosmos, Polymarket, and Mina. Also clean up the unused `projectContext` field from polymarket.json.

## Current State Analysis

The **only** difference between fully onboarded and partially onboarded projects is the presence of hardcoded project-specific context in `packages/server/src/tools/context-formatter.ts:166-214`.

**Fully Onboarded (have context):** mina, solana, cosmos, polymarket
**Partially Onboarded (no context):** beam, secret, pirate-chain

The `getProjectContext()` function returns detailed platform-specific notes (8-9 lines each) that get appended to LLM system prompts in:
- `ask-docs.ts:225` - Answering documentation questions
- `explain-error.ts:120` - Debugging errors
- `working-example.ts:149` - Generating code examples

### Key Discoveries:
- `packages/server/src/tools/context-formatter.ts:166-214` - The `getProjectContext()` function with hardcoded contexts
- `config/projects/polymarket.json:15` - Unused `projectContext` field (stripped by Zod validation)
- Configuration schema, source registry, search/retrieval logic are identical across all projects

## Desired End State

All 7 projects (Solana, Cosmos, Polymarket, Mina, Beam, Secret Network, Pirate Chain) have project-specific context strings that provide the LLM with critical platform knowledge including:
- Core architecture patterns
- Critical gotchas and constraints
- SDK/library names
- Network endpoints
- Fees and limits

### Verification:
- The `getProjectContext()` function returns non-empty strings for all 7 projects
- Each context follows the same format/style as existing ones (8-9 concise bullet points)
- The unused `projectContext` field is removed from polymarket.json

## What We're NOT Doing

- Adding new configuration schema fields
- Changing how project context is loaded (keeping it hardcoded for now)
- Modifying search/retrieval logic
- Adding new source files or changing the scraper

## Implementation Approach

Single phase: Add three new context entries to the `contexts` object in `getProjectContext()` and remove the dead field from polymarket.json.

## Phase 1: Add Project Contexts and Cleanup

### Overview
Add project-specific context strings for Beam, Secret Network, and Pirate Chain. Remove unused `projectContext` field from polymarket.json.

### Changes Required:

#### 1. Add Beam Context
**File**: `packages/server/src/tools/context-formatter.ts`
**Location**: Add to the `contexts` object inside `getProjectContext()` (after line 210, before the closing brace)

```typescript
    beam: `
BEAM-SPECIFIC NOTES:
- Privacy blockchain: Mimblewimble + LelantusMW protocols, UTXO-based with Pedersen Commitments
- NO addresses on-chain: coins belong to wallet that generated them, addresses not preserved on restore
- Beam Shaders: WASM smart contracts (C++/Rust), Contract Shader (on-chain) + App Shader (wallet-side)
- CRITICAL: Shaders must be deterministic - no random, no time access, no native floats
- Confidential Assets: Layer 1 native (not token contracts), Asset ID 0 = BEAM, fees always in BEAM
- Address types: Regular (online 12h), Offline (non-interactive), Max Privacy (64k anonymity set)
- Wallet API: JSON-RPC 2.0 on port 10000, methods: create_address, tx_send, tx_status, get_utxo
- Networks: Mainnet \`eu-node01.mainnet.beam.mw:8100\`, Explorer \`https://explorer.beam.mw/\`
- Fees: Regular tx 0.001 BEAM, Offline 0.011 BEAM; 1 BEAM = 100,000,000 Groth`,
```

#### 2. Add Secret Network Context
**File**: `packages/server/src/tools/context-formatter.ts`
**Location**: Add to the `contexts` object inside `getProjectContext()` (after beam entry)

```typescript
    secret: `
SECRET NETWORK-SPECIFIC NOTES:
- Privacy via Intel SGX TEEs: encrypted input, output, and state for "Secret Contracts"
- CosmWasm-based (Rust → WASM), entry points: instantiate, execute, query, reply, migrate
- CRITICAL: AES-SIV doesn't pad ciphertext - LEAKS DATA SIZE, manually pad sensitive data
- NO iterator support: cannot access other users' encrypted data without their keys
- Access control: Viewing Keys (inter-contract) or Permits (recommended, no tx required)
- SDKs: secret.js (TypeScript, auto-encrypts), secret-toolkit (Rust), secretcli (CLI)
- secretcli: \`tx compute store\`, \`tx compute instantiate\`, \`tx compute execute\`
- Networks: Mainnet LCD \`https://lcd.mainnet.secretsaturn.net\`, Testnet faucet \`https://faucet.secrettestnet.io/\`
- Fees: 0.5 uscrt/gas recommended, 6M gas/block cap, ~6s blocks; addresses use secret1... prefix`,
```

#### 3. Add Pirate Chain Context
**File**: `packages/server/src/tools/context-formatter.ts`
**Location**: Add to the `contexts` object inside `getProjectContext()` (after secret entry)

```typescript
    'pirate-chain': `
PIRATE CHAIN-SPECIFIC NOTES:
- 100% shielded: zk-SNARKs mandatory, ONLY zs addresses (Sapling), no transparent transactions
- dPoW security: blocks notarized to Komodo → Litecoin every 10-15min, use confirmations > 2
- All RPC commands start with z_: z_sendmany, z_listunspent, z_getbalance, z_getnewaddress
- CRITICAL: z_sendmany returns opid → monitor with z_getoperationstatus (opids clear on restart)
- Two-wallet architecture: separate deposit/withdraw wallets, sweep regularly, exclude change from credits
- PRIVACY: Cannot search addresses/txids in explorers - must maintain internal transaction database
- Memo field: 512 bytes encrypted, accessible via viewing keys without exposing spending keys
- Config: RPC port 45453, server=1, txindex=1, recommended fee 0.0001 ARRR
- Tools: Treasure Chest (full node), lightwalletd (port 9067), PiratePay (self-hosted gateway)`,
```

#### 4. Remove Unused projectContext Field
**File**: `config/projects/polymarket.json`
**Change**: Remove line 15 (`"projectContext": "..."`)

**Before:**
```json
{
  "id": "polymarket",
  "name": "Polymarket",
  "docs": {
    "baseUrl": "https://docs.polymarket.com",
    "includePatterns": ["/docs/**", "/guides/**", "/tutorials/**", "/concepts/**", "/faq/**"],
    "excludePatterns": ["/changelog/", "/releases/", "/blog/"],
    "maxPages": 500,
    "useBrowser": false
  },
  "crawler": {
    "concurrency": 3,
    "delayMs": 1000
  },
  "projectContext": "Polymarket is a prediction market platform. Key concepts include: markets (YES/NO outcome trading), CLOB (Central Limit Order Book) API for trading, conditional tokens representing positions, market resolution via UMA oracle, maker/taker fees, and order types (limit, market). The Python SDK (py-clob-client) and TypeScript SDK (clob-client) are the main integration points."
}
```

**After:**
```json
{
  "id": "polymarket",
  "name": "Polymarket",
  "docs": {
    "baseUrl": "https://docs.polymarket.com",
    "includePatterns": ["/docs/**", "/guides/**", "/tutorials/**", "/concepts/**", "/faq/**"],
    "excludePatterns": ["/changelog/", "/releases/", "/blog/"],
    "maxPages": 500,
    "useBrowser": false
  },
  "crawler": {
    "concurrency": 3,
    "delayMs": 1000
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build` in packages/server
- [ ] JSON is valid: `cat config/projects/polymarket.json | jq .`

#### Manual Verification:
- [ ] Test each project with ask-docs tool and verify context appears in LLM responses
- [ ] Verify beam, secret, pirate-chain questions get platform-specific guidance
- [ ] Confirm polymarket still works correctly after removing the unused field

---

## Testing Strategy

### Unit Tests:
- Verify `getProjectContext('beam')` returns non-empty string
- Verify `getProjectContext('secret')` returns non-empty string
- Verify `getProjectContext('pirate-chain')` returns non-empty string
- Verify `getProjectContext('unknown')` still returns empty string

### Integration Tests:
- Call `crypto_ask_docs` with `project: "beam"` and verify Beam-specific context appears
- Call `crypto_ask_docs` with `project: "secret"` and verify Secret-specific context appears
- Call `crypto_ask_docs` with `project: "pirate-chain"` and verify Pirate-specific context appears

### Manual Testing Steps:
1. Ask a Beam question: "How do I create a Beam shader?" - should mention WASM, deterministic requirement
2. Ask a Secret question: "How do I encrypt state in Secret Network?" - should mention SGX, AES-SIV padding
3. Ask a Pirate question: "How do I send ARRR?" - should mention z_sendmany, opid monitoring

---

## References

- Research findings from web search on Beam: Mimblewimble + LelantusMW, Beam Shaders, Wallet API
- Research findings from web search on Secret Network: Intel SGX, secret.js, viewing keys vs permits
- Research findings from web search on Pirate Chain: zk-SNARKs, z_ commands, dPoW, PiratePay
- Existing context examples: `packages/server/src/tools/context-formatter.ts:168-210`
