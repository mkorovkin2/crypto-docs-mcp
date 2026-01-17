/**
 * Context Formatter - Formats search results for LLM prompts
 *
 * Includes rich metadata for code chunks to help the LLM:
 * - Generate more accurate code with correct imports
 * - Understand class/method relationships
 * - Reference source file locations
 */

import type { SearchResult, QueryType } from '@mina-docs/shared';

export interface FormatOptions {
  includeMetadata?: boolean;
  labelType?: boolean;
  /** Query type for specialized formatting (concept queries get document grouping) */
  queryType?: QueryType;
}

/**
 * Format a single chunk with rich metadata for code comprehension
 */
export function formatChunkWithMetadata(
  result: SearchResult,
  index: number,
  options: FormatOptions = {}
): string {
  const { includeMetadata = true, labelType = false } = options;
  const { chunk } = result;

  const sourceLabel = `[Source ${index + 1}]`;
  const typeLabel = labelType
    ? (chunk.contentType === 'code' ? '[CODE]' : chunk.contentType === 'api-reference' ? '[API]' : '[DOCS]')
    : '';

  // Build metadata section for code chunks
  let metadataSection = '';
  if (includeMetadata && chunk.contentType === 'code') {
    const metaParts: string[] = [];

    if (chunk.metadata.codeLanguage) {
      metaParts.push(`Language: ${chunk.metadata.codeLanguage}`);
    }
    if (chunk.metadata.className) {
      metaParts.push(`Class: ${chunk.metadata.className}`);
    }
    if (chunk.metadata.methodName) {
      metaParts.push(`Method: ${chunk.metadata.methodName}`);
    }
    if (chunk.metadata.functionName) {
      metaParts.push(`Function: ${chunk.metadata.functionName}`);
    }
    if (chunk.metadata.typeName) {
      metaParts.push(`Type: ${chunk.metadata.typeName}`);
    }
    if (chunk.metadata.filePath) {
      metaParts.push(`File: ${chunk.metadata.filePath}`);
    }
    if (chunk.metadata.sourceType === 'github') {
      metaParts.push(`Source: GitHub`);
    }

    if (metaParts.length > 0) {
      metadataSection = metaParts.join(' | ') + '\n';
    }
  }

  // Include headings context if available
  let headingsContext = '';
  if (includeMetadata && chunk.metadata.headings && chunk.metadata.headings.length > 0) {
    headingsContext = `Headings: ${chunk.metadata.headings.slice(0, 3).join(' > ')}\n`;
  }

  const content = chunk.content;

  return `${sourceLabel} ${typeLabel} ${chunk.title} - ${chunk.section}
${metadataSection}${headingsContext}URL: ${chunk.url}
Content:
${content}
---`;
}

/**
 * Format all search results as context for LLM
 *
 * For concept queries, groups chunks by document to show relationships
 */
export function formatSearchResultsAsContext(
  results: SearchResult[],
  options: FormatOptions = {}
): string {
  // For concept queries, use document grouping to show relationships
  if (options.queryType === 'concept' && results.length > 3) {
    return formatConceptualContext(results, options);
  }

  // Standard formatting for other query types
  return results
    .map((r, i) => formatChunkWithMetadata(r, i, options))
    .join('\n\n');
}

/**
 * Format search results with document grouping for conceptual queries
 *
 * Groups chunks by their source document and shows the section progression
 * to help the LLM understand document structure and concept relationships.
 */
function formatConceptualContext(
  results: SearchResult[],
  options: FormatOptions
): string {
  // Group results by document URL
  const byDocument = new Map<string, SearchResult[]>();

  for (const result of results) {
    const docKey = result.chunk.documentId || result.chunk.url;
    if (!byDocument.has(docKey)) {
      byDocument.set(docKey, []);
    }
    byDocument.get(docKey)!.push(result);
  }

  // Format with document grouping
  let output = '';
  let globalIndex = 0;

  for (const [, chunks] of byDocument) {
    // Sort chunks by their position in document
    chunks.sort((a, b) =>
      (a.chunk.chunkIndex || 0) - (b.chunk.chunkIndex || 0)
    );

    // Get unique sections covered
    const sections = [...new Set(chunks.map(c => c.chunk.section))];
    const docTitle = chunks[0].chunk.title;

    output += `=== Document: ${docTitle} ===\n`;
    output += `Sections: ${sections.join(' → ')}\n\n`;

    for (const chunk of chunks) {
      output += formatChunkWithMetadata(chunk, globalIndex++, options);
      output += '\n\n';
    }
  }

  return output.trim();
}

