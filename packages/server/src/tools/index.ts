import { askDocs, AskDocsSchema } from './ask-docs.js';
import { getWorkingExample, GetWorkingExampleSchema } from './working-example.js';
import { explainError, ExplainErrorSchema } from './explain-error.js';
import { searchDocs, SearchDocsSchema } from './search-docs.js';
import { listProjectsTool, ListProjectsSchema } from './list-projects.js';
import type { HybridSearch, FullTextDB, LLMClient } from '@mina-docs/shared';

export interface ToolContext {
  search: HybridSearch;
  ftsDb: FullTextDB;
  llmClient: LLMClient;
}

export function getToolDefinitions() {
  return [
    {
      name: 'list_projects',
      description: 'List all available documentation projects. Use this first to see what projects are available.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'ask_docs',
      description: 'Ask a question about project documentation. Returns a synthesized, comprehensive answer with code examples, explanations, and source citations. Best for: "How do I...", "What is...", "Explain..."',
      inputSchema: {
        type: 'object' as const,
        properties: {
          question: {
            type: 'string',
            description: 'Your question about the documentation'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum response length (default: 4000)'
          }
        },
        required: ['question', 'project']
      }
    },
    {
      name: 'get_working_example',
      description: 'Get a complete, runnable code example for a task. Returns code with ALL imports, type definitions, setup, and step-by-step explanation. Best for: "Show me how to...", "Code for...", "Example of..."',
      inputSchema: {
        type: 'object' as const,
        properties: {
          task: {
            type: 'string',
            description: 'What you want to accomplish (e.g., "transfer tokens", "deploy smart contract")'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum response length (default: 4000)'
          }
        },
        required: ['task', 'project']
      }
    },
    {
      name: 'explain_error',
      description: 'Get help understanding and fixing an error. Returns the error cause, how to fix it, and how to prevent it. Best for debugging.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          error: {
            type: 'string',
            description: 'The error message or description'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          context: {
            type: 'string',
            description: 'What you were trying to do when the error occurred (optional but helps)'
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum response length (default: 2000)'
          }
        },
        required: ['error', 'project']
      }
    },
    {
      name: 'search_docs',
      description: 'Search documentation and return raw chunks. Use this for browsing or when you need the exact documentation text. For answered questions, use ask_docs instead.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          contentType: {
            type: 'string',
            enum: ['prose', 'code', 'api-reference'],
            description: 'Filter by content type (optional)'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 10)'
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
  try {
    const parsedArgs = args || {};

    switch (name) {
      case 'list_projects':
        return await listProjectsTool(ListProjectsSchema.parse(parsedArgs));

      case 'ask_docs':
        return await askDocs(AskDocsSchema.parse(parsedArgs), context);

      case 'get_working_example':
        return await getWorkingExample(GetWorkingExampleSchema.parse(parsedArgs), context);

      case 'explain_error':
        return await explainError(ExplainErrorSchema.parse(parsedArgs), context);

      case 'search_docs':
        return await searchDocs(SearchDocsSchema.parse(parsedArgs), context);

      default:
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool: ${name}` }]
        };
    }
  } catch (error) {
    console.error(`Tool ${name} error:`, error);
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}
