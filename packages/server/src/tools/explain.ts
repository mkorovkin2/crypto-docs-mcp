import { z } from 'zod';
import type { ToolContext } from './index.js';

export const ExplainConceptSchema = z.object({
  concept: z.string(),
  depth: z.enum(['brief', 'detailed']).optional().default('brief')
});

type ExplainConceptArgs = z.infer<typeof ExplainConceptSchema>;

// Common Mina/ZK concepts with pre-defined explanations
const CONCEPT_GLOSSARY: Record<string, { brief: string; detailed: string }> = {
  'zksnark': {
    brief: 'Zero-Knowledge Succinct Non-Interactive Argument of Knowledge - a cryptographic proof that allows one party to prove possession of information without revealing it.',
    detailed: `zkSNARKs are the foundation of Mina Protocol. They enable the 22KB blockchain by allowing validators to verify the entire chain state through a small, constant-size proof.

In Mina, zkSNARKs are generated using the Kimchi proof system (a PLONKish construction).

Key properties:
- **Zero-knowledge**: Reveals nothing about inputs while proving knowledge
- **Succinct**: Small proof size (constant regardless of computation size)
- **Non-interactive**: No back-and-forth communication required

In o1js, you write TypeScript code that compiles to zkSNARK circuits automatically.`
  },
  'smartcontract': {
    brief: 'In o1js, SmartContract is the base class for creating zkApps - zero-knowledge applications that run on Mina.',
    detailed: `SmartContract in o1js is the base class for building zkApps on Mina Protocol.

Key features:
- **@state decorator**: Declare on-chain state (max 8 Field elements per contract)
- **@method decorator**: Define provable methods that generate zero-knowledge proofs
- **Off-chain execution**: Computation happens client-side, only proofs go on-chain

Example structure:
\`\`\`typescript
class MyContract extends SmartContract {
  @state(Field) value = State<Field>();

  @method async update(newValue: Field) {
    this.value.set(newValue);
  }
}
\`\`\`

State is stored on-chain but computation happens off-chain, making zkApps privacy-preserving by default.`
  },
  'provable': {
    brief: 'Provable types in o1js are data types that can be used inside zkApp methods to generate zero-knowledge proofs.',
    detailed: `Provable types are the building blocks of zkApp circuits in o1js.

**Core Provable Types:**
- \`Field\` - Native field element (the most basic type)
- \`Bool\` - Boolean value
- \`UInt32\` / \`UInt64\` - Unsigned integers
- \`PublicKey\` - Mina public key
- \`Signature\` - Digital signature
- \`Struct\` - Custom composite types

**Key Rules:**
1. Only provable types can be used in @method functions
2. Non-provable operations (like console.log) are executed during proof generation but not part of the circuit
3. Use \`Provable.log()\` for debugging during proof generation
4. Use \`Provable.if()\` for conditional logic in circuits

**Example:**
\`\`\`typescript
@method async transfer(amount: UInt64, to: PublicKey) {
  // All types here must be provable
  const balance = this.balance.get();
  balance.assertGreaterThanOrEqual(amount);
}
\`\`\``
  },
  'field': {
    brief: 'Field is the fundamental data type in o1js - a prime field element that all other types are built from.',
    detailed: `Field is the native data type of zk circuits in o1js. Every value in a zkApp ultimately reduces to Field elements.

**Key characteristics:**
- Represents integers modulo a large prime (the Pasta curve prime)
- All arithmetic is modular
- Max value is approximately 2^254

**Common operations:**
\`\`\`typescript
const a = Field(10);
const b = Field(20);

// Arithmetic
const sum = a.add(b);
const product = a.mul(b);
const diff = b.sub(a);

// Comparisons (return Bool)
const isEqual = a.equals(b);
const isLess = a.lessThan(b);

// Assertions
a.assertEquals(Field(10));
\`\`\`

**Creating Fields from other types:**
\`\`\`typescript
Field(42)           // from number
Field("123")        // from string
Field.from(bigint)  // from bigint
\`\`\``
  },
  'zkapp': {
    brief: 'A zkApp (zero-knowledge app) is a smart contract on Mina that uses zero-knowledge proofs for privacy and verification.',
    detailed: `zkApps are Mina's smart contracts - they execute off-chain and submit proofs on-chain.

**How zkApps work:**
1. User runs the zkApp locally (off-chain computation)
2. o1js generates a zero-knowledge proof of correct execution
3. Proof is submitted to the Mina network
4. Validators verify the proof (not re-execute the code)

**Key advantages:**
- **Privacy**: Inputs can remain private
- **Efficiency**: Only proof verification on-chain
- **Composability**: Multiple zkApps can interact

**zkApp structure:**
\`\`\`typescript
import { SmartContract, state, State, method, Field } from 'o1js';

class Counter extends SmartContract {
  @state(Field) count = State<Field>();

  init() {
    super.init();
    this.count.set(Field(0));
  }

  @method async increment() {
    const current = this.count.get();
    this.count.requireEquals(current);
    this.count.set(current.add(1));
  }
}
\`\`\``
  },
  'poseidon': {
    brief: 'Poseidon is a ZK-friendly hash function used in o1js for efficient hashing inside circuits.',
    detailed: `Poseidon is a cryptographic hash function optimized for zero-knowledge proof systems.

**Why Poseidon (not SHA256)?**
- SHA256 requires ~25,000 constraints in a circuit
- Poseidon requires only ~300 constraints
- Dramatically reduces proof generation time

**Usage in o1js:**
\`\`\`typescript
import { Poseidon, Field } from 'o1js';

// Hash a single field
const hash = Poseidon.hash([Field(123)]);

// Hash multiple fields
const multiHash = Poseidon.hash([
  Field(1),
  Field(2),
  Field(3)
]);

// Common pattern: hash a struct
class MyData extends Struct({
  x: Field,
  y: Field
}) {
  hash() {
    return Poseidon.hash([this.x, this.y]);
  }
}
\`\`\`

**Use cases:**
- Merkle tree nodes
- Commitment schemes
- Data integrity verification
- Privacy-preserving computations`
  },
  'merkletree': {
    brief: 'MerkleTree in o1js is used for efficient storage and verification of large datasets with on-chain roots.',
    detailed: `Merkle trees allow zkApps to work with large datasets while only storing a small root hash on-chain.

**How it works:**
1. Store data leaves off-chain
2. Compute Merkle root (single Field value)
3. Store only the root on-chain
4. Prove membership with a witness path

**o1js implementation:**
\`\`\`typescript
import { MerkleTree, MerkleWitness, Field } from 'o1js';

// Create witness class for tree height
class MyWitness extends MerkleWitness(8) {} // 2^8 = 256 leaves

// In your contract
@state(Field) root = State<Field>();

@method async update(
  witness: MyWitness,
  oldValue: Field,
  newValue: Field
) {
  // Verify old value was in tree
  const oldRoot = witness.calculateRoot(oldValue);
  this.root.requireEquals(oldRoot);

  // Update to new value
  const newRoot = witness.calculateRoot(newValue);
  this.root.set(newRoot);
}
\`\`\`

**Common use cases:**
- Token balances (like rollups)
- Allowlists/blocklists
- Voting eligibility
- Any large dataset verification`
  }
};

