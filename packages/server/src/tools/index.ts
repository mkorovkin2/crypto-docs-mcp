import { searchDocumentation, SearchDocumentationSchema } from './search.js';
import { getCodeExamples, GetCodeExamplesSchema } from './examples.js';
import { explainConcept, ExplainConceptSchema } from './explain.js';
import { debugHelper, DebugHelperSchema } from './debug.js';
import type { HybridSearch, FullTextDB } from '@mina-docs/shared';

export interface ToolContext {
  search: HybridSearch;
  ftsDb: FullTextDB;
}

export function getToolDefinitions() {
  return [
    {
      name: 'search_documentation',
      description: 'Search Mina Protocol documentation using semantic and keyword search. Returns relevant documentation sections, tutorials, and API references. Use this for general documentation queries.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query - can be a question, keyword, or concept (e.g., "how to deploy a zkApp", "state management", "Merkle tree")'
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
        required: ['query']
      }
    },
    {
      name: 'get_code_examples',
      description: 'Find code examples for Mina/o1js development. Returns TypeScript code snippets for zkApps, smart contracts, proofs, and common patterns. Best for finding implementation examples.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          topic: {
            type: 'string',
            description: 'Topic to find examples for (e.g., "SmartContract", "Poseidon hash", "deploy zkApp", "MerkleTree", "state management")'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of examples to return (default: 3)'
          }
        },
        required: ['topic']
      }
    },
    {
      name: 'explain_concept',
      description: 'Get explanations of Mina Protocol and zero-knowledge concepts. Useful for understanding ZK terminology, protocol mechanics, and o1js features. Returns definitions and context.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          concept: {
            type: 'string',
            description: 'Concept to explain (e.g., "zkSNARK", "SmartContract", "Provable types", "Field", "Poseidon", "MerkleTree")'
          },
          depth: {
            type: 'string',
            enum: ['brief', 'detailed'],
            description: 'Level of detail - "brief" for quick definition, "detailed" for comprehensive explanation with examples (default: brief)'
          }
        },
        required: ['concept']
      }
    },
    {
      name: 'debug_helper',
      description: 'Get help debugging common Mina/o1js errors and issues. Provide the error message to get troubleshooting guidance, common causes, and solutions.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          error: {
            type: 'string',
            description: 'Error message or description of the issue you\'re encountering'
          },
          context: {
            type: 'string',
            description: 'Additional context about what you were trying to do (optional but helpful)'
          }
        },
        required: ['error']
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