/**
 * Format source URLs for reference section
 */
export function formatSourceUrls(results: SearchResult[]): string {
  return results
    .map((r, i) => `[Source ${i + 1}]: ${r.chunk.url}`)
    .join('\n');
}

/**
 * Get project-specific context for prompts
 */
export function getProjectContext(project: string): string {
  const contexts: Record<string, string> = {
    mina: `
MINA-SPECIFIC NOTES:
- zkApps use o1js library - circuits built by execution, not compilation
- Only o1js types (Field, Bool, UInt64, CircuitString) create provable constraints
- Circuits must be static: no dynamic loops, no reading Field values with .toString() in circuit code
- zkApp accounts have 8 on-chain state fields (Field type, 32 bytes each)
- Use Provable.if() instead of regular conditionals (both branches execute)
- Proof generation: ~30 seconds, use \`contract.compile()\` first (cached in ~/.cache/pickles)
- Networks: Devnet \`https://api.minascan.io/node/devnet/v1/graphql\`, Berkeley testnet, Mainnet
- Account creation fee: 1 MINA; typical tx fee: 0.1 MINA`,

    solana: `
SOLANA-SPECIFIC NOTES:
- Programs are stateless code; data lives in separate accounts passed by reference
- PDAs (Program Derived Addresses): deterministic addresses from seeds, no private key, programs can sign
- Anchor framework: \`#[program]\`, \`#[derive(Accounts)]\`, \`#[account]\` macros reduce boilerplate
- Transaction limits: 1,232 bytes, 200K compute units default (1.4M max), use Address Lookup Tables for >35 accounts
- CRITICAL: Always validate account ownership, signer status, and discriminators - runtime provides no checks
- SPL Tokens: Mint accounts (metadata), Token accounts (balances), Token Program at fixed address
- Networks: Devnet \`https://api.devnet.solana.com\`, Mainnet \`https://api.mainnet-beta.solana.com\`
- Programs upgradeable by default; make immutable with \`solana program set-upgrade-authority --final\``,

    cosmos: `
COSMOS-SPECIFIC NOTES:
- Modules follow keeper/types/handler pattern with message routing
- Keepers handle state access; messages define transactions; queries are read-only
- State stored in multistore with prefixed keys per module
- IBC (Inter-Blockchain Communication) for cross-chain transfers and contract calls
- Gas estimation required; use simulation before broadcasting
- Transactions signed with secp256k1 keys, bech32 addresses (cosmos1...)
- cosmjs for JavaScript/TypeScript client development
- Protobuf for message serialization; amino still supported for legacy`,

    polymarket: `
POLYMARKET-SPECIFIC NOTES:
- Hybrid CLOB: off-chain order matching, on-chain settlement via EIP712 signatures on Polygon
- Binary markets: YES/NO tokens as ERC1155 via Gnosis CTF, backed by USDC.e (not native USDC)
- SDKs: py-clob-client (Python), clob-client (TypeScript) - create client with API key + secret
- Order types: GTC, GTD (+1min buffer required), FOK; all are limit orders internally
- CRITICAL: Must set allowances before trading - USDC.e for buys, setApprovalForAll for sells
- Auth: L1 (EIP-712 wallet sig) → L2 credentials (apiKey, secret, passphrase via /auth/api-key)
- Resolution via UMA Optimistic Oracle with 2-hour challenge period
- Most markets fee-free; 15-min crypto markets have taker fees funding maker rebates`,

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
- Tools: Treasure Chest (full node), lightwalletd (port 9067), PiratePay (self-hosted gateway)`
  };

  return contexts[project.toLowerCase()] || '';
}