export async function explainConcept(
  args: ExplainConceptArgs,
  context: ToolContext
) {
  const normalizedConcept = args.concept.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Check glossary first
  const glossaryEntry = CONCEPT_GLOSSARY[normalizedConcept];
  if (glossaryEntry) {
    const explanation = args.depth === 'detailed'
      ? glossaryEntry.detailed
      : glossaryEntry.brief;

    // Also search for related documentation
    const related = await context.search.search(args.concept, {
      limit: 3,
      contentType: 'prose'
    });

    return {
      content: [{
        type: 'text' as const,
        text: [
          `# ${args.concept}`,
          '',
          explanation,
          '',
          related.length > 0 ? [
            '## Learn More',
            '',
            ...related.map(r => `- [${r.chunk.title} - ${r.chunk.section}](${r.chunk.url})`)
          ].join('\n') : ''
        ].join('\n')
      }]
    };
  }

  // Search documentation for the concept
  const results = await context.search.search(
    `what is ${args.concept} definition explanation`,
    { limit: args.depth === 'detailed' ? 5 : 3 }
  );

  if (results.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: `No explanation found for "${args.concept}". This might not be a Mina-specific concept, or try different keywords. You can also try \`search_documentation\` for broader results.`
      }]
    };
  }

  const sections = results.map(r => {
    if (r.chunk.contentType === 'code') {
      return '```' + (r.chunk.metadata.codeLanguage || 'typescript') + '\n' + r.chunk.content + '\n```';
    }
    return r.chunk.content;
  }).join('\n\n---\n\n');

  const sources = results.map(r => `- [${r.chunk.title} - ${r.chunk.section}](${r.chunk.url})`);

  return {
    content: [{
      type: 'text' as const,
      text: [
        `# ${args.concept}`,
        '',
        sections,
        '',
        '## Sources',
        ...sources
      ].join('\n')
    }]
  };
}
