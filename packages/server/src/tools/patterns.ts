import { z } from 'zod';
import type { ToolContext } from './index.js';

export const GetPatternSchema = z.object({
  task: z.string().describe('Task or pattern to find (e.g., "merkle membership proof", "emit events", "deploy contract")'),
  includeVariations: z.boolean().optional().default(true).describe('Include alternative approaches and variations')
});

type GetPatternArgs = z.infer<typeof GetPatternSchema>;

interface Pattern {
  name: string;
  description: string;
  whenToUse: string[];
  code: string;
  explanation: string;
  pitfalls: string[];
  relatedPatterns?: string[];
  documentation?: string;
}

// Comprehensive pattern database
const PATTERNS: Record<string, Pattern> = {
  // CONTRACT BASICS
  'basic-contract': {
    name: 'Basic Smart Contract',
    description: 'Minimal zkApp contract with state and methods',
    whenToUse: [
      'Starting a new zkApp',
      'Simple on-chain state management',
      'Learning o1js fundamentals'
    ],
    code: `import { SmartContract, state, State, method, Field, PublicKey } from 'o1js';

class MyContract extends SmartContract {
  @state(Field) value = State<Field>();

  init() {
    super.init();
    this.value.set(Field(0));
  }

  @method async update(newValue: Field) {
    // Get current state and require it hasn't changed
    const currentValue = this.value.getAndRequireEquals();

    // Update state
    this.value.set(newValue);
  }
}`,
    explanation: `Key points:
- @state decorator for on-chain storage (max 8 Fields total)
- init() must call super.init() and initialize all state
- @method makes functions provable (creates circuit constraints)
- getAndRequireEquals() ensures state hasn't changed between reads`,
    pitfalls: [
      'Forgetting super.init() in init()',
      'Using .get() instead of .getAndRequireEquals() (state can change)',
      'Exceeding 8 Field state limit',
      'Not compiling before deployment'
    ],
    relatedPatterns: ['deploy-contract', 'state-management', 'emit-events'],
    documentation: 'https://docs.minaprotocol.com/zkapps/writing-a-zkapp'
  },

  'deploy-contract': {
    name: 'Deploy Contract',
    description: 'Full deployment flow for a zkApp',
    whenToUse: [
      'Deploying a new zkApp',
      'Setting up test environment',
      'First-time deployment to network'
    ],
    code: `import { Mina, PrivateKey, PublicKey, AccountUpdate, fetchAccount } from 'o1js';

// 1. Setup network (use LocalBlockchain for testing)
const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
Mina.setActiveInstance(Local);

// For real network:
// const network = Mina.Network('https://api.minascan.io/node/devnet/v1/graphql');
// Mina.setActiveInstance(network);

// 2. Setup accounts
const deployerKey = Local.testAccounts[0].key;
const deployerAccount = deployerKey.toPublicKey();

const zkAppKey = PrivateKey.random();
const zkAppAddress = zkAppKey.toPublicKey();

// 3. Compile contract (REQUIRED before deployment)
console.log('Compiling...');
await MyContract.compile();

// 4. Create contract instance
const zkApp = new MyContract(zkAppAddress);

// 5. Deploy transaction
const deployTx = await Mina.transaction(deployerAccount, async () => {
  // Fund the new account (required for new addresses)
  AccountUpdate.fundNewAccount(deployerAccount);
  await zkApp.deploy();
});

// 6. Prove and sign
await deployTx.prove();
await deployTx.sign([deployerKey, zkAppKey]).send();

console.log('Deployed to:', zkAppAddress.toBase58());`,
    explanation: `Deployment requires:
1. Network setup (Local for testing, Network for real)
2. Compilation generates verification key
3. AccountUpdate.fundNewAccount() pays 1 MINA account creation fee
4. Both deployer AND zkApp keys must sign
5. prove() generates the zero-knowledge proof`,
    pitfalls: [
      'Forgetting to compile() before deploy',
      'Missing AccountUpdate.fundNewAccount()',
      'Not signing with both deployer and zkApp keys',
      'Insufficient balance for fees (need ~1.1 MINA)',
      'Not awaiting prove() before send()'
    ],
    relatedPatterns: ['basic-contract', 'test-contract', 'interact-contract'],
    documentation: 'https://docs.minaprotocol.com/zkapps/tutorials/deploying-to-a-network'
  },

  'interact-contract': {
    name: 'Interact with Deployed Contract',
    description: 'Call methods on an already-deployed zkApp',
    whenToUse: [
      'Calling contract methods after deployment',
      'Updating contract state',
      'Production interactions'
    ],
    code: `import { Mina, PublicKey, PrivateKey, fetchAccount } from 'o1js';

// 1. Connect to network
const network = Mina.Network('https://api.minascan.io/node/devnet/v1/graphql');
Mina.setActiveInstance(network);

// 2. Setup addresses
const zkAppAddress = PublicKey.fromBase58('B62q...');
const senderKey = PrivateKey.fromBase58(process.env.PRIVATE_KEY!);
const senderAddress = senderKey.toPublicKey();

// 3. Fetch latest account state (CRITICAL for deployed contracts)
await fetchAccount({ publicKey: zkAppAddress });
await fetchAccount({ publicKey: senderAddress });

// 4. Compile contract (needed for proving)
await MyContract.compile();

// 5. Create contract instance
const zkApp = new MyContract(zkAppAddress);

// 6. Create and send transaction
const tx = await Mina.transaction(
  { sender: senderAddress, fee: 0.1e9 }, // 0.1 MINA fee
  async () => {
    await zkApp.update(Field(42));
  }
);

await tx.prove();
const sentTx = await tx.sign([senderKey]).send();

// 7. Wait for confirmation
if (sentTx.status === 'pending') {
  console.log('Tx hash:', sentTx.hash);
  await sentTx.wait();
  console.log('Transaction confirmed!');
}`,
    explanation: `For deployed contracts:
- fetchAccount() syncs on-chain state to local
- Must compile() even for existing contracts (for proving)
- Specify fee in transaction options
- Only sender key needed (not zkApp key) for method calls
- Use .wait() to wait for block confirmation`,
    pitfalls: [
      'Not calling fetchAccount() - will use stale state',
      'Forgetting to compile() - cannot prove',
      'Wrong network endpoint',
      'Insufficient fee for network congestion'
    ],
    relatedPatterns: ['deploy-contract', 'read-state'],
    documentation: 'https://docs.minaprotocol.com/zkapps/tutorials/interacting-with-zkApps-server-side'
  },

  // STATE PATTERNS
  'state-management': {
    name: 'State Management Patterns',
    description: 'Different ways to handle on-chain state',
    whenToUse: [
      'Complex state structures',
      'Multiple state fields',
      'Conditional state updates'
    ],
    code: `import { SmartContract, state, State, method, Field, Bool, Struct, Poseidon } from 'o1js';

// Pattern 1: Multiple state fields
class MultiStateContract extends SmartContract {
  @state(Field) counter = State<Field>();
  @state(Field) owner = State<Field>(); // Store hash of PublicKey
  @state(Bool) isActive = State<Bool>();

  init() {
    super.init();
    this.counter.set(Field(0));
    this.owner.set(Poseidon.hash(this.sender.getAndRequireSignature().toFields()));
    this.isActive.set(Bool(true));
  }
}

// Pattern 2: Struct for complex state (uses multiple Field slots)
class GameState extends Struct({
  player1Score: Field,
  player2Score: Field,
  currentRound: Field,
  isFinished: Bool
}) {}

class GameContract extends SmartContract {
  // This uses 4 Fields of the 8 available
  @state(GameState) gameState = State<GameState>();

  init() {
    super.init();
    this.gameState.set(new GameState({
      player1Score: Field(0),
      player2Score: Field(0),
      currentRound: Field(1),
      isFinished: Bool(false)
    }));
  }

  @method async updateScore(player1Delta: Field, player2Delta: Field) {
    const state = this.gameState.getAndRequireEquals();

    // Ensure game not finished
    state.isFinished.assertFalse('Game is finished');

    this.gameState.set(new GameState({
      player1Score: state.player1Score.add(player1Delta),
      player2Score: state.player2Score.add(player2Delta),
      currentRound: state.currentRound.add(1),
      isFinished: state.isFinished
    }));
  }
}

// Pattern 3: Merkle root for large state
class LargeStateContract extends SmartContract {
  @state(Field) merkleRoot = State<Field>();
  // Store large data off-chain, only root on-chain
}`,
    explanation: `State strategies:
- Simple fields for basic values
- Structs bundle related data (count Fields used!)
- Merkle roots for unlimited off-chain data
- Each @state uses 1+ Fields (max 8 total)
- Use getAndRequireEquals() for atomic read-modify-write`,
    pitfalls: [
      'Exceeding 8 Field limit (Structs count their fields!)',
      'Forgetting Bool takes 1 Field',
      'Not using getAndRequireEquals() for updates'
    ],
    relatedPatterns: ['merkle-membership', 'merkle-map'],
    documentation: 'https://docs.minaprotocol.com/zkapps/o1js/smart-contracts#on-chain-state'
  },

  // MERKLE PATTERNS
  'merkle-membership': {
    name: 'Merkle Tree Membership Proof',
    description: 'Prove an element exists in a set without revealing the full set',
    whenToUse: [
      'Whitelist/allowlist verification',
      'Proving ownership in a set',
      'Privacy-preserving membership',
      'Voting eligibility'
    ],
    code: `import { SmartContract, state, State, method, Field, MerkleTree, MerkleWitness, Poseidon } from 'o1js';

// Define witness class with tree height (8 = 256 leaves)
const TREE_HEIGHT = 8;
class MyMerkleWitness extends MerkleWitness(TREE_HEIGHT) {}

class MembershipContract extends SmartContract {
  @state(Field) merkleRoot = State<Field>();

  init() {
    super.init();
    // Initialize with empty tree root
    const emptyTree = new MerkleTree(TREE_HEIGHT);
    this.merkleRoot.set(emptyTree.getRoot());
  }

  @method async verifyMembership(
    value: Field,           // The value to prove membership of
    witness: MyMerkleWitness // The merkle proof
  ) {
    const root = this.merkleRoot.getAndRequireEquals();

    // Hash the value (leaf = hash of value)
    const leaf = Poseidon.hash([value]);

    // Calculate root from witness and leaf
    const calculatedRoot = witness.calculateRoot(leaf);

    // Assert it matches stored root
    calculatedRoot.assertEquals(root, 'Invalid membership proof');
  }

  @method async updateRoot(newRoot: Field) {
    // Only update root (actual tree managed off-chain)
    this.merkleRoot.set(newRoot);
  }
}

// OFF-CHAIN: Building and managing the tree
const tree = new MerkleTree(TREE_HEIGHT);

// Add members
const member1 = Field(12345);
tree.setLeaf(0n, Poseidon.hash([member1]));

const member2 = Field(67890);
tree.setLeaf(1n, Poseidon.hash([member2]));

// Get proof for member1
const witness = new MyMerkleWitness(tree.getWitness(0n));

// Use in transaction
const tx = await Mina.transaction(sender, async () => {
  await zkApp.verifyMembership(member1, witness);
});`,
    explanation: `How it works:
1. Off-chain: Maintain full Merkle tree with all members
2. On-chain: Store only the root (1 Field)
3. Proof: Witness shows path from leaf to root
4. Verification: Recalculate root from leaf + witness, compare

Tree size: height 8 = 256 leaves, height 20 = 1M leaves`,
    pitfalls: [
      'Forgetting to hash values before adding to tree',
      'Using wrong tree height in witness class',
      'Not keeping off-chain tree in sync with on-chain root',
      'Index mismatch between tree and witness'
    ],
    relatedPatterns: ['merkle-map', 'merkle-update'],
    documentation: 'https://docs.minaprotocol.com/zkapps/o1js/merkle-tree'
  },

  'merkle-map': {
    name: 'Merkle Map Key-Value Store',
    description: 'Store key-value pairs with on-chain root',
    whenToUse: [
      'User balances/scores',
      'Key-value lookups with proof',
      'Sparse data structures'
    ],
    code: `import { SmartContract, state, State, method, Field, MerkleMap, MerkleMapWitness, Poseidon, PublicKey } from 'o1js';

class BalanceContract extends SmartContract {
  @state(Field) mapRoot = State<Field>();

  init() {
    super.init();
    const emptyMap = new MerkleMap();
    this.mapRoot.set(emptyMap.getRoot());
  }

  @method async getBalance(
    userKey: Field,
    currentBalance: Field,
    witness: MerkleMapWitness
  ) {
    const root = this.mapRoot.getAndRequireEquals();

    // Verify the claimed balance is correct
    const [computedRoot, computedKey] = witness.computeRootAndKey(currentBalance);
    computedRoot.assertEquals(root, 'Invalid proof');
    computedKey.assertEquals(userKey, 'Key mismatch');

    // Now we know currentBalance is the real balance for userKey
    return currentBalance;
  }

  @method async updateBalance(
    userKey: Field,
    oldBalance: Field,
    newBalance: Field,
    witness: MerkleMapWitness
  ) {
    const root = this.mapRoot.getAndRequireEquals();

    // Verify old balance is correct
    const [oldRoot, key] = witness.computeRootAndKey(oldBalance);
    oldRoot.assertEquals(root, 'Invalid old balance proof');
    key.assertEquals(userKey, 'Key mismatch');

    // Compute new root with updated balance
    const [newRoot, _] = witness.computeRootAndKey(newBalance);

    this.mapRoot.set(newRoot);
  }
}

// OFF-CHAIN usage
const map = new MerkleMap();

// Use PublicKey hash as key
const userPubKey = PublicKey.fromBase58('B62q...');
const userKey = Poseidon.hash(userPubKey.toFields());

// Set initial balance
map.set(userKey, Field(100));

// Get witness for update
const witness = map.getWitness(userKey);
const oldBalance = map.get(userKey);

// Update balance
map.set(userKey, Field(150));`,
    explanation: `MerkleMap is simpler than MerkleTree for key-value:
- Keys and values are both Fields
- Automatically handles hashing internally
- computeRootAndKey() returns both root and verified key
- Same witness can compute root for old AND new values`,
    pitfalls: [
      'Key must be a Field (hash PublicKeys/strings first)',
      'Default value is Field(0) for unset keys',
      'Must verify both root AND key match',
      'Keep off-chain map synchronized'
    ],
    relatedPatterns: ['merkle-membership', 'state-management'],
    documentation: 'https://docs.minaprotocol.com/zkapps/o1js/merkle-tree#merkle-map'
  },

  // CONDITIONALS & CONTROL FLOW
  'conditional-logic': {
    name: 'Conditional Logic in Circuits',
    description: 'Handle if/else without JavaScript conditionals',
    whenToUse: [
      'Branching logic in @method',
      'Conditional state updates',
      'Multiple cases/options'
    ],
    code: `import { SmartContract, method, Field, Bool, Provable } from 'o1js';

class ConditionalContract extends SmartContract {
  @method async conditionalExample(
    condition: Bool,
    valueA: Field,
    valueB: Field
  ) {
    // Pattern 1: Simple if-else with Provable.if
    const result = Provable.if(condition, valueA, valueB);

    // Pattern 2: Nested conditions
    const isPositive = valueA.greaterThan(0);
    const isLarge = valueA.greaterThan(100);

    const category = Provable.if(
      isLarge,
      Field(2),  // large
      Provable.if(
        isPositive,
        Field(1), // positive but not large
        Field(0)  // zero or negative
      )
    );

    // Pattern 3: Switch with multiple conditions
    const isCase1 = valueA.equals(1);
    const isCase2 = valueA.equals(2);
    const isCase3 = valueA.equals(3);

    const switchResult = Provable.switch(
      [isCase1, isCase2, isCase3],
      Field,
      [Field(100), Field(200), Field(300)]
    );
    // Note: Exactly one condition should be true!

    // Pattern 4: Conditional assertion
    const shouldValidate = condition;
    // This assertion only "matters" when shouldValidate is true
    valueA.assertGreaterThan(0);

    // Pattern 5: Conditional update (both branches execute!)
    const newValue = Provable.if(
      condition,
      valueA.add(1),  // Both this...
      valueB.mul(2)   // ...and this are computed
    );

    return result;
  }
}

// IMPORTANT: What NOT to do
class WrongConditional extends SmartContract {
  @method async wrongExample(flag: Bool, value: Field) {
    // ❌ WRONG - JavaScript if doesn't work in circuits
    // if (flag.toBoolean()) {
    //   value.assertEquals(42);
    // }

    // ✅ RIGHT - Use Provable.if for conditional values
    const checked = Provable.if(flag, value, Field(42));
    checked.assertEquals(Field(42));
  }
}`,
    explanation: `Circuit constraints are always evaluated:
- Both branches of Provable.if() are computed
- Condition only selects which result to use
- Cannot skip computation based on condition
- Provable.switch needs exactly one true condition`,
    pitfalls: [
      'Using JavaScript if/else (not provable)',
      'Thinking branches are "skipped" (they\'re not)',
      'Provable.switch with no true condition (undefined)',
      'Expensive operations in both branches'
    ],
    relatedPatterns: ['basic-contract', 'state-management'],
    documentation: 'https://docs.minaprotocol.com/zkapps/o1js/basic-concepts#conditional-logic'
  },

  // EVENTS
  'emit-events': {
    name: 'Emit and Fetch Events',
    description: 'Emit events for off-chain indexing and history',
    whenToUse: [
      'Recording transaction history',
      'Off-chain indexing',
      'Notifying external systems',
      'Audit trails'
    ],
    code: `import { SmartContract, state, State, method, Field, PublicKey, Struct } from 'o1js';

// Define event types as Structs
class TransferEvent extends Struct({
  from: PublicKey,
  to: PublicKey,
  amount: Field
}) {}

class EventContract extends SmartContract {
  // Declare event types
  events = {
    'transfer': TransferEvent,
    'update': Field,
    'simple': Field  // Simple events are just Field
  };

  @state(Field) balance = State<Field>();

  @method async transfer(to: PublicKey, amount: Field) {
    const from = this.sender.getAndRequireSignature();

    // ... transfer logic ...

    // Emit structured event
    this.emitEvent('transfer', new TransferEvent({
      from,
      to,
      amount
    }));
  }

  @method async update(newValue: Field) {
    this.balance.set(newValue);

    // Emit simple event
    this.emitEvent('update', newValue);
  }
}

// FETCHING EVENTS (off-chain)
async function fetchEvents() {
  const zkApp = new EventContract(zkAppAddress);

  // Fetch all events
  const events = await zkApp.fetchEvents();

  // Process events
  for (const event of events) {
    console.log('Event type:', event.type);
    console.log('Event data:', event.event.toJSON());
    console.log('Block height:', event.blockHeight);
  }

  // Fetch events in range
  const recentEvents = await zkApp.fetchEvents(
    UInt32.from(1000),  // from block
    UInt32.from(2000)   // to block
  );
}`,
    explanation: `Events are stored in archive nodes:
- Emitted during transaction execution
- Cannot be read on-chain (only emitted)
- Fetched via archive node API
- Great for building off-chain indexes`,
    pitfalls: [
      'Events can\'t be read in contracts (emit only)',
      'Archive nodes required for fetching',
      'Event order not guaranteed within block',
      'Events are not part of proof (just metadata)'
    ],
    relatedPatterns: ['basic-contract', 'state-management'],
    documentation: 'https://docs.minaprotocol.com/zkapps/o1js/events'
  },

  // SIGNATURES
  'signature-verification': {
    name: 'Signature Verification',
    description: 'Verify signatures in zkApp methods',
    whenToUse: [
      'Requiring user authorization',
      'Validating off-chain signatures',
      'Multi-sig patterns'
    ],
    code: `import { SmartContract, method, Field, PublicKey, Signature, Poseidon } from 'o1js';

class SignatureContract extends SmartContract {
  // Pattern 1: Require sender signature (most common)
  @method async requireSenderSig(value: Field) {
    // This requires the transaction sender to sign
    const sender = this.sender.getAndRequireSignature();

    // Now we know sender authorized this call
    // ... do something with value ...
  }

  // Pattern 2: Verify arbitrary signature on message
  @method async verifyCustomSignature(
    message: Field,
    signature: Signature,
    expectedSigner: PublicKey
  ) {
    // Verify signature on the message
    const isValid = signature.verify(expectedSigner, [message]);
    isValid.assertTrue('Invalid signature');
  }

  // Pattern 3: Verify signature on multiple fields
  @method async verifyMultiFieldMessage(
    field1: Field,
    field2: Field,
    field3: Field,
    signature: Signature,
    signer: PublicKey
  ) {
    // Message is array of Fields
    const message = [field1, field2, field3];
    signature.verify(signer, message).assertTrue('Invalid signature');
  }

  // Pattern 4: Admin-only function
  @state(PublicKey) admin = State<PublicKey>();

  @method async adminOnly(newValue: Field) {
    const admin = this.admin.getAndRequireEquals();
    const sender = this.sender.getAndRequireSignature();

    // Verify sender is admin
    sender.assertEquals(admin, 'Not admin');

    // ... admin action ...
  }
}

// OFF-CHAIN: Creating signatures
const privateKey = PrivateKey.random();
const publicKey = privateKey.toPublicKey();

// Sign a message
const message = [Field(1), Field(2), Field(3)];
const signature = Signature.create(privateKey, message);

// Use in transaction
const tx = await Mina.transaction(sender, async () => {
  await zkApp.verifyCustomSignature(Field(1), signature, publicKey);
});`,
    explanation: `Signature patterns:
- getAndRequireSignature() - easiest, requires tx sender to sign
- Signature.verify() - verify any signature on any message
- Message must be Field[] (hash complex data with Poseidon)`,
    pitfalls: [
      'Message must be exactly the same for sign and verify',
      'Don\'t forget signature is on Field[], not single Field',
      'getAndRequireSignature() only works for sender'
    ],
    relatedPatterns: ['basic-contract', 'access-control'],
    documentation: 'https://docs.minaprotocol.com/zkapps/o1js/basic-concepts#public-key-and-signatures'
  },

  // TESTING
  'test-contract': {
    name: 'Testing zkApp Contracts',
    description: 'Set up and run contract tests',
    whenToUse: [
      'Unit testing contract logic',
      'Integration testing',
      'Development workflow'
    ],
    code: `import { Mina, PrivateKey, PublicKey, AccountUpdate, Field } from 'o1js';

describe('MyContract', () => {
  let deployerKey: PrivateKey;
  let deployerAccount: PublicKey;
  let zkAppKey: PrivateKey;
  let zkAppAddress: PublicKey;
  let zkApp: MyContract;

  beforeAll(async () => {
    // Compile once for all tests
    await MyContract.compile();
  });

  beforeEach(async () => {
    // Fresh local blockchain for each test
    const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);

    // Setup accounts
    deployerKey = Local.testAccounts[0].key;
    deployerAccount = deployerKey.toPublicKey();

    zkAppKey = PrivateKey.random();
    zkAppAddress = zkAppKey.toPublicKey();
    zkApp = new MyContract(zkAppAddress);

    // Deploy
    const tx = await Mina.transaction(deployerAccount, async () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      await zkApp.deploy();
    });
    await tx.prove();
    await tx.sign([deployerKey, zkAppKey]).send();
  });

  it('should initialize with correct state', async () => {
    const value = zkApp.value.get();
    expect(value).toEqual(Field(0));
  });

  it('should update state', async () => {
    const tx = await Mina.transaction(deployerAccount, async () => {
      await zkApp.update(Field(42));
    });
    await tx.prove();
    await tx.sign([deployerKey]).send();

    const value = zkApp.value.get();
    expect(value).toEqual(Field(42));
  });

  it('should reject invalid input', async () => {
    await expect(async () => {
      const tx = await Mina.transaction(deployerAccount, async () => {
        await zkApp.restrictedMethod(Field(-1)); // Assuming this should fail
      });
      await tx.prove();
    }).rejects.toThrow();
  });
});

// Quick test without framework
async function quickTest() {
  const Local = await Mina.LocalBlockchain({ proofsEnabled: false }); // Faster!
  Mina.setActiveInstance(Local);

  // ... test code ...

  console.log('Test passed!');
}`,
    explanation: `Testing tips:
- proofsEnabled: false for fast iteration (no proofs generated)
- proofsEnabled: true for full testing (slower but realistic)
- compile() once in beforeAll, not each test
- Each test gets fresh LocalBlockchain
- Test both success and failure cases`,
    pitfalls: [
      'Forgetting to await async operations',
      'proofsEnabled: true is much slower',
      'Not testing failure cases',
      'Sharing state between tests'
    ],
    relatedPatterns: ['deploy-contract', 'basic-contract'],
    documentation: 'https://docs.minaprotocol.com/zkapps/testing-zkapps-locally'
  },

  // ZKPROGRAM
  'zkprogram-basic': {
    name: 'Basic ZkProgram',
    description: 'Create standalone zero-knowledge programs',
    whenToUse: [
      'Computation without contract',
      'Recursive proofs',
      'Off-chain proving',
      'Proof composition'
    ],
    code: `import { ZkProgram, Field, SelfProof, Proof, verify } from 'o1js';

// Define a ZkProgram
const AddProgram = ZkProgram({
  name: 'add-program',
  publicInput: Field,  // What verifier sees
  publicOutput: Field, // What program outputs

  methods: {
    // Base case - no previous proof needed
    init: {
      privateInputs: [],
      async method(publicInput: Field) {
        return publicInput;
      }
    },

    // Recursive case - takes previous proof
    addOne: {
      privateInputs: [SelfProof],
      async method(
        publicInput: Field,
        previousProof: SelfProof<Field, Field>
      ) {
        // Verify the previous proof
        previousProof.verify();

        // Check public input matches previous output
        previousProof.publicOutput.assertEquals(publicInput);

        // Return incremented value
        return publicInput.add(1);
      }
    }
  }
});

// USAGE
async function runZkProgram() {
  // Compile the program
  await AddProgram.compile();

  // Create initial proof
  const proof0 = await AddProgram.init(Field(0));
  console.log('Initial output:', proof0.publicOutput.toString()); // 0

  // Chain proofs
  const proof1 = await AddProgram.addOne(Field(0), proof0);
  console.log('After addOne:', proof1.publicOutput.toString()); // 1

  const proof2 = await AddProgram.addOne(Field(1), proof1);
  console.log('After addOne:', proof2.publicOutput.toString()); // 2

  // Verify a proof
  const isValid = await verify(proof2, AddProgram.Proof);
  console.log('Proof valid:', isValid);
}`,
    explanation: `ZkProgram vs SmartContract:
- ZkProgram: Standalone proofs, no on-chain state
- Can be recursive (prove chains of computation)
- Proofs can be verified in SmartContracts
- Great for rollups, computation delegation`,
    pitfalls: [
      'Must call compile() before generating proofs',
      'SelfProof.verify() is required for recursion',
      'Public inputs must match between proofs',
      'Compilation is slow for complex programs'
    ],
    relatedPatterns: ['basic-contract', 'recursive-proofs'],
    documentation: 'https://docs.minaprotocol.com/zkapps/o1js/recursion'
  },

  // ACTIONS/REDUCER
  'reducer-pattern': {
    name: 'Actions and Reducer Pattern',
    description: 'Batch process off-chain actions',
    whenToUse: [
      'High-frequency updates',
      'Batch processing',
      'When single tx can\'t handle volume',
      'Aggregating user actions'
    ],
    code: `import { SmartContract, state, State, method, Field, Reducer, Struct } from 'o1js';

// Action type
class VoteAction extends Struct({
  optionId: Field,
  weight: Field
}) {}

class VotingContract extends SmartContract {
  @state(Field) totalVotes = State<Field>();
  @state(Field) actionsHash = State<Field>();

  reducer = Reducer({ actionType: VoteAction });

  init() {
    super.init();
    this.totalVotes.set(Field(0));
    this.actionsHash.set(Reducer.initialActionState);
  }

  // Anyone can dispatch an action (adds to pending queue)
  @method async vote(optionId: Field, weight: Field) {
    this.reducer.dispatch(new VoteAction({ optionId, weight }));
  }

  // Process pending actions (can be called by anyone)
  @method async rollupVotes() {
    const actionsHash = this.actionsHash.getAndRequireEquals();
    const currentTotal = this.totalVotes.getAndRequireEquals();

    // Reduce all pending actions
    const { state: newTotal, actionsHash: newActionsHash } =
      this.reducer.reduce(
        this.reducer.getActions({ fromActionState: actionsHash }),
        Field,
        (state: Field, action: VoteAction) => {
          return state.add(action.weight);
        },
        currentTotal
      );

    this.totalVotes.set(newTotal);
    this.actionsHash.set(newActionsHash);
  }
}`,
    explanation: `Reducer pattern:
1. dispatch() - add action to pending queue (cheap)
2. Actions stored in action state (off-chain)
3. reduce() - process batch of actions in one proof
4. Useful when many users submit actions between rollups`,
    pitfalls: [
      'Actions expire after ~20 blocks if not processed',
      'Reducer has max actions per reduce call',
      'State must be deterministic regardless of action order',
      'More complex than simple state updates'
    ],
    relatedPatterns: ['state-management', 'emit-events'],
    documentation: 'https://docs.minaprotocol.com/zkapps/o1js/actions-and-reducer'
  }
};

