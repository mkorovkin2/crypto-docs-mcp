import express, { Request, Response } from 'express';
import { getToolDefinitions, handleToolCall, type ToolContext } from './tools/index.js';
import { getResourceDefinitions, handleResourceRead } from './resources/index.js';
import type { HybridSearch, FullTextDB, LLMClient, WebSearchClient } from '@mina-docs/shared';

interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

export interface TransportContext {
  search: HybridSearch;
  ftsDb: FullTextDB;
  llmClient: LLMClient;
  webSearch?: WebSearchClient;
}

export async function createHttpTransport(
  context: TransportContext,
  port: number,
  host: string
): Promise<void> {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // CORS headers for browser-based clients
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      server: 'crypto-docs-mcp',
      version: '2.0.0',
      features: ['llm-synthesis', 'reranking'],
      endpoints: {
        mcp: '/mcp',
        health: '/health'
      }
    });
  });

  // MCP JSON-RPC endpoint
  app.post('/mcp', async (req: Request, res: Response) => {
    const request = req.body as JSONRPCRequest;

    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request: must be JSON-RPC 2.0' },
        id: request.id ?? null
      });
    }

    try {
      const result = await handleMCPRequest(context, request);
      res.json(result);
    } catch (error) {
      console.error('MCP request error:', error);
      res.json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        },
        id: request.id ?? null
      });
    }
  });

  // SSE endpoint for streaming (future use)
  app.get('/mcp/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connected event
    res.write(`event: connected\ndata: {"status": "connected"}\n\n`);

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  });

  return new Promise<void>((resolve) => {
    app.listen(port, host, () => {
      console.error(`\nMCP server running at http://${host}:${port}`);
      console.error(`  Health check: http://${host}:${port}/health`);
      console.error(`  MCP endpoint: http://${host}:${port}/mcp`);
      resolve();
    });
  });
}

async function handleMCPRequest(
  context: TransportContext,
  request: JSONRPCRequest
): Promise<JSONRPCResponse> {
  const { method, params, id } = request;
  const toolContext: ToolContext = {
    search: context.search,
    ftsDb: context.ftsDb,
    llmClient: context.llmClient,
    webSearch: context.webSearch
  };

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {}
          },
          serverInfo: {
            name: 'crypto-docs-mcp',
            version: '2.0.0'
          }
        },
        id: id ?? null
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        result: { tools: getToolDefinitions() },
        id: id ?? null
      };

    case 'tools/call':
      const toolResult = await handleToolCall(
        params?.name,
        params?.arguments,
        toolContext
      );
      return {
        jsonrpc: '2.0',
        result: toolResult,
        id: id ?? null
      };

    case 'resources/list':
      return {
        jsonrpc: '2.0',
        result: { resources: getResourceDefinitions() },
        id: id ?? null
      };

    case 'resources/read':
      const resourceResult = await handleResourceRead(
        params?.uri,
        { ftsDb: context.ftsDb }
      );
      return {
        jsonrpc: '2.0',
        result: resourceResult,
        id: id ?? null
      };

    case 'ping':
      return {
        jsonrpc: '2.0',
        result: {},
        id: id ?? null
      };

    case 'notifications/initialized':
      // Client notification that initialization is complete
      return {
        jsonrpc: '2.0',
        result: {},
        id: id ?? null
      };

    default:
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        },
        id: id ?? null
      };
  }
}
