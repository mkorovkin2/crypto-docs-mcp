# Mina Docs MCP Server - Quick Start

## What Is This?

This is an **MCP (Model Context Protocol) server** that gives AI coding agents (like Claude Code, Cursor, etc.) intelligent access to Mina Protocol and o1js documentation.

Instead of an AI hallucinating API signatures or guessing how zkApps work, it can query this server for **accurate, up-to-date information**.

## Why Use This?

| Without MCP Server | With MCP Server |
|-------------------|-----------------|
| AI guesses `Field.add()` signature | AI gets exact: `add(y: Field \| bigint): Field` |
| AI hallucinates import statements | AI gets correct: `import { MerkleTree } from 'o1js'` |
| AI uses `if/else` in circuits (wrong!) | AI uses `Provable.if()` (correct) |
| AI invents deployment patterns | AI gets tested, working code patterns |

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  AI Coding      │────▶│  MCP Server     │────▶│  Vector DB      │
│  Agent          │◀────│  (this project) │◀────│  (Qdrant)       │
│  (Claude, etc.) │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Indexed Docs   │
                        │  - Mina docs    │
                        │  - o1js source  │
                        │  - API sigs     │
                        └─────────────────┘
```

1. **Scraper** crawls docs.minaprotocol.com and o1js GitHub source
2. **Embeddings** are generated via OpenAI and stored in Qdrant (vector DB)
3. **MCP Server** exposes tools that AI agents can call
4. **AI Agent** queries the server instead of guessing

## Available Tools

| Tool | Purpose | Example Query |
|------|---------|---------------|
| `search_documentation` | General doc search | "how to deploy a zkApp" |
| `get_code_examples` | Find code snippets | "MerkleTree usage" |
| `explain_concept` | Explain ZK concepts | "what is a Field" |
| `debug_helper` | Fix common errors | "assertion failed in circuit" |
| `get_api_signature` | Exact method signatures | "Field.add" |
| `resolve_import` | Correct imports | "MerkleTree" |
| `validate_zkapp_code` | Check code for mistakes | (paste code) |
| `get_pattern` | Get working code patterns | "merkle membership proof" |

## Quick Start

### Prerequisites

- Node.js 18+
- Docker
- OpenAI API key

### Setup (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example packages/server/.env
cp .env.example packages/scraper/.env
# Edit .env files and add your OPENAI_API_KEY

# 3. Start vector database
docker-compose up -d

# 4. Build the project
npm run build
```

### Index Documentation (~10 minutes)

```bash
npm run scraper
```

This crawls Mina docs and o1js source, generates embeddings, and stores them. Costs ~$0.10-0.20 in OpenAI API usage.

### Start the Server

```bash
npm run server
```

Server runs at `http://localhost:3000`

### Verify It Works

```bash
# Health check
curl http://localhost:3000/health

# Run demo
npm run demo

# Run tests
npm run test:integration
```

## Connect to Your AI Agent

### Claude Desktop / Claude Code

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "mina-docs": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Other MCP Clients

- **Endpoint:** `POST http://localhost:3000/mcp`
- **Protocol:** JSON-RPC 2.0
- **Content-Type:** `application/json`

### Example Request

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_api_signature",
      "arguments": { "className": "Field", "methodName": "add" }
    }
  }'
```

## Project Structure

```
crypto-docs-mcp/
├── packages/
│   ├── shared/          # Shared types, DB clients, search logic
│   ├── scraper/         # Documentation crawler + GitHub source scraper
│   └── server/          # MCP HTTP server + tools
├── scripts/
│   ├── demo.sh          # Interactive demo
│   └── test-integration.ts
├── docker-compose.yml   # Qdrant vector database
└── .env.example         # Environment template
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | For generating embeddings |
| `QDRANT_URL` | `http://localhost:6333` | Vector database URL |
| `MCP_PORT` | `3000` | Server port |
| `SCRAPE_GITHUB` | `true` | Also index o1js source code |

## Troubleshooting

### "Cannot connect to Qdrant"
```bash
docker-compose up -d
docker ps  # Verify qdrant is running
```

### "OPENAI_API_KEY required"
```bash
# Make sure .env exists in both packages
cat packages/server/.env
cat packages/scraper/.env
```

### "Empty search results"
```bash
# Re-run the scraper to index docs
npm run scraper
```

### Server won't start
```bash
# Rebuild
npm run build

# Check for errors
npm run server 2>&1
```

## Development

```bash
# Run server with auto-restart on changes
npm run dev:server

# Rebuild after code changes
npm run build
```

## Cost Estimate

- **Initial indexing:** ~$0.10-0.20 (one-time, for ~200 pages + source)
- **Per query:** ~$0.0001 (embedding for search query)

The server uses OpenAI's `text-embedding-3-small` model which is very cost-effective.

## License

MIT
