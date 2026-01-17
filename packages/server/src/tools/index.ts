import { askDocs, AskDocsSchema } from './ask-docs.js';
import { getWorkingExample, GetWorkingExampleSchema } from './working-example.js';
import { explainError, ExplainErrorSchema } from './explain-error.js';
import { searchDocs, SearchDocsSchema } from './search-docs.js';
import { listProjectsTool, ListProjectsSchema } from './list-projects.js';
import type { HybridSearch, FullTextDB, LLMClient, WebSearchClient, Reranker } from '@mina-docs/shared';
import { listProjects, loadProjectConfig } from '@mina-docs/shared';
import { logger } from '../utils/logger.js';

// Helper functions to generate dynamic project descriptions
function getProjectDescriptions(): string {
  try {
    const projects = listProjects();
    if (projects.length === 0) {
      return '- Use crypto_list_projects to see available projects';
    }
    return projects.map(id => {
      try {
        const config = loadProjectConfig(id);
        return `- "${id}" - ${config.name}`;
      } catch {
        return `- "${id}"`;
      }
    }).join('\n');
  } catch {
    return '- Use crypto_list_projects to see available projects';
  }
}

function getProjectList(): string {
  try {
    const projects = listProjects();
    if (projects.length === 0) {
      return 'available projects';
    }
    return projects.map(id => `"${id}"`).join(', ');
  } catch {
    return 'available projects';
  }
}

export interface ToolContext {
  search: HybridSearch;
  ftsDb: FullTextDB;
  /** Reranker for result quality improvement */
  reranker?: Reranker;
  /** LLM client for main synthesis (answer generation) */
  llmClient: LLMClient;
  /** LLM client for evaluation (answer quality assessment) - may be a smaller/faster model */
  llmEvaluator?: LLMClient;
  /** LLM client for refinement (answer improvement) */
  llmRefiner?: LLMClient;
  /** LLM client for web result analysis (parallel relevance filtering) - fast model recommended */
  llmAnalyzer?: LLMClient;
  webSearch?: WebSearchClient;
}

export function getToolDefinitions() {
  const projectDescriptions = getProjectDescriptions();
  const projectList = getProjectList();

  return [
    {
      name: 'crypto_list_projects',
      description: `List available blockchain documentation projects.

TRIGGER THIS TOOL WHEN: User mentions blockchain, crypto, web3, smart contracts, or asks what documentation is available.

Available projects:
${projectDescriptions}

RETURNS: Project identifiers with descriptions to use in other tools.`,
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'crypto_ask_docs',
      description: `Ask questions about blockchain documentation and get LLM-synthesized answers.

TRIGGER THIS TOOL WHEN user asks about blockchain development concepts, APIs, or how to accomplish tasks.

Use crypto_list_projects first to see available projects, then specify the project parameter.

INPUT:
- question: Your question about blockchain development
- project: One of ${projectList}

RETURNS: Synthesized answer with code snippets, source URLs, and confidence score.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          question: {
            type: 'string',
            description: 'Question about blockchain development.'
          },
          project: {
            type: 'string',
            description: `Project identifier. Available: ${projectList}`
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
      description: `Get complete, runnable code examples for blockchain development.

TRIGGER THIS TOOL WHEN user wants to:
- Write a smart contract
- Implement token transfers, deployments, or transactions
- See working code for blockchain operations
- Get boilerplate/starter code

INPUT:
- task: What you want to accomplish (e.g., "deploy contract", "transfer tokens", "sign transaction")
- project: One of ${projectList}

RETURNS: Complete code with ALL imports, types, setup, implementation, and usage example.

Use this instead of crypto_ask_docs when you need actual code to copy-paste.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          task: {
            type: 'string',
            description: 'Task: "deploy contract", "transfer tokens", "create keypair", "sign transaction", "query balance", etc.'
          },
          project: {
            type: 'string',
            description: `Project identifier. Available: ${projectList}`
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
      description: `Debug blockchain development errors.

TRIGGER THIS TOOL WHEN user encounters errors related to smart contracts, transactions, or blockchain operations.

INPUT:
- error: The full error message/stack trace
- project: One of ${projectList}
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
            description: `Project identifier. Available: ${projectList}`
          },
          context: {
            type: 'string',
            description: 'What you were doing: "deploying contract", "transferring tokens", etc.'
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
      description: `Search raw documentation for blockchain projects.

TRIGGER THIS TOOL WHEN user wants to:
- Find specific API signatures or type definitions
- Browse what's in the documentation
- See the original docs text (not AI-synthesized)
- Look up function/class/method details

INPUT:
- query: Keywords to search (function names, concepts, etc.)
- project: One of ${projectList}
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
            description: `Project identifier. Available: ${projectList}`
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
