import { askDocs, AskDocsSchema } from './ask-docs.js';
import { getWorkingExample, GetWorkingExampleSchema } from './working-example.js';
import { explainError, ExplainErrorSchema } from './explain-error.js';
import { searchDocs, SearchDocsSchema } from './search-docs.js';
import { listProjectsTool, ListProjectsSchema } from './list-projects.js';
import type { HybridSearch, FullTextDB, LLMClient } from '@mina-docs/shared';
import { logger } from '../utils/logger.js';

export interface ToolContext {
  search: HybridSearch;
  ftsDb: FullTextDB;
  llmClient: LLMClient;
}

export function getToolDefinitions() {
  return [
    {
      name: 'crypto_list_projects',
      description: `List available blockchain documentation projects: Mina Protocol (zkApps, o1js), Solana, and Cosmos SDK.

TRIGGER THIS TOOL WHEN: User mentions blockchain, crypto, web3, smart contracts, zkApps, Mina, Solana, Cosmos, or asks what documentation is available.

Available projects:
- "mina" - Mina Protocol: zkApps, o1js, zero-knowledge proofs, snarkyjs
- "solana" - Solana: programs, @solana/web3.js, Anchor, SPL tokens
- "cosmos" - Cosmos SDK: CosmJS, IBC, Tendermint, CosmWasm

RETURNS: Project identifiers with descriptions to use in other tools.`,
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'crypto_ask_docs',
      description: `Ask questions about Mina Protocol (zkApps, o1js), Solana, or Cosmos SDK documentation and get LLM-synthesized answers.

TRIGGER THIS TOOL WHEN user asks about:
- Mina: zkApps, o1js, snarkyjs, zero-knowledge proofs, ZK circuits, Field, CircuitValue, SmartContract, Poseidon, deploy zkApp, Mina transactions
- Solana: programs, @solana/web3.js, Anchor framework, SPL tokens, PDAs, CPIs, Solana transactions, accounts, rent
- Cosmos: CosmJS, IBC protocol, Tendermint, CosmWasm, SDK modules, validators, staking, governance

EXAMPLE TRIGGERS:
- "How do I deploy a zkApp on Mina?"
- "What is a PDA in Solana?"
- "How does IBC work in Cosmos?"
- "Explain o1js Field type"
- "What's the difference between Anchor and native Solana programs?"

INPUT:
- question: Your question about blockchain development
- project: "mina", "solana", or "cosmos"

RETURNS: Synthesized answer with code snippets, source URLs, and confidence score.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          question: {
            type: 'string',
            description: 'Question about Mina/zkApps/o1js, Solana/Anchor, or Cosmos/CosmJS development.'
          },
          project: {
            type: 'string',
            description: 'Project: "mina" (zkApps, o1js), "solana" (web3.js, Anchor), or "cosmos" (CosmJS, IBC).'
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum response length in tokens (default: 4000).'
          }
        },
        required: ['question', 'project']
      }
    },
    {
      name: 'crypto_get_working_example',
      description: `Get complete, runnable code examples for Mina (zkApps, o1js), Solana (web3.js, Anchor), or Cosmos (CosmJS) development.

TRIGGER THIS TOOL WHEN user wants to:
- Write a zkApp or smart contract
- Implement token transfers, deployments, or transactions
- See working code for blockchain operations
- Get boilerplate/starter code

EXAMPLE TRIGGERS:
- "Show me how to transfer tokens on Solana"
- "Give me a zkApp example for Mina"
- "Code example for deploying a smart contract"
- "How do I sign a transaction with o1js?"
- "Working example of IBC transfer in Cosmos"

INPUT:
- task: What you want to accomplish (e.g., "deploy zkApp", "transfer SOL", "stake tokens")
- project: "mina", "solana", or "cosmos"

RETURNS: Complete code with ALL imports, types, setup, implementation, and usage example.

Use this instead of crypto_ask_docs when you need actual code to copy-paste.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          task: {
            type: 'string',
            description: 'Task: "deploy zkApp", "transfer tokens", "create keypair", "sign transaction", "query balance", etc.'
          },
          project: {
            type: 'string',
            description: 'Project: "mina" (zkApps, o1js), "solana" (web3.js, Anchor), or "cosmos" (CosmJS, IBC).'
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum response length in tokens (default: 4000).'
          }
        },
        required: ['task', 'project']
      }
    },
    {
      name: 'crypto_explain_error',
      description: `Debug blockchain development errors for Mina (zkApps, o1js), Solana, or Cosmos SDK.

TRIGGER THIS TOOL WHEN user encounters errors like:
- Mina/o1js: "Field.assertEquals failed", "ZkProgram compilation error", zkApp transaction failures, snarkyjs type errors
- Solana: "Program failed to complete", "Account not found", "Instruction error", Anchor IDL issues, insufficient funds
- Cosmos: "Out of gas", "Signature verification failed", IBC timeout, CosmWasm instantiation errors

EXAMPLE TRIGGERS:
- "Getting 'Field.assertEquals failed' in my zkApp"
- "Solana program error: custom program error 0x1"
- "CosmJS transaction failed with code 5"
- "Why is my zkApp deploy failing?"

INPUT:
- error: The full error message/stack trace
- project: "mina", "solana", or "cosmos"
- context (optional): What you were doing
- codeSnippet (optional): The failing code

RETURNS: Root cause explanation, step-by-step fix, prevention tips, and related docs.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          error: {
            type: 'string',
            description: 'The full error message including codes and stack traces.'
          },
          project: {
            type: 'string',
            description: 'Project: "mina" (zkApps, o1js), "solana" (web3.js, Anchor), or "cosmos" (CosmJS, IBC).'
          },
          context: {
            type: 'string',
            description: 'What you were doing: "deploying zkApp", "transferring tokens", etc.'
          },
          codeSnippet: {
            type: 'string',
            description: 'The code that caused the error.'
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum response length in tokens (default: 4000).'
          }
        },
        required: ['error', 'project']
      }
    },
    {
      name: 'crypto_search_docs',
      description: `Search raw documentation for Mina Protocol (zkApps, o1js), Solana, or Cosmos SDK.

TRIGGER THIS TOOL WHEN user wants to:
- Find specific API signatures or type definitions
- Browse what's in the documentation
- See the original docs text (not AI-synthesized)
- Look up function/class/method details

EXAMPLE TRIGGERS:
- "Search Mina docs for Field methods"
- "Find Solana docs about PDAs"
- "Look up CosmJS SigningClient"
- "What does the o1js documentation say about Poseidon?"

INPUT:
- query: Keywords to search (function names, concepts, etc.)
- project: "mina", "solana", or "cosmos"
- contentType (optional): "prose", "code", or "api-reference"
- limit (optional): Number of results (default: 10)

RETURNS: Raw documentation chunks with source URLs. For synthesized answers, use crypto_ask_docs instead.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search keywords: function names, types, concepts, or phrases.'
          },
          project: {
            type: 'string',
            description: 'Project: "mina" (zkApps, o1js), "solana" (web3.js, Anchor), or "cosmos" (CosmJS, IBC).'
          },
          contentType: {
            type: 'string',
            enum: ['prose', 'code', 'api-reference'],
            description: 'Filter: "prose" (explanations), "code" (examples), "api-reference" (API docs).'
          },
          limit: {
            type: 'number',
            description: 'Number of results to return (default: 10).'
          }
        },
        required: ['query', 'project']
      }
    }
  ];
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const startTime = Date.now();
  const parsedArgs = args || {};

  // Log tool call start
  logger.toolStart(name, parsedArgs);

  try {
    let result: { content: Array<{ type: string; text: string }>; isError?: boolean };

    switch (name) {
      case 'crypto_list_projects':
        result = await listProjectsTool(ListProjectsSchema.parse(parsedArgs));
        break;

      case 'crypto_ask_docs':
        result = await askDocs(AskDocsSchema.parse(parsedArgs), context);
        break;

      case 'crypto_get_working_example':
        result = await getWorkingExample(GetWorkingExampleSchema.parse(parsedArgs), context);
        break;

      case 'crypto_explain_error':
        result = await explainError(ExplainErrorSchema.parse(parsedArgs), context);
        break;

      case 'crypto_search_docs':
        result = await searchDocs(SearchDocsSchema.parse(parsedArgs), context);
        break;

      default:
        logger.toolEnd(name, Date.now() - startTime, false);
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool: ${name}` }]
        };
    }

    // Log tool call end
    logger.toolEnd(name, Date.now() - startTime, !result.isError);
    return result;

  } catch (error) {
    logger.error(`Tool ${name} failed`, error);
    logger.toolEnd(name, Date.now() - startTime, false);
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}
