# Mina Protocol Documentation MCP Server

A Model Context Protocol (MCP) server that provides Mina Protocol developer documentation to AI coding agents like Claude Code and Cursor. This enables web3 developers to get contextual documentation, code examples, and debugging assistance while building zkApps.

## Features

- **Semantic Search**: Find relevant documentation using natural language queries with hybrid vector + full-text search
- **Code Examples**: Retrieve o1js/zkApp TypeScript code snippets by topic
- **Concept Explanations**: Understand ZK and Mina-specific terminology (zkSNARK, Provable types, etc.)
- **Debug Helper**: Get troubleshooting guidance for common Mina/o1js errors

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Document       │────▶│  Database Layer  │◀────│  MCP HTTP       │
│  Scraper        │     │  (Qdrant + FTS)  │     │  Server         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        │                       │                        ▼
        ▼                       ▼               ┌─────────────────┐
  docs.minaprotocol.com   Vector + SQLite      │  Coding Agents  │
                                                │  (Claude, etc.) │
                                                └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for Qdrant vector database)
- OpenAI API key (for embeddings)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your OpenAI API key:
```
OPENAI_API_KEY=sk-your-api-key-here
```

**Important:** Copy `.env` to each package directory (npm workspaces run from package directories):
```bash
cp .env packages/scraper/.env
cp .env packages/server/.env
```

### 3. Start Qdrant (Vector Database)

```bash
docker-compose up -d
```

Verify it's running:
```bash
curl http://localhost:6333/health
```

### 4. Build the Project

```bash
npm run build
```

### 5. Index the Documentation

Run the scraper to crawl and index Mina documentation:

```bash
npm run scraper
```

This will:
- Crawl docs.minaprotocol.com (up to 200 pages by default)
- Parse and chunk the content
- Generate embeddings via OpenAI
- Store in Qdrant (vector) and SQLite (full-text)

**Note**: First run takes 5-10 minutes and costs ~$0.10-0.20 in OpenAI API calls.

### 6. Start the MCP Server

```bash
npm run server
```

The server runs at `http://localhost:3000` by default.

### 7. Test the Server

```bash
# Health check
curl http://localhost:3000/health

# List available tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Search documentation
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_documentation","arguments":{"query":"how to deploy zkApp"}},"id":2}'
```

## Available MCP Tools

| Tool | Description | Example Query |
|------|-------------|---------------|
| `search_documentation` | Hybrid semantic/keyword search | "how to manage state in zkApps" |
| `get_code_examples` | Find code snippets by topic | "SmartContract", "Poseidon hash" |
| `explain_concept` | Explain ZK/Mina terminology | "zkSNARK", "Provable types" |
| `debug_helper` | Troubleshoot errors | "proof verification failed" |

## Integration with AI Coding Agents

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mina-docs": {
      "url": "http://localhost:3000/mcp",
      "transport": "http"
    }
  }
}
```

### Cursor

Configure MCP in Cursor settings with the HTTP endpoint:
```
http://localhost:3000/mcp
```

### Claude Code CLI

The server works with any MCP-compatible client via the HTTP endpoint.

## Project Structure

```
mina-docs-mcp/
├── packages/
│   ├── shared/           # Types, DB clients, search logic
│   │   ├── src/
│   │   │   ├── db/       # Qdrant & SQLite clients
│   │   │   ├── types.ts  # Shared TypeScript types
│   │   │   ├── search.ts # Hybrid search implementation
│   │   │   └── embeddings.ts
│   │   └── package.json
│   ├── scraper/          # Documentation crawler
│   │   ├── src/
│   │   │   ├── crawler.ts
│   │   │   ├── parser.ts
│   │   │   ├── chunker.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── server/           # MCP HTTP server
│       ├── src/
│       │   ├── tools/    # MCP tool implementations
│       │   ├── resources/
│       │   ├── transport.ts
│       │   └── index.ts
│       └── package.json
├── data/                 # SQLite database storage
├── scripts/              # Test scripts
├── examples/             # Configuration examples
├── docker-compose.yml    # Qdrant setup
└── package.json          # Monorepo root
```

## Development

```bash
# Build all packages
npm run build

# Run scraper to index documentation
npm run scraper

# Start server
npm run server

# Start server in dev mode (with watch)
npm run dev:server

# Run integration tests (requires server running)
npm run test:integration
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | OpenAI API key for embeddings |
| `MCP_PORT` | 3000 | Server port |
| `MCP_HOST` | localhost | Server host |
| `QDRANT_URL` | http://localhost:6333 | Qdrant URL |
| `QDRANT_COLLECTION` | mina_docs | Qdrant collection name |
| `SQLITE_PATH` | ./data/mina_docs.db | SQLite database path |
| `SCRAPER_BASE_URL` | https://docs.minaprotocol.com | Documentation URL |
| `SCRAPER_MAX_PAGES` | 200 | Max pages to crawl |
| `SCRAPER_DELAY_MS` | 1000 | Delay between requests |

## How It Works

1. **Scraper** crawls docs.minaprotocol.com and extracts content
2. **Parser** converts HTML to structured chunks (prose, code, API reference)
3. **Chunker** splits large content with semantic overlap
4. **Embeddings** are generated via OpenAI text-embedding-3-small
5. **Qdrant** stores vectors for semantic search
6. **SQLite FTS5** provides fast full-text search
7. **Hybrid Search** combines both using Reciprocal Rank Fusion
8. **MCP Server** exposes tools via JSON-RPC over HTTP

## Troubleshooting

### Qdrant Connection Failed
```bash
# Make sure Docker is running
docker-compose up -d

# Check Qdrant health
curl http://localhost:6333/health
```

### Empty Search Results
Run the scraper first to index documentation:
```bash
npm run scraper
```

### OpenAI API Errors
Verify your API key is set correctly in `.env`:
```bash
echo $OPENAI_API_KEY
```

### "OPENAI_API_KEY environment variable is required"
The `.env` file must be present in the package directory being run. Copy it to both:
```bash
cp .env packages/scraper/.env
cp .env packages/server/.env
```

## License

MIT

## Resources

- [Mina Protocol Documentation](https://docs.minaprotocol.com)
- [o1js GitHub](https://github.com/o1-labs/o1js)
- [Model Context Protocol](https://modelcontextprotocol.io)
