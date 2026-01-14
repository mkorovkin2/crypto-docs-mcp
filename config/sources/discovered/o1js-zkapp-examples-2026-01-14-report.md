# Discovered Sources Report

**Project**: o1js-zkapp-examples
**Date**: 2026-01-14T00:54:41.888Z
**Total Sources**: 20

## Summary by Type

- docs: 6
- blog: 4
- tutorial: 4
- github: 6

## Sources

### Introduction to o1js | Mina Documentation
- **URL**: https://docs.minaprotocol.com/zkapps/o1js
- **Type**: docs
- **Description**: o1js provides data types and methods that are provable: You can prove their execution.

In the example code, `Poseidon.hash()` and `Field.assertEquals()` are examples of provable methods. Proofs are zero knowledge, because they can be verified without learning their inputs and execution trace. Selec

### How to Write a zkApp | Mina Documentation
- **URL**: https://docs.minaprotocol.com/zkapps/writing-a-zkapp/introduction-to-zkapps/how-to-write-a-zkapp
- **Type**: docs
- **Description**: ## Writing your smart contract​

zkApps are written in TypeScript using o1js. o1js is a TypeScript library for writing smart contracts based on zero knowledge proofs for the Mina Protocol. o1js is automatically included when you create a project using the zkApp CLI.

To get started writing zkApps, b

### Step-by-Step Guide to Building a zkApp with O1js - DEV Community
- **URL**: https://dev.to/uratmangun/step-by-step-guide-to-building-a-zkapp-with-o1js-321k
- **Type**: blog
- **Description**: ```
install 
```

Example component (`src/index.tsx`):

