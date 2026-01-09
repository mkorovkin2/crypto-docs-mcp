import { z } from 'zod';
import type { ToolContext } from './index.js';

export const ResolveImportSchema = z.object({
  symbol: z.string().describe('Symbol to import (e.g., "MerkleTree", "Poseidon", "SmartContract")'),
  includeRelated: z.boolean().optional().default(true).describe('Include related symbols you might also need')
});

type ResolveImportArgs = z.infer<typeof ResolveImportSchema>;

// Comprehensive import map for o1js
interface ImportInfo {
  import: string;
  description: string;
  relatedSymbols?: string[];
  example?: string;
  notes?: string;
}

const IMPORT_MAP: Record<string, ImportInfo> = {
  // Core Types
  'Field': {
    import: "import { Field } from 'o1js';",
    description: 'Finite field element - the basic building block of all o1js computation',
    relatedSymbols: ['Bool', 'UInt64', 'UInt32', 'Provable'],
    example: 'const x = Field(42);'
  },
  'Bool': {
    import: "import { Bool } from 'o1js';",
    description: 'Provable boolean type',
    relatedSymbols: ['Field', 'Provable'],
    example: 'const flag = Bool(true);'
  },
  'UInt64': {
    import: "import { UInt64 } from 'o1js';",
    description: '64-bit unsigned integer with range checks',
    relatedSymbols: ['UInt32', 'Field', 'Int64'],
    example: 'const amount = UInt64.from(1000000000);'
  },
  'UInt32': {
    import: "import { UInt32 } from 'o1js';",
    description: '32-bit unsigned integer with range checks',
    relatedSymbols: ['UInt64', 'Field'],
    example: 'const index = UInt32.from(5);'
  },
  'Int64': {
    import: "import { Int64 } from 'o1js';",
    description: 'Signed 64-bit integer',
    relatedSymbols: ['UInt64', 'Field'],
    example: 'const balance = Int64.from(-100);'
  },
  'Sign': {
    import: "import { Sign } from 'o1js';",
    description: 'Represents +1 or -1 for signed arithmetic',
    relatedSymbols: ['Int64', 'Field']
  },
  'Character': {
    import: "import { Character } from 'o1js';",
    description: 'Single character type for provable strings',
    relatedSymbols: ['CircuitString']
  },
  'CircuitString': {
    import: "import { CircuitString } from 'o1js';",
    description: 'Fixed-length provable string',
    relatedSymbols: ['Character', 'Field'],
    example: 'const name = CircuitString.fromString("Alice");'
  },

  // Smart Contract
  'SmartContract': {
    import: "import { SmartContract, state, State, method } from 'o1js';",
    description: 'Base class for zkApp smart contracts',
    relatedSymbols: ['State', 'state', 'method', 'DeployArgs', 'PublicKey', 'Field', 'AccountUpdate'],
    example: `class MyContract extends SmartContract {
  @state(Field) value = State<Field>();

  @method async update(newValue: Field) {
    this.value.set(newValue);
  }
}`,
    notes: 'Always import state and method decorators together with SmartContract'
  },
  'State': {
    import: "import { State, state } from 'o1js';",
    description: 'On-chain state container type',
    relatedSymbols: ['SmartContract', 'state'],
    example: '@state(Field) myState = State<Field>();'
  },
  'state': {
    import: "import { state, State } from 'o1js';",
    description: 'Decorator for on-chain state',
    relatedSymbols: ['State', 'SmartContract'],
    example: '@state(Field) counter = State<Field>();'
  },
  'method': {
    import: "import { method } from 'o1js';",
    description: 'Decorator for provable contract methods',
    relatedSymbols: ['SmartContract'],
    example: '@method async myMethod(arg: Field) { ... }'
  },
  'DeployArgs': {
    import: "import { DeployArgs } from 'o1js';",
    description: 'Arguments for contract deployment',
    relatedSymbols: ['SmartContract']
  },
  'Permissions': {
    import: "import { Permissions } from 'o1js';",
    description: 'Account permission configuration',
    relatedSymbols: ['SmartContract', 'AccountUpdate'],
    example: 'this.account.permissions.set(Permissions.default());'
  },

  // Cryptographic Primitives
  'Poseidon': {
    import: "import { Poseidon } from 'o1js';",
    description: 'Poseidon hash function - most efficient for zkApps',
    relatedSymbols: ['Field', 'MerkleTree'],
    example: 'const hash = Poseidon.hash([a, b, c]);'
  },
  'Encryption': {
    import: "import { Encryption } from 'o1js';",
    description: 'Public key encryption utilities',
    relatedSymbols: ['PrivateKey', 'PublicKey'],
    example: 'const encrypted = Encryption.encrypt(msg, publicKey);'
  },
  'Signature': {
    import: "import { Signature } from 'o1js';",
    description: 'Schnorr signature',
    relatedSymbols: ['PrivateKey', 'PublicKey', 'Field'],
    example: 'const sig = Signature.create(privateKey, [Field(1)]);'
  },
  'Group': {
    import: "import { Group } from 'o1js';",
    description: 'Elliptic curve point',
    relatedSymbols: ['Scalar', 'PublicKey'],
    example: 'const point = Group.generator;'
  },
  'Scalar': {
    import: "import { Scalar } from 'o1js';",
    description: 'Scalar field element (for curve operations)',
    relatedSymbols: ['Group', 'PrivateKey']
  },

  // Keys
  'PublicKey': {
    import: "import { PublicKey } from 'o1js';",
    description: 'Public key / account address',
    relatedSymbols: ['PrivateKey', 'Signature', 'AccountUpdate'],
    example: 'const pk = PublicKey.fromBase58("B62q...");'
  },
  'PrivateKey': {
    import: "import { PrivateKey } from 'o1js';",
    description: 'Private key for signing',
    relatedSymbols: ['PublicKey', 'Signature'],
    example: 'const sk = PrivateKey.random();'
  },

  // Merkle Data Structures
  'MerkleTree': {
    import: "import { MerkleTree } from 'o1js';",
    description: 'Merkle tree for membership proofs',
    relatedSymbols: ['MerkleWitness', 'Field', 'Poseidon'],
    example: `const tree = new MerkleTree(8);
tree.setLeaf(0n, Poseidon.hash([value]));
const root = tree.getRoot();`
  },
  'MerkleWitness': {
    import: "import { MerkleWitness } from 'o1js';",
    description: 'Base class for Merkle proofs - must be subclassed with height',
    relatedSymbols: ['MerkleTree', 'Field'],
    example: `class MyWitness extends MerkleWitness(8) {}
const witness = new MyWitness(tree.getWitness(0n));`,
    notes: 'Must call MerkleWitness(height) to create class with specific height'
  },
  'MerkleMap': {
    import: "import { MerkleMap, MerkleMapWitness } from 'o1js';",
    description: 'Key-value Merkle map',
    relatedSymbols: ['MerkleMapWitness', 'Field'],
    example: `const map = new MerkleMap();
map.set(key, value);
const witness = map.getWitness(key);`
  },
  'MerkleMapWitness': {
    import: "import { MerkleMapWitness } from 'o1js';",
    description: 'Witness for MerkleMap operations',
    relatedSymbols: ['MerkleMap', 'Field'],
    example: 'const [root, key] = witness.computeRootAndKey(value);'
  },
  'MerkleList': {
    import: "import { MerkleList } from 'o1js';",
    description: 'Merkle list for append-only data structures',
    relatedSymbols: ['Field', 'Poseidon']
  },

  // Network & Transactions
  'Mina': {
    import: "import { Mina } from 'o1js';",
    description: 'Network interaction utilities',
    relatedSymbols: ['AccountUpdate', 'PublicKey', 'PrivateKey', 'fetchAccount'],
    example: `const Local = await Mina.LocalBlockchain();
Mina.setActiveInstance(Local);`
  },
  'AccountUpdate': {
    import: "import { AccountUpdate } from 'o1js';",
    description: 'Account state changes in a transaction',
    relatedSymbols: ['Mina', 'SmartContract', 'PublicKey'],
    example: 'AccountUpdate.fundNewAccount(sender);'
  },
  'fetchAccount': {
    import: "import { fetchAccount } from 'o1js';",
    description: 'Fetch account state from network',
    relatedSymbols: ['Mina', 'PublicKey'],
    example: 'await fetchAccount({ publicKey: contractAddress });'
  },
  'fetchLastBlock': {
    import: "import { fetchLastBlock } from 'o1js';",
    description: 'Fetch latest block info',
    relatedSymbols: ['Mina']
  },
  'setGraphqlEndpoint': {
    import: "import { setGraphqlEndpoint } from 'o1js';",
    description: 'Set the GraphQL endpoint for network requests',
    relatedSymbols: ['Mina', 'fetchAccount']
  },
  'TokenId': {
    import: "import { TokenId } from 'o1js';",
    description: 'Token identifier utilities',
    relatedSymbols: ['AccountUpdate', 'SmartContract']
  },
  'Token': {
    import: "import { TokenId } from 'o1js';",
    description: 'Token utilities (use TokenId)',
    relatedSymbols: ['TokenId', 'AccountUpdate']
  },

  // Provable Utilities
  'Provable': {
    import: "import { Provable } from 'o1js';",
    description: 'Utilities for provable computation (if/switch/witness)',
    relatedSymbols: ['Field', 'Bool'],
    example: `const result = Provable.if(condition, valueIfTrue, valueIfFalse);
Provable.log("debug:", value);`
  },
  'Struct': {
    import: "import { Struct } from 'o1js';",
    description: 'Create custom provable data structures',
    relatedSymbols: ['Field', 'Bool', 'CircuitValue'],
    example: `class Point extends Struct({
  x: Field,
  y: Field
}) {}`
  },
  'CircuitValue': {
    import: "import { CircuitValue } from 'o1js';",
    description: 'Legacy base class for provable types (use Struct instead)',
    relatedSymbols: ['Struct'],
    notes: 'Deprecated - use Struct instead'
  },
  'Unconstrained': {
    import: "import { Unconstrained } from 'o1js';",
    description: 'Wrap values that should not be constrained in circuit',
    relatedSymbols: ['Provable'],
    example: 'const data = Unconstrained.from(myValue);'
  },
  'Cache': {
    import: "import { Cache } from 'o1js';",
    description: 'Cache for compiled circuits',
    relatedSymbols: ['SmartContract', 'ZkProgram'],
    example: "const cache = Cache.FileSystem('./cache');"
  },

  // ZkPrograms
  'ZkProgram': {
    import: "import { ZkProgram } from 'o1js';",
    description: 'Create standalone zero-knowledge programs',
    relatedSymbols: ['Field', 'Proof', 'SelfProof'],
    example: `const MyProgram = ZkProgram({
  name: 'my-program',
  publicInput: Field,
  methods: {
    compute: {
      privateInputs: [Field],
      async method(input: Field, secret: Field) {
        // computation
      }
    }
  }
});`
  },
  'Proof': {
    import: "import { Proof } from 'o1js';",
    description: 'Proof type for ZkProgram',
    relatedSymbols: ['ZkProgram', 'SelfProof']
  },
  'SelfProof': {
    import: "import { SelfProof } from 'o1js';",
    description: 'Self-referential proof for recursive proofs',
    relatedSymbols: ['ZkProgram', 'Proof'],
    example: 'async method(prev: SelfProof<Field, void>) { prev.verify(); }'
  },
  'DynamicProof': {
    import: "import { DynamicProof } from 'o1js';",
    description: 'Dynamically-sized proofs',
    relatedSymbols: ['ZkProgram', 'Proof']
  },
  'VerificationKey': {
    import: "import { VerificationKey } from 'o1js';",
    description: 'Verification key for proofs',
    relatedSymbols: ['SmartContract', 'ZkProgram']
  },

  // Experimental / Advanced
  'Experimental': {
    import: "import { Experimental } from 'o1js';",
    description: 'Experimental features (may change)',
    notes: 'API may change between versions'
  },
  'Reducer': {
    import: "import { Reducer } from 'o1js';",
    description: 'Actions and reducer pattern for complex state updates',
    relatedSymbols: ['SmartContract', 'Field'],
    example: `const reducer = Reducer({ actionType: Field });
this.reducer.dispatch(Field(1));`
  },

  // Common Utilities
  'Gadgets': {
    import: "import { Gadgets } from 'o1js';",
    description: 'Low-level circuit gadgets (SHA256, range checks, etc.)',
    relatedSymbols: ['Field', 'Bool'],
    example: 'const hash = Gadgets.SHA256.hash(bytes);'
  },
  'Bytes': {
    import: "import { Bytes } from 'o1js';",
    description: 'Fixed-length byte array',
    relatedSymbols: ['Field', 'Gadgets'],
    example: 'class Bytes32 extends Bytes(32) {}'
  },
  'Hash': {
    import: "import { Hash } from 'o1js';",
    description: 'Hash function utilities (includes SHA and other algorithms)',
    relatedSymbols: ['Poseidon', 'Gadgets']
  },
  'Keccak': {
    import: "import { Keccak } from 'o1js';",
    description: 'Keccak/SHA3 hash function',
    relatedSymbols: ['Hash', 'Gadgets']
  },
  'Packed': {
    import: "import { Packed } from 'o1js';",
    description: 'Pack multiple values into fewer field elements',
    relatedSymbols: ['Field', 'Struct']
  },

  // Events
  'Events': {
    import: "import { SmartContract } from 'o1js';",
    description: 'Event types (defined as property on SmartContract)',
    relatedSymbols: ['SmartContract'],
    example: `class MyContract extends SmartContract {
  events = { update: Field };

  @method async doUpdate(v: Field) {
    this.emitEvent('update', v);
  }
}`
  },

  // Time-related
  'UInt8': {
    import: "import { UInt8 } from 'o1js';",
    description: '8-bit unsigned integer',
    relatedSymbols: ['UInt32', 'UInt64', 'Field']
  },

  // Constants
  'FieldConst': {
    import: "import { Field } from 'o1js';",
    description: 'Field constants are just Field values',
    relatedSymbols: ['Field'],
    notes: 'Use Field(0), Field(1), etc.'
  },

  // Foreign Field
  'ForeignField': {
    import: "import { ForeignField } from 'o1js';",
    description: 'Operations in non-native fields (e.g., for ECDSA)',
    relatedSymbols: ['Field', 'Gadgets']
  },
  'ForeignCurve': {
    import: "import { ForeignCurve } from 'o1js';",
    description: 'Operations on non-native elliptic curves',
    relatedSymbols: ['ForeignField']
  },
  'ECDSA': {
    import: "import { Ecdsa } from 'o1js';",
    description: 'ECDSA signature verification',
    relatedSymbols: ['ForeignCurve', 'ForeignField']
  },
  'Ecdsa': {
    import: "import { Ecdsa } from 'o1js';",
    description: 'ECDSA signature verification',
    relatedSymbols: ['ForeignCurve', 'ForeignField']
  }
};

