import { z } from 'zod';
import type { ToolContext } from './index.js';

export const GetApiSignatureSchema = z.object({
  className: z.string().describe('Class name (e.g., "Field", "SmartContract", "MerkleTree")'),
  methodName: z.string().optional().describe('Specific method name (optional - omit to get class overview)')
});

type GetApiSignatureArgs = z.infer<typeof GetApiSignatureSchema>;

// Comprehensive o1js API signatures database
const API_SIGNATURES: Record<string, {
  description: string;
  extends?: string;
  import: string;
  constructors?: Array<{ signature: string; description: string; example?: string }>;
  staticMethods?: Record<string, { signature: string; description: string; example?: string }>;
  instanceMethods?: Record<string, { signature: string; description: string; example?: string }>;
  properties?: Record<string, { type: string; description: string }>;
  decorators?: Record<string, { usage: string; description: string }>;
}> = {
  'Field': {
    description: 'The fundamental type in o1js representing an element of the finite field. All zkApp computation operates on Fields.',
    import: "import { Field } from 'o1js';",
    constructors: [
      { signature: 'new Field(value: number | bigint | string | Field)', description: 'Create a Field from a number, bigint, string, or another Field' },
      { signature: 'Field(value: number | bigint | string | Field)', description: 'Shorthand constructor (recommended)' }
    ],
    staticMethods: {
      'from': { signature: 'Field.from(value: number | bigint | string | Field): Field', description: 'Create a Field from various types' },
      'random': { signature: 'Field.random(): Field', description: 'Generate a random Field element (NOT provable - use only outside circuits)' },
      'fromBytes': { signature: 'Field.fromBytes(bytes: number[]): Field', description: 'Create Field from byte array' },
      'toBytes': { signature: 'Field.toBytes(f: Field): number[]', description: 'Convert Field to bytes' },
      'sizeInFields': { signature: 'Field.sizeInFields(): number', description: 'Returns 1 (Fields take 1 field element)' },
      'fromFields': { signature: 'Field.fromFields(fields: Field[]): Field', description: 'Deserialize from field elements' },
      'toFields': { signature: 'Field.toFields(x: Field): Field[]', description: 'Serialize to field elements' },
      'check': { signature: 'Field.check(x: Field): void', description: 'Assert value is a valid Field' },
      'fromJSON': { signature: 'Field.fromJSON(json: string): Field', description: 'Deserialize from JSON string' },
      'toJSON': { signature: 'Field.toJSON(x: Field): string', description: 'Serialize to JSON string' }
    },
    instanceMethods: {
      'add': { signature: 'add(y: Field | bigint | number | string): Field', description: 'Add two Fields', example: 'const sum = x.add(y);' },
      'sub': { signature: 'sub(y: Field | bigint | number | string): Field', description: 'Subtract y from this Field', example: 'const diff = x.sub(y);' },
      'mul': { signature: 'mul(y: Field | bigint | number | string): Field', description: 'Multiply two Fields', example: 'const product = x.mul(y);' },
      'div': { signature: 'div(y: Field | bigint | number | string): Field', description: 'Divide this Field by y', example: 'const quotient = x.div(y);' },
      'neg': { signature: 'neg(): Field', description: 'Negate this Field', example: 'const negX = x.neg();' },
      'inv': { signature: 'inv(): Field', description: 'Multiplicative inverse (1/x)', example: 'const inverse = x.inv();' },
      'square': { signature: 'square(): Field', description: 'Square this Field (x * x)', example: 'const squared = x.square();' },
      'sqrt': { signature: 'sqrt(): Field', description: 'Square root (if it exists)', example: 'const root = x.sqrt();' },
      'equals': { signature: 'equals(y: Field | bigint | number | string): Bool', description: 'Check equality, returns Bool', example: 'const isEqual = x.equals(y);' },
      'assertEquals': { signature: 'assertEquals(y: Field | bigint | number | string, message?: string): void', description: 'Assert equality (fails proof if not equal)', example: 'x.assertEquals(y, "values must match");' },
      'assertNotEquals': { signature: 'assertNotEquals(y: Field | bigint | number | string, message?: string): void', description: 'Assert inequality', example: 'x.assertNotEquals(0);' },
      'isZero': { signature: 'isZero(): Bool', description: 'Check if Field is zero', example: 'const zero = x.isZero();' },
      'lessThan': { signature: 'lessThan(y: Field | bigint | number | string): Bool', description: 'Check if this < y', example: 'const lt = x.lessThan(y);' },
      'lessThanOrEqual': { signature: 'lessThanOrEqual(y: Field | bigint | number | string): Bool', description: 'Check if this <= y', example: 'const lte = x.lessThanOrEqual(y);' },
      'greaterThan': { signature: 'greaterThan(y: Field | bigint | number | string): Bool', description: 'Check if this > y', example: 'const gt = x.greaterThan(y);' },
      'greaterThanOrEqual': { signature: 'greaterThanOrEqual(y: Field | bigint | number | string): Bool', description: 'Check if this >= y', example: 'const gte = x.greaterThanOrEqual(y);' },
      'assertGreaterThan': { signature: 'assertGreaterThan(y: Field, message?: string): void', description: 'Assert this > y', example: 'x.assertGreaterThan(0);' },
      'assertGreaterThanOrEqual': { signature: 'assertGreaterThanOrEqual(y: Field, message?: string): void', description: 'Assert this >= y' },
      'assertLessThan': { signature: 'assertLessThan(y: Field, message?: string): void', description: 'Assert this < y' },
      'assertLessThanOrEqual': { signature: 'assertLessThanOrEqual(y: Field, message?: string): void', description: 'Assert this <= y' },
      'toBigInt': { signature: 'toBigInt(): bigint', description: 'Convert to bigint (NOT provable)', example: 'const big = x.toBigInt();' },
      'toString': { signature: 'toString(): string', description: 'Convert to string representation' },
      'toJSON': { signature: 'toJSON(): string', description: 'Convert to JSON string' },
      'toFields': { signature: 'toFields(): Field[]', description: 'Serialize to field array' },
      'toConstant': { signature: 'toConstant(): Field', description: 'Get constant value (fails if not constant)' },
      'toBits': { signature: 'toBits(length?: number): Bool[]', description: 'Convert to array of Bools (bits)', example: 'const bits = x.toBits(8);' },
      'toBoolean': { signature: 'toBoolean(): boolean', description: 'Convert to JS boolean (0 = false, else true)' },
      'isConstant': { signature: 'isConstant(): boolean', description: 'Check if this is a constant (known at compile time)' },
      'seal': { signature: 'seal(): Field', description: 'Seal the Field to prevent further constraints' }
    },
    properties: {
      'value': { type: 'bigint', description: 'The underlying bigint value (only available outside circuit)' }
    }
  },

  'Bool': {
    description: 'Provable boolean type. Use instead of JavaScript boolean in circuits.',
    import: "import { Bool } from 'o1js';",
    constructors: [
      { signature: 'new Bool(value: boolean | Bool)', description: 'Create a Bool from a boolean or another Bool' },
      { signature: 'Bool(value: boolean | Bool)', description: 'Shorthand constructor' }
    ],
    staticMethods: {
      'fromFields': { signature: 'Bool.fromFields(fields: Field[]): Bool', description: 'Deserialize from field elements' },
      'toFields': { signature: 'Bool.toFields(x: Bool): Field[]', description: 'Serialize to field elements' },
      'sizeInFields': { signature: 'Bool.sizeInFields(): number', description: 'Returns 1' },
      'check': { signature: 'Bool.check(x: Bool): void', description: 'Assert value is a valid Bool' },
      'fromJSON': { signature: 'Bool.fromJSON(b: boolean): Bool', description: 'Create from JSON boolean' },
      'toJSON': { signature: 'Bool.toJSON(x: Bool): boolean', description: 'Convert to JSON boolean' },
      'Unsafe': { signature: 'Bool.Unsafe.fromField(f: Field): Bool', description: 'Create Bool from Field without checking (dangerous!)' }
    },
    instanceMethods: {
      'and': { signature: 'and(y: Bool | boolean): Bool', description: 'Logical AND', example: 'const both = a.and(b);' },
      'or': { signature: 'or(y: Bool | boolean): Bool', description: 'Logical OR', example: 'const either = a.or(b);' },
      'not': { signature: 'not(): Bool', description: 'Logical NOT', example: 'const notA = a.not();' },
      'implies': { signature: 'implies(y: Bool): Bool', description: 'Logical implication (a → b)', example: 'const impl = a.implies(b);' },
      'equals': { signature: 'equals(y: Bool | boolean): Bool', description: 'Check equality' },
      'assertEquals': { signature: 'assertEquals(y: Bool | boolean, message?: string): void', description: 'Assert equality' },
      'assertTrue': { signature: 'assertTrue(message?: string): void', description: 'Assert this is true', example: 'isValid.assertTrue("must be valid");' },
      'assertFalse': { signature: 'assertFalse(message?: string): void', description: 'Assert this is false' },
      'toBoolean': { signature: 'toBoolean(): boolean', description: 'Convert to JS boolean (NOT provable)' },
      'toField': { signature: 'toField(): Field', description: 'Convert to Field (true=1, false=0)' },
      'toFields': { signature: 'toFields(): Field[]', description: 'Serialize to field array' },
      'toJSON': { signature: 'toJSON(): boolean', description: 'Convert to JSON' },
      'isConstant': { signature: 'isConstant(): boolean', description: 'Check if constant' }
    }
  },

  'SmartContract': {
    description: 'Base class for zkApp smart contracts. Extend this to create your own zkApp.',
    extends: 'SmartContract',
    import: "import { SmartContract, state, State, method } from 'o1js';",
    constructors: [
      { signature: 'constructor(address: PublicKey, tokenId?: Field)', description: 'Create contract instance at address' }
    ],
    staticMethods: {
      'compile': { signature: 'static async compile(): Promise<{ verificationKey: VerificationKey }>', description: 'Compile the contract (required before deployment)', example: 'const { verificationKey } = await MyContract.compile();' },
      'digest': { signature: 'static digest(): string', description: 'Get digest of contract code' },
      'analyzeMethods': { signature: 'static analyzeMethods(): Record<string, { rows: number; digest: string }>', description: 'Analyze constraint count of methods' }
    },
    instanceMethods: {
      'deploy': { signature: 'async deploy(): Promise<void>', description: 'Deploy the contract', example: 'await zkApp.deploy();' },
      'init': { signature: 'init(): void', description: 'Initialize contract state (override this)', example: 'init() { super.init(); this.myState.set(Field(0)); }' },
      'requireSignature': { signature: 'requireSignature(): void', description: 'Require sender signature for this transaction' },
      'emitEvent': { signature: 'emitEvent<K extends keyof Events>(type: K, event: Events[K]): void', description: 'Emit an event', example: 'this.emitEvent("update", newValue);' },
      'fetchEvents': { signature: 'async fetchEvents(start?: UInt32, end?: UInt32): Promise<{ type: string; event: any }[]>', description: 'Fetch emitted events' }
    },
    properties: {
      'address': { type: 'PublicKey', description: 'Contract address' },
      'tokenId': { type: 'Field', description: 'Token ID (default is MINA)' },
      'account': { type: 'Account', description: 'Account state accessor' },
      'network': { type: 'Network', description: 'Network state accessor' },
      'currentSlot': { type: 'CurrentSlot', description: 'Current slot accessor' },
      'sender': { type: 'PublicKey', description: 'Transaction sender (use inside @method)' },
      'self': { type: 'AccountUpdate', description: 'This contract\'s account update' }
    },
    decorators: {
      '@state': { usage: '@state(Field) myState = State<Field>();', description: 'Declare on-chain state (max 8 fields total)' },
      '@method': { usage: '@method async myMethod(arg: Field): Promise<void> { }', description: 'Declare a provable method' }
    }
  },

  'State': {
    description: 'Container for on-chain state in a SmartContract. Each state field takes 1 Field of storage.',
    import: "import { State, state } from 'o1js';",
    constructors: [
      { signature: 'State<T>()', description: 'Create a state container for type T' }
    ],
    instanceMethods: {
      'get': { signature: 'get(): T', description: 'Get current state value', example: 'const value = this.myState.get();' },
      'getAndRequireEquals': { signature: 'getAndRequireEquals(): T', description: 'Get state and assert it hasn\'t changed', example: 'const value = this.myState.getAndRequireEquals();' },
      'set': { signature: 'set(value: T): void', description: 'Set new state value', example: 'this.myState.set(Field(42));' },
      'requireEquals': { signature: 'requireEquals(value: T): void', description: 'Assert state equals value' },
      'requireNothing': { signature: 'requireNothing(): void', description: 'Don\'t make any assertion about state' }
    }
  },

  'Poseidon': {
    description: 'Poseidon hash function - the most efficient hash for zkApps. Produces a single Field output.',
    import: "import { Poseidon } from 'o1js';",
    staticMethods: {
      'hash': { signature: 'Poseidon.hash(input: Field[]): Field', description: 'Hash array of Fields to single Field', example: 'const hash = Poseidon.hash([a, b, c]);' },
      'hashWithPrefix': { signature: 'Poseidon.hashWithPrefix(prefix: string, input: Field[]): Field', description: 'Hash with domain separation prefix' },
      'hashToGroup': { signature: 'Poseidon.hashToGroup(input: Field[]): Group', description: 'Hash to elliptic curve point' },
      'Sponge': { signature: 'new Poseidon.Sponge(): PoseidonSponge', description: 'Create sponge for incremental hashing' }
    }
  },

  'MerkleTree': {
    description: 'Merkle tree for proving membership. Height determines max leaves (2^height leaves).',
    import: "import { MerkleTree } from 'o1js';",
    constructors: [
      { signature: 'new MerkleTree(height: number)', description: 'Create tree with given height', example: 'const tree = new MerkleTree(8); // 256 leaves' }
    ],
    instanceMethods: {
      'setLeaf': { signature: 'setLeaf(index: bigint, leaf: Field): void', description: 'Set leaf at index', example: 'tree.setLeaf(0n, Poseidon.hash([value]));' },
      'getLeaf': { signature: 'getLeaf(index: bigint): Field', description: 'Get leaf at index' },
      'getRoot': { signature: 'getRoot(): Field', description: 'Get current root hash', example: 'const root = tree.getRoot();' },
      'getWitness': { signature: 'getWitness(index: bigint): MerkleWitness', description: 'Get membership proof', example: 'const witness = tree.getWitness(0n);' },
      'fill': { signature: 'fill(leaves: Field[]): void', description: 'Fill tree with leaves' },
      'clone': { signature: 'clone(): MerkleTree', description: 'Deep copy the tree' }
    },
    properties: {
      'height': { type: 'number', description: 'Tree height' },
      'leafCount': { type: 'bigint', description: 'Number of possible leaves (2^height)' }
    }
  },

  'MerkleWitness': {
    description: 'Merkle proof for membership verification. Must be subclassed with specific height.',
    import: "import { MerkleWitness } from 'o1js';",
    staticMethods: {
      'height': { signature: 'static height: number', description: 'Get witness height' }
    },
    instanceMethods: {
      'calculateRoot': { signature: 'calculateRoot(leaf: Field): Field', description: 'Calculate root from leaf', example: 'const root = witness.calculateRoot(leafHash);' },
      'calculateIndex': { signature: 'calculateIndex(): Field', description: 'Get index this witness is for' }
    }
  },

  'MerkleMap': {
    description: 'Key-value Merkle map. Keys and values are Fields. Sparse - only stores non-empty values.',
    import: "import { MerkleMap, MerkleMapWitness } from 'o1js';",
    constructors: [
      { signature: 'new MerkleMap()', description: 'Create empty map' }
    ],
    instanceMethods: {
      'set': { signature: 'set(key: Field, value: Field): void', description: 'Set key to value', example: 'map.set(key, value);' },
      'get': { signature: 'get(key: Field): Field', description: 'Get value for key (0 if not set)' },
      'getRoot': { signature: 'getRoot(): Field', description: 'Get current root hash' },
      'getWitness': { signature: 'getWitness(key: Field): MerkleMapWitness', description: 'Get witness for key' }
    }
  },

  'MerkleMapWitness': {
    description: 'Witness for MerkleMap operations. Proves key-value membership.',
    import: "import { MerkleMapWitness } from 'o1js';",
    instanceMethods: {
      'computeRootAndKey': { signature: 'computeRootAndKey(value: Field): [Field, Field]', description: 'Compute root and key from value', example: 'const [root, key] = witness.computeRootAndKey(value);' }
    }
  },

  'Struct': {
    description: 'Create custom provable data structures. Use to bundle multiple fields together.',
    import: "import { Struct } from 'o1js';",
    staticMethods: {
      'create': { signature: 'class MyStruct extends Struct({ field1: Field, field2: Bool }) {}', description: 'Define a Struct by extending with field definitions', example: `class Point extends Struct({ x: Field, y: Field }) {
  static create(x: number, y: number) {
    return new Point({ x: Field(x), y: Field(y) });
  }
}` }
    }
  },

  'Provable': {
    description: 'Utilities for provable computation. Use for conditionals, logging, and witnesses.',
    import: "import { Provable } from 'o1js';",
    staticMethods: {
      'if': { signature: 'Provable.if<T>(condition: Bool, trueBranch: T, falseBranch: T): T', description: 'Provable conditional (use instead of if/else)', example: 'const result = Provable.if(condition, valueIfTrue, valueIfFalse);' },
      'switch': { signature: 'Provable.switch<T>(conditions: Bool[], type: Provable<T>, values: T[]): T', description: 'Provable switch statement', example: 'const result = Provable.switch([isA, isB], Field, [a, b]);' },
      'log': { signature: 'Provable.log(...args: any[]): void', description: 'Debug logging (works during proof generation)', example: 'Provable.log("value:", myField);' },
      'witness': { signature: 'Provable.witness<T>(type: Provable<T>, compute: () => T): T', description: 'Create witness value from computation', example: 'const sqrtX = Provable.witness(Field, () => x.toBigInt().sqrt());' },
      'asProver': { signature: 'Provable.asProver(callback: () => void): void', description: 'Run code only during proving (not verification)' },
      'runAndCheck': { signature: 'Provable.runAndCheck(callback: () => void): void', description: 'Run circuit and check constraints' },
      'assertEqual': { signature: 'Provable.assertEqual<T>(type: Provable<T>, a: T, b: T): void', description: 'Assert two values are equal' },
      'Array': { signature: 'Provable.Array<T>(elementType: Provable<T>, length: number): Provable<T[]>', description: 'Create fixed-length provable array type', example: 'const FieldArray5 = Provable.Array(Field, 5);' },
      'constraintSystem': { signature: 'Provable.constraintSystem(callback: () => void): { rows: number }', description: 'Analyze constraint count' }
    }
  },

  'UInt64': {
    description: '64-bit unsigned integer. Range-checked to prevent overflow.',
    import: "import { UInt64 } from 'o1js';",
    constructors: [
      { signature: 'UInt64.from(value: number | bigint | string | UInt64)', description: 'Create UInt64 from value' }
    ],
    staticMethods: {
      'from': { signature: 'UInt64.from(value: number | bigint | string): UInt64', description: 'Create from number/bigint/string', example: 'const amount = UInt64.from(1000000000);' },
      'MAXINT': { signature: 'UInt64.MAXINT(): UInt64', description: 'Maximum value (2^64 - 1)' },
      'check': { signature: 'UInt64.check(x: UInt64): void', description: 'Assert valid range' }
    },
    instanceMethods: {
      'add': { signature: 'add(y: UInt64 | number | bigint): UInt64', description: 'Add with overflow check' },
      'sub': { signature: 'sub(y: UInt64 | number | bigint): UInt64', description: 'Subtract with underflow check' },
      'mul': { signature: 'mul(y: UInt64 | number | bigint): UInt64', description: 'Multiply with overflow check' },
      'div': { signature: 'div(y: UInt64 | number | bigint): UInt64', description: 'Integer division' },
      'mod': { signature: 'mod(y: UInt64 | number | bigint): UInt64', description: 'Modulo operation' },
      'lessThan': { signature: 'lessThan(y: UInt64): Bool', description: 'Check if this < y' },
      'lessThanOrEqual': { signature: 'lessThanOrEqual(y: UInt64): Bool', description: 'Check if this <= y' },
      'greaterThan': { signature: 'greaterThan(y: UInt64): Bool', description: 'Check if this > y' },
      'greaterThanOrEqual': { signature: 'greaterThanOrEqual(y: UInt64): Bool', description: 'Check if this >= y' },
      'assertEquals': { signature: 'assertEquals(y: UInt64, message?: string): void', description: 'Assert equality' },
      'assertGreaterThan': { signature: 'assertGreaterThan(y: UInt64, message?: string): void', description: 'Assert this > y' },
      'assertGreaterThanOrEqual': { signature: 'assertGreaterThanOrEqual(y: UInt64, message?: string): void', description: 'Assert this >= y' },
      'assertLessThan': { signature: 'assertLessThan(y: UInt64, message?: string): void', description: 'Assert this < y' },
      'assertLessThanOrEqual': { signature: 'assertLessThanOrEqual(y: UInt64, message?: string): void', description: 'Assert this <= y' },
      'toFields': { signature: 'toFields(): Field[]', description: 'Serialize to Fields' },
      'toBigInt': { signature: 'toBigInt(): bigint', description: 'Convert to bigint' },
      'toString': { signature: 'toString(): string', description: 'Convert to string' },
      'toUInt32': { signature: 'toUInt32(): UInt32', description: 'Convert to UInt32 (asserts fits)' }
    }
  },

  'UInt32': {
    description: '32-bit unsigned integer. More efficient than UInt64 when you need smaller range.',
    import: "import { UInt32 } from 'o1js';",
    constructors: [
      { signature: 'UInt32.from(value: number | bigint | string | UInt32)', description: 'Create UInt32 from value' }
    ],
    staticMethods: {
      'from': { signature: 'UInt32.from(value: number | bigint | string): UInt32', description: 'Create from number/bigint/string' },
      'MAXINT': { signature: 'UInt32.MAXINT(): UInt32', description: 'Maximum value (2^32 - 1)' },
      'check': { signature: 'UInt32.check(x: UInt32): void', description: 'Assert valid range' }
    },
    instanceMethods: {
      'add': { signature: 'add(y: UInt32 | number): UInt32', description: 'Add with overflow check' },
      'sub': { signature: 'sub(y: UInt32 | number): UInt32', description: 'Subtract with underflow check' },
      'mul': { signature: 'mul(y: UInt32 | number): UInt32', description: 'Multiply with overflow check' },
      'div': { signature: 'div(y: UInt32 | number): UInt32', description: 'Integer division' },
      'mod': { signature: 'mod(y: UInt32 | number): UInt32', description: 'Modulo operation' },
      'lessThan': { signature: 'lessThan(y: UInt32): Bool', description: 'Check if this < y' },
      'greaterThan': { signature: 'greaterThan(y: UInt32): Bool', description: 'Check if this > y' },
      'assertEquals': { signature: 'assertEquals(y: UInt32, message?: string): void', description: 'Assert equality' },
      'toFields': { signature: 'toFields(): Field[]', description: 'Serialize to Fields' },
      'toBigint': { signature: 'toBigint(): bigint', description: 'Convert to bigint' },
      'toUInt64': { signature: 'toUInt64(): UInt64', description: 'Convert to UInt64' }
    }
  },

  'PublicKey': {
    description: 'Public key for Mina accounts. Used as addresses.',
    import: "import { PublicKey } from 'o1js';",
    staticMethods: {
      'fromBase58': { signature: 'PublicKey.fromBase58(base58: string): PublicKey', description: 'Parse from Base58 address string', example: 'const pk = PublicKey.fromBase58("B62q...");' },
      'fromGroup': { signature: 'PublicKey.fromGroup(g: Group): PublicKey', description: 'Create from Group element' },
      'fromFields': { signature: 'PublicKey.fromFields(fields: Field[]): PublicKey', description: 'Deserialize from Fields' },
      'toFields': { signature: 'PublicKey.toFields(pk: PublicKey): Field[]', description: 'Serialize to Fields' },
      'empty': { signature: 'PublicKey.empty(): PublicKey', description: 'Create empty/zero public key' },
      'sizeInFields': { signature: 'PublicKey.sizeInFields(): number', description: 'Returns 2 (x coordinate + isOdd bit)' }
    },
    instanceMethods: {
      'toBase58': { signature: 'toBase58(): string', description: 'Convert to Base58 address string' },
      'toGroup': { signature: 'toGroup(): Group', description: 'Convert to Group element' },
      'toFields': { signature: 'toFields(): Field[]', description: 'Serialize to Fields' },
      'equals': { signature: 'equals(pk: PublicKey): Bool', description: 'Check equality' },
      'assertEquals': { signature: 'assertEquals(pk: PublicKey, message?: string): void', description: 'Assert equality' },
      'isEmpty': { signature: 'isEmpty(): Bool', description: 'Check if this is the empty key' }
    },
    properties: {
      'x': { type: 'Field', description: 'X coordinate' },
      'isOdd': { type: 'Bool', description: 'Whether Y coordinate is odd' }
    }
  },

  'PrivateKey': {
    description: 'Private key for signing. Keep secret!',
    import: "import { PrivateKey } from 'o1js';",
    staticMethods: {
      'random': { signature: 'PrivateKey.random(): PrivateKey', description: 'Generate random private key', example: 'const key = PrivateKey.random();' },
      'fromBase58': { signature: 'PrivateKey.fromBase58(base58: string): PrivateKey', description: 'Parse from Base58 string' },
      'fromBigInt': { signature: 'PrivateKey.fromBigInt(n: bigint): PrivateKey', description: 'Create from bigint' }
    },
    instanceMethods: {
      'toBase58': { signature: 'toBase58(): string', description: 'Convert to Base58 string' },
      'toPublicKey': { signature: 'toPublicKey(): PublicKey', description: 'Derive public key', example: 'const publicKey = privateKey.toPublicKey();' },
      'toBigInt': { signature: 'toBigInt(): bigint', description: 'Convert to bigint' }
    }
  },

  'Signature': {
    description: 'Schnorr signature. Used to prove ownership of a private key.',
    import: "import { Signature } from 'o1js';",
    staticMethods: {
      'create': { signature: 'Signature.create(privateKey: PrivateKey, msg: Field[]): Signature', description: 'Sign a message', example: 'const sig = Signature.create(privateKey, [Field(1), Field(2)]);' },
      'fromBase58': { signature: 'Signature.fromBase58(base58: string): Signature', description: 'Parse from Base58' },
      'fromFields': { signature: 'Signature.fromFields(fields: Field[]): Signature', description: 'Deserialize from Fields' }
    },
    instanceMethods: {
      'verify': { signature: 'verify(publicKey: PublicKey, msg: Field[]): Bool', description: 'Verify signature', example: 'sig.verify(publicKey, msg).assertTrue();' },
      'toBase58': { signature: 'toBase58(): string', description: 'Convert to Base58' },
      'toFields': { signature: 'toFields(): Field[]', description: 'Serialize to Fields' }
    }
  },

  'AccountUpdate': {
    description: 'Represents changes to an account in a transaction. Created automatically by zkApp methods.',
    import: "import { AccountUpdate } from 'o1js';",
    staticMethods: {
      'fundNewAccount': { signature: 'AccountUpdate.fundNewAccount(payer: PublicKey, count?: number): AccountUpdate', description: 'Fund account creation fee', example: 'AccountUpdate.fundNewAccount(sender);' },
      'create': { signature: 'AccountUpdate.create(publicKey: PublicKey, tokenId?: Field): AccountUpdate', description: 'Create account update for address' },
      'createSigned': { signature: 'AccountUpdate.createSigned(publicKey: PublicKey, tokenId?: Field): AccountUpdate', description: 'Create signed account update' }
    },
    instanceMethods: {
      'send': { signature: 'send({ to: PublicKey, amount: UInt64 }): AccountUpdate', description: 'Send MINA to address' },
      'requireSignature': { signature: 'requireSignature(): void', description: 'Require signature from this account' }
    },
    properties: {
      'account': { type: 'Account', description: 'Account state preconditions' },
      'balance': { type: 'Balance', description: 'Balance changes' },
      'publicKey': { type: 'PublicKey', description: 'Account address' }
    }
  },

  'Mina': {
    description: 'Network interaction utilities. Configure network and send transactions.',
    import: "import { Mina } from 'o1js';",
    staticMethods: {
      'LocalBlockchain': { signature: 'Mina.LocalBlockchain(options?: { proofsEnabled?: boolean }): Promise<LocalBlockchain>', description: 'Create local test network', example: 'const Local = await Mina.LocalBlockchain({ proofsEnabled: false });' },
      'Network': { signature: 'Mina.Network(endpoint: string | { mina: string; archive?: string }): Network', description: 'Connect to Mina network', example: "const network = Mina.Network('https://api.minascan.io/node/devnet/v1/graphql');" },
      'setActiveInstance': { signature: 'Mina.setActiveInstance(instance: LocalBlockchain | Network): void', description: 'Set active network', example: 'Mina.setActiveInstance(Local);' },
      'transaction': { signature: 'Mina.transaction(sender: PublicKey | { sender: PublicKey; fee?: UInt64 }, callback: () => Promise<void>): Promise<Transaction>', description: 'Create transaction', example: `const tx = await Mina.transaction(sender, async () => {
  await zkApp.myMethod(arg);
});` },
      'getAccount': { signature: 'Mina.getAccount(publicKey: PublicKey, tokenId?: Field): Account', description: 'Get account state' },
      'getBalance': { signature: 'Mina.getBalance(publicKey: PublicKey, tokenId?: Field): UInt64', description: 'Get account balance' },
      'getNetworkState': { signature: 'Mina.getNetworkState(): NetworkState', description: 'Get network state' },
      'fetchAccount': { signature: 'Mina.fetchAccount({ publicKey: PublicKey, tokenId?: Field }): Promise<{ account: Account }>', description: 'Fetch account from network', example: 'await Mina.fetchAccount({ publicKey: contractAddress });' },
      'sender': { signature: 'Mina.sender(): PublicKey', description: 'Get current transaction sender' }
    }
  },

  'Encryption': {
    description: 'Utilities for encrypting data with public keys.',
    import: "import { Encryption } from 'o1js';",
    staticMethods: {
      'encrypt': { signature: 'Encryption.encrypt(message: Field[], publicKey: PublicKey): CipherText', description: 'Encrypt message for public key' },
      'decrypt': { signature: 'Encryption.decrypt(ciphertext: CipherText, privateKey: PrivateKey): Field[]', description: 'Decrypt with private key' }
    }
  },

  'CircuitString': {
    description: 'Fixed-length provable string type. Use for strings in circuits.',
    import: "import { CircuitString } from 'o1js';",
    staticMethods: {
      'fromString': { signature: 'CircuitString.fromString(s: string): CircuitString', description: 'Create from JS string', example: 'const str = CircuitString.fromString("hello");' }
    },
    instanceMethods: {
      'toString': { signature: 'toString(): string', description: 'Convert to JS string' },
      'equals': { signature: 'equals(other: CircuitString): Bool', description: 'Check equality' },
      'append': { signature: 'append(other: CircuitString): CircuitString', description: 'Concatenate strings' },
      'hash': { signature: 'hash(): Field', description: 'Hash the string' }
    }
  },

  'ZkProgram': {
    description: 'Create standalone zero-knowledge programs (not tied to a contract).',
    import: "import { ZkProgram } from 'o1js';",
    staticMethods: {
      'create': { signature: 'ZkProgram({ name: string, publicInput?: Provable<T>, publicOutput?: Provable<U>, methods: Record<string, { privateInputs: Provable<any>[]; async method(...args): Promise<U> }> })', description: 'Define a ZkProgram', example: `const MyProgram = ZkProgram({
  name: 'my-program',
  publicInput: Field,
  publicOutput: Field,
  methods: {
    compute: {
      privateInputs: [Field],
      async method(publicInput: Field, privateInput: Field) {
        return publicInput.add(privateInput);
      }
    }
  }
});` }
    }
  },

  'fetchAccount': {
    description: 'Fetch account state from the network. Required before interacting with deployed contracts.',
    import: "import { fetchAccount } from 'o1js';",
    staticMethods: {
      'fetchAccount': { signature: 'fetchAccount({ publicKey: PublicKey, tokenId?: Field }): Promise<{ account: Account; error?: any }>', description: 'Fetch account from network', example: `await fetchAccount({ publicKey: contractAddress });
// Now you can read contract state` }
    }
  }
};