```
import{useState} from ' react '; import{NumberUpdate} from './contracts/NumberUpdate '; import{Mina, PublicKey} from ' o1js '; export default function App(){const[number, setNumber] = useState< number>(0); const updateNumber = async () =>{c

### Mastermind zkApp Example Series - o1Labs
- **URL**: https://www.o1labs.org/blog/mastermind-zkapp-example-series
- **Type**: tutorial
- **Description**: The game itself is simple - a code master selects a 4-digit secret code, and the codebreaker tries to guess the code. With each round, the codebreaker submits a 4-digit guess. The code master responds by telling the codebreaker if they've guessed any of the digits correctly and whether or not those 

### Understanding O1js: Simplifying zkApp Development
- **URL**: https://dev.to/uratmangun/understanding-o1js-simplifying-zkapp-development-mdh
- **Type**: blog
- **Description**: ## Advanced Features

### 1. Merkle Trees and Merkle Maps

O1js provides built-in support for Merkle trees and Merkle maps, essential data structures for scalable zkApps:

`class TokenContract extends SmartContract {
@state(MerkleMap)
balances = State<MerkleMap>();
@method
transfer(from: PublicKey, 

### Building a Private Voting zkApp on Mina Protocol using o1js
- **URL**: https://dev.to/syedghufranhassan/implementing-a-private-voting-app-as-a-zkapp-2a1
- **Type**: tutorial
- **Description**: ```
import{PrivateKey, PublicKey, Mina, Field} from ' o1js '; import{PrivateVoting} from './Add '; const zkAppAddress = ' ';// Replace with your zkApp's public key const votingApp = new PrivateVoting(PublicKey. fromBase58(zkAppAddress)); async function castVote(option: Field, proof: Field){console. 

### Introduction to zkApps Development in Mina using o1js and Protokit
- **URL**: https://winifredjohnchidera123.medium.com/introduction-to-zkapps-development-in-mina-using-o1js-and-protokit-e7caeafc9466
- **Type**: tutorial
- **Description**: 2. Step2: confirm successful installation

```
zk --version
```

3. Step 3: create a project

NB: A zkApp comes with a smart contract and UI, you can choose to use UI or build without a UI.

```
zk project 
```

In this article, we used the example project on Mina. This is recommended if you are a b

### o1-labs/o1js: TypeScript framework for zk-SNARKs and zkApps
- **URL**: https://github.com/o1-labs/o1js
- **Type**: github
- **Description**: | README-dev.md | README-dev.md |  |  |
| README-nix.md | README-nix.md |  |  |
| README.md | README.md |  |  |
| dune-project | dune-project |  |  |
| flake.lock | flake.lock |  |  |
| flake.nix | flake.nix |  |  |
| generate-keys.js | generate-keys.js |  |  |
| jest | jest |  |  |
| jest.config.js

### The Many Saints of Privacy: Nullifiers in o1js - o1Labs
- **URL**: https://www.o1labs.org/blog/the-many-saints-of-privacy-nullifiers-in-o1js
- **Type**: blog
- **Description**: First, a zkApp developer needs to specify something called the nullifier message (sometimes referred to as a topic). This piece of data is essential for uniquely identifying the nullifier’s purpose. It could be anything: a random piece of data, the address of the zkApp account, or something arbitrar

### simple-zkapp-payment.ts - o1-labs/o1js - GitHub
- **URL**: https://github.com/o1-labs/o1js/blob/main/src/examples/zkapps/simple-zkapp-payment.ts
- **Type**: github
- **Description**: TypeScript framework for zk-SNARKs and zkApps. Contribute to o1-labs/o1js development by creating an account on GitHub.

### Tutorial 1: Hello World | Mina Documentation
- **URL**: https://docs.minaprotocol.com/zkapps/tutorials/hello-world
- **Type**: docs
- **Description**: For this tutorial, you run commands from the root of the `01-hello-world` directory as you work in the `src` directory on files that contain the TypeScript code for the smart contract. *   This tutorial does not include writing tests, so you just use the `main.ts` file as a script to interact with t

### zkApp Developer Tutorials | Mina Documentation
- **URL**: https://docs.minaprotocol.com/zkapps/tutorials
- **Type**: docs
- **Description**: # zkApp Developer Tutorials. zkApp developer tutorials are a hands-on walk-through of use cases that guide you to achieve a defined goal. To meet other developers building zkApps with o1js, participate in the #zkapps-developers channel on Mina Protocol Discord. o1js is automatically included when yo

### CLI to create a zkApp (zero-knowledge app) for Mina Protocol - GitHub
- **URL**: https://github.com/o1-labs/zkapp-cli
- **Type**: github
- **Description**: CLI to create a zkApp (zero-knowledge app) for Mina Protocol. # zkApp CLI. The zkApp CLI allows you to scaffold, write, test, and deploy zkApps (zero knowledge apps) for Mina Protocol using recommended best practices. o1js is automatically included when you create a project using the zkApp CLI. ### 

### Building our first Mina zkApp game: Chapter 1 | by ZkNoid - Medium
- **URL**: https://medium.com/zknoid/building-our-first-mina-zkapp-game-chapter-1-de7880584aff
- **Type**: blog
- **Description**: @method async guessNumebr( number: Field, score: Field, scoreWitness: MerkleMapWitness ) { let curHiddenNumber = this.hiddenNumber.getAndRequireEquals(); curHiddenNumber.assertEquals( Poseidon.hash([number]), 'Other numbre was guessed' ); // Check witnessed value const [prevScoreRoot, key] = scoreWi

### Intro to Building zkApps with TypeScript on Mina | Tutorial Series
- **URL**: https://www.youtube.com/watch?v=eRkqAE8TrMM
- **Type**: tutorial
- **Description**: Intro to Building zkApps with TypeScript on Mina | Tutorial Series
Mina Protocol
8940 subscribers
60 likes
2299 views
5 Jul 2023
In this video series, Caleb from Mina Foundation helps you learn how zero knowledge smart contracts work and how to write your own using TypeScript. In this video, he shar

### List of Projects on Mina and o1js
- **URL**: https://github.com/MinaFoundation/list-of-projects
- **Type**: github
- **Description**: You signed in with another tab or window. You signed out in another tab or window. List of zkApps and other applications that are built on Mina / o1js. 15 stars   3 forks   Branches   Tags   Activity. # List of Projects on Mina and o1js. In this repository, you can find a list of zkApps and librarie

### o1-labs-XT/mastermind-zkApp
- **URL**: https://github.com/o1-labs-XT/mastermind-zkApp
- **Type**: github
- **Description**: * After initialization, the Code Master calls the `createGame` method to start the game and set a secret combination for the Code Breaker to solve. + This method also enforces the correct sequence of player interactions by only allowing the code breaker to make a guess if the `turnCount` state is `o

### Tutorial 4: Build a zkApp UI in the Browser with React - Mina Docs
- **URL**: https://docs.minaprotocol.com/zkapps/tutorials/zkapp-ui-with-react
- **Type**: docs
- **Description**: Tutorial 4: Build a zkApp UI in the Browser with React | Mina Documentation. *   In Tutorial 3: Deploy to a Live Network, you used the `zk` commands to deploy your zkApp. In this tutorial, you are going to implement a browser UI using `Next.js` that interacts with a smart contract. For this tutorial

### o1-labs-XT/name-service-example
- **URL**: https://github.com/o1-labs-XT/name-service-example
- **Type**: github
- **Description**: 0 stars   2 forks   Branches   Tags   Activity. # Offchain State API. Offchain State API helps to overcome 8 state field limitation by enabling offchain mappings and fields. Two types of offchain state are offered: `OffchainState.Field` (a single state field) and `OffchainState.Map` (a key-value map

### o1js API Reference | Mina Documentation
- **URL**: https://docs.minaprotocol.com/zkapps/o1js-reference
- **Type**: docs
- **Description**: | Struct 
| ToProvable 
| TransactionPromise | A `Promise<Transaction>` with some additional methods for making chained method calls |
| TransactionStatus | INCLUDED: A transaction that is on the longest chain |
| TupleN | tuple type that has the length as generic parameter |
| Undefined 
| VarField

