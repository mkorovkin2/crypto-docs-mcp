import { searchDocumentation, SearchDocumentationSchema } from './search.js';
import { getCodeExamples, GetCodeExamplesSchema } from './examples.js';
import { explainConcept, ExplainConceptSchema } from './explain.js';
import { debugHelper, DebugHelperSchema } from './debug.js';
import { getApiSignature, GetApiSignatureSchema } from './api-signatures.js';
import { resolveImport, ResolveImportSchema } from './imports.js';
import { getPattern, GetPatternSchema } from './patterns.js';
import { listProjectsTool, ListProjectsSchema } from './list-projects.js';
import type { HybridSearch, FullTextDB } from '@mina-docs/shared';

export interface ToolContext {
  search: HybridSearch;
  ftsDb: FullTextDB;
}

export function getToolDefinitions() {
  return [
    {
      name: 'list_projects',
      description: 'List all available documentation projects that can be queried. Use this to see which projects are available before searching.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'search_documentation',
      description: 'Search project documentation using semantic and keyword search. Returns relevant documentation sections, tutorials, and API references. Use this for general documentation queries.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query - can be a question, keyword, or concept'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos"). Use list_projects to see available options.'
          },
          contentType: {
            type: 'string',
            enum: ['prose', 'code', 'api-reference'],
            description: 'Filter results by content type (optional)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5, max: 10)'
          }
        },
        required: ['query', 'project']
      }
    },
    {
      name: 'get_code_examples',
      description: 'Find code examples for a specific topic. Returns code snippets from documentation and source code. Best for finding implementation examples.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          topic: {
            type: 'string',
            description: 'Topic to find examples for (e.g., "smart contract", "hash function", "state management")'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of examples to return (default: 3)'
          }
        },
        required: ['topic', 'project']
      }
    },
    {
      name: 'explain_concept',
      description: 'Get explanations of concepts from project documentation. Useful for understanding terminology, protocol mechanics, and framework features.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          concept: {
            type: 'string',
            description: 'Concept to explain'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          depth: {
            type: 'string',
            enum: ['brief', 'detailed'],
            description: 'Level of detail - "brief" for quick definition, "detailed" for comprehensive explanation (default: brief)'
          }
        },
        required: ['concept', 'project']
      }
    },
    {
      name: 'debug_helper',
      description: 'Get help debugging errors and issues. Provide the error message to find relevant troubleshooting documentation.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          error: {
            type: 'string',
            description: 'Error message or description of the issue'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          context: {
            type: 'string',
            description: 'Additional context about what you were trying to do (optional)'
          }
        },
        required: ['error', 'project']
      }
    },
    {
      name: 'get_api_signature',
      description: 'Get API documentation for classes and functions. Returns signatures, parameters, and usage examples from documentation.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          className: {
            type: 'string',
            description: 'Class or module name to look up'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          methodName: {
            type: 'string',
            description: 'Specific method name (optional - omit to get class overview)'
          }
        },
        required: ['className', 'project']
      }
    },
    {
      name: 'resolve_import',
      description: 'Find import statements and module paths for symbols. Searches documentation for how to import specific items.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          symbol: {
            type: 'string',
            description: 'Symbol to import (e.g., class name, function name)'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          includeRelated: {
            type: 'boolean',
            description: 'Include related symbols you might also need (default: true)'
          }
        },
        required: ['symbol', 'project']
      }
    },
    {
      name: 'get_pattern',
      description: 'Get recommended code patterns and recipes for common tasks. Returns complete examples with explanations.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          task: {
            type: 'string',
            description: 'Task or pattern to find (e.g., "deploy contract", "emit events", "signature verification")'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          includeVariations: {
            type: 'boolean',
            description: 'Include alternative approaches (default: true)'
          }
        },
        required: ['task', 'project']
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
        return await listProjectsTool(
          ListProjectsSchema.parse(parsedArgs)
        );

      case 'search_documentation':
        return await searchDocumentation(
          SearchDocumentationSchema.parse(parsedArgs),
          context
        );

      case 'get_code_examples':
        return await getCodeExamples(
          GetCodeExamplesSchema.parse(parsedArgs),
          context
        );

      case 'explain_concept':
        return await explainConcept(
          ExplainConceptSchema.parse(parsedArgs),
          context
        );

      case 'debug_helper':
        return await debugHelper(
          DebugHelperSchema.parse(parsedArgs),
          context
        );

      case 'get_api_signature':
        return await getApiSignature(
          GetApiSignatureSchema.parse(parsedArgs),
          context
        );

      case 'resolve_import':
        return await resolveImport(
          ResolveImportSchema.parse(parsedArgs),
          context
        );

      case 'get_pattern':
        return await getPattern(
          GetPatternSchema.parse(parsedArgs),
          context
        );

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