// Aliases for common search terms
const CLASS_ALIASES: Record<string, string> = {
  'circuit': 'SmartContract',
  'contract': 'SmartContract',
  'zkapp': 'SmartContract',
  'hash': 'Poseidon',
  'merkle': 'MerkleTree',
  'map': 'MerkleMap',
  'witness': 'MerkleWitness',
  'int': 'UInt64',
  'integer': 'UInt64',
  'uint': 'UInt64',
  'address': 'PublicKey',
  'key': 'PublicKey',
  'sign': 'Signature',
  'sig': 'Signature',
  'boolean': 'Bool',
  'string': 'CircuitString',
  'program': 'ZkProgram',
  'conditional': 'Provable',
  'if': 'Provable'
};

export async function getApiSignature(
  args: GetApiSignatureArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const normalizedClass = args.className.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Check aliases
  const aliasedClass = CLASS_ALIASES[normalizedClass];
  const searchClass = aliasedClass || args.className;

  // Find the class (case-insensitive)
  const classKey = Object.keys(API_SIGNATURES).find(
    k => k.toLowerCase() === searchClass.toLowerCase()
  );

  if (!classKey) {
    // Search documentation as fallback
    const results = await context.search.search(`${args.className} API reference`, {
      limit: 3,
      contentType: 'api-reference'
    });

    const availableClasses = Object.keys(API_SIGNATURES).join(', ');

    const sections = [
      `# API Signature: ${args.className}`,
      '',
      `Class "${args.className}" not found in API database.`,
      '',
      `**Available classes:** ${availableClasses}`,
      ''
    ];

    if (results.length > 0) {
      sections.push('## Related Documentation', '');
      for (const r of results) {
        sections.push(`- [${r.chunk.title}](${r.chunk.url})`);
      }
    }

    return {
      content: [{ type: 'text', text: sections.join('\n') }]
    };
  }

  const classInfo = API_SIGNATURES[classKey];
  const sections: string[] = [];

  // If specific method requested
  if (args.methodName) {
    const methodLower = args.methodName.toLowerCase();

    // Search in all method categories
    let found = false;

    if (classInfo.staticMethods?.[args.methodName] || classInfo.staticMethods?.[methodLower]) {
      const method = classInfo.staticMethods[args.methodName] || classInfo.staticMethods[methodLower];
      sections.push(
        `# ${classKey}.${args.methodName}`,
        '',
        '```typescript',
        method.signature,
        '```',
        '',
        method.description
      );
      if (method.example) {
        sections.push('', '**Example:**', '```typescript', method.example, '```');
      }
      found = true;
    }

    if (classInfo.instanceMethods?.[args.methodName] || classInfo.instanceMethods?.[methodLower]) {
      const method = classInfo.instanceMethods[args.methodName] || classInfo.instanceMethods[methodLower];
      if (found) sections.push('', '---', '');
      sections.push(
        found ? `# ${classKey}.prototype.${args.methodName}` : `# ${classKey}.${args.methodName}`,
        '',
        '```typescript',
        method.signature,
        '```',
        '',
        method.description
      );
      if (method.example) {
        sections.push('', '**Example:**', '```typescript', method.example, '```');
      }
      found = true;
    }

    if (!found) {
      sections.push(
        `# ${classKey}.${args.methodName}`,
        '',
        `Method "${args.methodName}" not found on ${classKey}.`,
        '',
        '**Available methods:**'
      );

      if (classInfo.staticMethods) {
        sections.push('', '*Static:* ' + Object.keys(classInfo.staticMethods).join(', '));
      }
      if (classInfo.instanceMethods) {
        sections.push('', '*Instance:* ' + Object.keys(classInfo.instanceMethods).join(', '));
      }
    }

    sections.push('', '---', `Import: \`${classInfo.import}\``);

    return {
      content: [{ type: 'text', text: sections.join('\n') }]
    };
  }

  // Full class overview
  sections.push(
    `# ${classKey}`,
    '',
    classInfo.description,
    '',
    '```typescript',
    classInfo.import,
    '```'
  );

  if (classInfo.extends) {
    sections.push('', `**Extends:** ${classInfo.extends}`);
  }

  if (classInfo.constructors) {
    sections.push('', '## Constructors', '');
    for (const ctor of classInfo.constructors) {
      sections.push(`- \`${ctor.signature}\``, `  ${ctor.description}`, '');
    }
  }

  if (classInfo.staticMethods && Object.keys(classInfo.staticMethods).length > 0) {
    sections.push('## Static Methods', '');
    for (const [name, method] of Object.entries(classInfo.staticMethods)) {
      sections.push(`### ${classKey}.${name}`, '```typescript', method.signature, '```', method.description);
      if (method.example) {
        sections.push('```typescript', method.example, '```');
      }
      sections.push('');
    }
  }

  if (classInfo.instanceMethods && Object.keys(classInfo.instanceMethods).length > 0) {
    sections.push('## Instance Methods', '');
    for (const [name, method] of Object.entries(classInfo.instanceMethods)) {
      sections.push(`### .${name}()`, '```typescript', method.signature, '```', method.description);
      if (method.example) {
        sections.push('```typescript', method.example, '```');
      }
      sections.push('');
    }
  }

  if (classInfo.properties && Object.keys(classInfo.properties).length > 0) {
    sections.push('## Properties', '');
    for (const [name, prop] of Object.entries(classInfo.properties)) {
      sections.push(`- **${name}**: \`${prop.type}\` - ${prop.description}`);
    }
    sections.push('');
  }

  if (classInfo.decorators && Object.keys(classInfo.decorators).length > 0) {
    sections.push('## Decorators', '');
    for (const [name, dec] of Object.entries(classInfo.decorators)) {
      sections.push(`### ${name}`, '```typescript', dec.usage, '```', dec.description, '');
    }
  }

  return {
    content: [{ type: 'text', text: sections.join('\n') }]
  };
}
