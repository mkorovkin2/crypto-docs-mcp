# Quick Start Guide

Get the Mina Docs MCP Server running locally in 5 minutes.

## Prerequisites

- Node.js 18+
- Docker
- OpenAI API key

## Steps

### 1. Install & Build

```bash
npm install
npm run build
```

### 2. Configure Environment

```bash
# Create .env from template
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-key-here

# Copy to package directories (required!)
cp .env packages/scraper/.env
cp .env packages/server/.env
```

### 3. Start Qdrant

```bash
docker-compose up -d

# Verify it's running
curl http://localhost:6333/health
```

### 4. Index Documentation

```bash
npm run scraper
```

This crawls docs.minaprotocol.com and indexes ~200 pages. Takes 5-10 minutes.

### 5. Start Server

```bash
npm run server
```

Server runs at `http://localhost:3000`.

### 6. Test It

```bash
# Health check
curl http://localhost:3000/health

# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Search docs
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_documentation","arguments":{"query":"how to create zkApp"}},"id":2}'
```

## Common Issues

| Issue | Solution |
|-------|----------|
| `OPENAI_API_KEY required` | Copy `.env` to `packages/scraper/` and `packages/server/` |
| `Qdrant connection failed` | Run `docker-compose up -d` |
| `Empty search results` | Run `npm run scraper` first |

## Next Steps

- See [README.md](./README.md) for full documentation
- Configure Claude Desktop or Cursor to use `http://localhost:3000/mcp`