// Category groupings for related imports
const IMPORT_CATEGORIES: Record<string, string[]> = {
  'core': ['Field', 'Bool', 'UInt64', 'UInt32'],
  'contract': ['SmartContract', 'State', 'state', 'method', 'Permissions', 'AccountUpdate'],
  'crypto': ['Poseidon', 'Signature', 'Encryption', 'PublicKey', 'PrivateKey'],
  'merkle': ['MerkleTree', 'MerkleWitness', 'MerkleMap', 'MerkleMapWitness'],
  'network': ['Mina', 'fetchAccount', 'AccountUpdate'],
  'zkprogram': ['ZkProgram', 'Proof', 'SelfProof', 'VerificationKey'],
  'provable': ['Provable', 'Struct', 'Unconstrained']
};

// Common import combinations
const COMMON_COMBINATIONS: Record<string, string> = {
  'basic-contract': "import { SmartContract, state, State, method, Field, PublicKey } from 'o1js';",
  'full-contract': "import { SmartContract, state, State, method, Field, Bool, UInt64, PublicKey, Poseidon, Permissions } from 'o1js';",
  'merkle-setup': "import { MerkleTree, MerkleWitness, Field, Poseidon } from 'o1js';",
  'testing': "import { Mina, PrivateKey, PublicKey, AccountUpdate, Field } from 'o1js';",
  'zkprogram': "import { ZkProgram, Field, SelfProof, Proof } from 'o1js';"
};