// Pattern aliases for search
const PATTERN_ALIASES: Record<string, string[]> = {
  'basic-contract': ['contract', 'smartcontract', 'zkapp', 'basic', 'simple', 'starter'],
  'deploy-contract': ['deploy', 'deployment', 'publish'],
  'interact-contract': ['interact', 'call', 'invoke', 'use', 'transaction'],
  'state-management': ['state', 'storage', 'store', 'data'],
  'merkle-membership': ['merkle', 'membership', 'proof', 'whitelist', 'allowlist', 'set'],
  'merkle-map': ['map', 'key-value', 'kv', 'balance', 'mapping'],
  'conditional-logic': ['if', 'else', 'condition', 'conditional', 'switch', 'branch'],
  'emit-events': ['event', 'emit', 'log', 'history'],
  'signature-verification': ['signature', 'sign', 'verify', 'auth', 'authorize'],
  'test-contract': ['test', 'testing', 'jest', 'unit'],
  'zkprogram-basic': ['zkprogram', 'program', 'recursive', 'recursion', 'proof'],
  'reducer-pattern': ['reducer', 'action', 'batch', 'rollup', 'queue']
};

export async function getPattern(
  args: GetPatternArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const searchTerm = args.task.toLowerCase().replace(/[^a-z0-9\s]/g, '');

  // Find matching pattern
  let matchedPatternKey: string | null = null;
  let matchScore = 0;

  for (const [key, aliases] of Object.entries(PATTERN_ALIASES)) {
    // Check direct key match
    if (searchTerm.includes(key.replace('-', ' ')) || searchTerm.includes(key.replace('-', ''))) {
      matchedPatternKey = key;
      matchScore = 100;
      break;
    }

    // Check aliases
    for (const alias of aliases) {
      if (searchTerm.includes(alias)) {
        const score = alias.length;
        if (score > matchScore) {
          matchScore = score;
          matchedPatternKey = key;
        }
      }
    }
  }

  if (!matchedPatternKey || !PATTERNS[matchedPatternKey]) {
    // Search documentation as fallback
    const results = await context.search.search(`${args.task} pattern example`, { limit: 3 });

    const sections = [
      `# Pattern: ${args.task}`,
      '',
      'No exact pattern match found.',
      '',
      '**Available patterns:**',
      ...Object.entries(PATTERNS).map(([key, p]) => `- \`${key}\`: ${p.description}`)
    ];

    if (results.length > 0) {
      sections.push('', '## Related Documentation', '');
      for (const r of results) {
        sections.push(`- [${r.chunk.title}](${r.chunk.url})`);
      }
    }

    return {
      content: [{ type: 'text', text: sections.join('\n') }]
    };
  }

  const pattern = PATTERNS[matchedPatternKey];
  const sections: string[] = [
    `# ${pattern.name}`,
    '',
    pattern.description,
    '',
    '## When to Use',
    '',
    ...pattern.whenToUse.map(u => `- ${u}`),
    '',
    '## Code',
    '',
    '```typescript',
    pattern.code,
    '```',
    '',
    '## Explanation',
    '',
    pattern.explanation,
    '',
    '## Common Pitfalls',
    '',
    ...pattern.pitfalls.map(p => `- ⚠️ ${p}`)
  ];

  if (pattern.documentation) {
    sections.push('', `📖 [Documentation](${pattern.documentation})`);
  }

  if (args.includeVariations && pattern.relatedPatterns) {
    sections.push(
      '',
      '## Related Patterns',
      ''
    );

    for (const relatedKey of pattern.relatedPatterns) {
      const related = PATTERNS[relatedKey];
      if (related) {
        sections.push(`### ${related.name}`, '', related.description, '');
      }
    }
  }

  return {
    content: [{ type: 'text', text: sections.join('\n') }]
  };
}