export async function resolveImport(
  args: ResolveImportArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const normalizedSymbol = args.symbol.trim();

  // Check if asking for a common combination
  if (COMMON_COMBINATIONS[normalizedSymbol.toLowerCase()]) {
    const combo = COMMON_COMBINATIONS[normalizedSymbol.toLowerCase()];
    return {
      content: [{
        type: 'text',
        text: [
          `# Import: ${normalizedSymbol}`,
          '',
          '```typescript',
          combo,
          '```',
          '',
          'This is a common import combination for this use case.'
        ].join('\n')
      }]
    };
  }

  // Check if asking for a category
  const categoryKey = Object.keys(IMPORT_CATEGORIES).find(
    k => k.toLowerCase() === normalizedSymbol.toLowerCase()
  );

  if (categoryKey) {
    const symbols = IMPORT_CATEGORIES[categoryKey];
    const imports = symbols
      .filter(s => IMPORT_MAP[s])
      .map(s => IMPORT_MAP[s].import);

    // Dedupe and combine
    const combinedImport = `import { ${symbols.join(', ')} } from 'o1js';`;

    return {
      content: [{
        type: 'text',
        text: [
          `# ${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)} Imports`,
          '',
          '**Combined import:**',
          '```typescript',
          combinedImport,
          '```',
          '',
          '**Individual imports:**',
          '',
          ...symbols.map(s => IMPORT_MAP[s] ? `- \`${s}\`: ${IMPORT_MAP[s].description}` : `- \`${s}\``),
        ].join('\n')
      }]
    };
  }

  // Find the symbol (case-insensitive)
  const symbolKey = Object.keys(IMPORT_MAP).find(
    k => k.toLowerCase() === normalizedSymbol.toLowerCase()
  );

  if (!symbolKey) {
    // Try fuzzy search
    const possibleMatches = Object.keys(IMPORT_MAP).filter(k =>
      k.toLowerCase().includes(normalizedSymbol.toLowerCase()) ||
      normalizedSymbol.toLowerCase().includes(k.toLowerCase())
    );

    // Search documentation as fallback
    const results = await context.search.search(`${normalizedSymbol} import o1js`, { limit: 2 });

    const sections = [
      `# Import: ${normalizedSymbol}`,
      '',
      `Symbol "${normalizedSymbol}" not found in import database.`
    ];

    if (possibleMatches.length > 0) {
      sections.push(
        '',
        '**Did you mean:**',
        ...possibleMatches.slice(0, 5).map(m => `- ${m}`)
      );
    }

    sections.push(
      '',
      '**Common import categories:**',
      '- `core` - Field, Bool, UInt64, UInt32',
      '- `contract` - SmartContract, State, method, etc.',
      '- `crypto` - Poseidon, Signature, Keys',
      '- `merkle` - MerkleTree, MerkleMap, etc.',
      '- `network` - Mina, fetchAccount, AccountUpdate'
    );

    if (results.length > 0) {
      sections.push('', '**Related documentation:**');
      for (const r of results) {
        sections.push(`- [${r.chunk.title}](${r.chunk.url})`);
      }
    }

    return {
      content: [{ type: 'text', text: sections.join('\n') }]
    };
  }

  const info = IMPORT_MAP[symbolKey];
  const sections = [
    `# Import: ${symbolKey}`,
    '',
    '```typescript',
    info.import,
    '```',
    '',
    info.description
  ];

  if (info.notes) {
    sections.push('', `**Note:** ${info.notes}`);
  }

  if (info.example) {
    sections.push('', '**Example:**', '```typescript', info.example, '```');
  }

  if (args.includeRelated && info.relatedSymbols && info.relatedSymbols.length > 0) {
    sections.push('', '## Related Symbols', '');

    for (const related of info.relatedSymbols) {
      const relatedInfo = IMPORT_MAP[related];
      if (relatedInfo) {
        sections.push(`**${related}**`);
        sections.push('```typescript', relatedInfo.import, '```');
        sections.push(relatedInfo.description, '');
      }
    }

    // Combined import suggestion
    const allSymbols = [symbolKey, ...info.relatedSymbols];
    const o1jsSymbols = allSymbols.filter(s => {
      const sInfo = IMPORT_MAP[s];
      return sInfo && sInfo.import.includes("from 'o1js'");
    });

    if (o1jsSymbols.length > 1) {
      sections.push(
        '**Combined import (if using all):**',
        '```typescript',
        `import { ${o1jsSymbols.join(', ')} } from 'o1js';`,
        '```'
      );
    }
  }

  return {
    content: [{ type: 'text', text: sections.join('\n') }]
  };
}
