# Crypto Documentation MCP Server

A Model Context Protocol (MCP) server that provides blockchain developer documentation to AI coding agents like Claude Code and Cursor. Supports multiple crypto projects including Mina Protocol, Solana, and Cosmos SDK, enabling web3 developers to get contextual documentation, code examples, and debugging assistance.

## Features

- **Multi-Project Support**: Query documentation from Mina, Solana, Cosmos, and more
- **Semantic Search**: Find relevant documentation using natural language queries with hybrid vector + full-text search
- **Code Examples**: Retrieve code snippets by topic from documentation and source code
- **Concept Explanations**: Understand project-specific terminology and concepts
- **Debug Helper**: Get troubleshooting guidance for common errors
- **API Signatures**: Look up class and method documentation
- **Import Resolution**: Find import statements and module paths
- **Code Patterns**: Get recommended patterns and recipes for common tasks

## Supported Projects

| Project | Documentation | Source Code |
|---------|--------------|-------------|
| Mina Protocol | docs.minaprotocol.com | o1-labs/o1js |
| Solana | solana.com/docs | solana-labs/solana |
| Cosmos SDK | docs.cosmos.network | cosmos/cosmos-sdk |

Add more projects by creating a configuration file in `config/projects/`.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Document       │────▶│  Database Layer  │◀────│  MCP HTTP       │
│  Scraper        │     │  (Qdrant + FTS)  │     │  Server         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        ▼                       │                        ▼
  Project Configs               ▼               ┌─────────────────┐
  (config/projects/)      Vector + SQLite      │  Coding Agents  │
                         (project-filtered)    │  (Claude, etc.) │
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

### 5. Index Documentation

List available projects:
```bash
node packages/scraper/dist/index.js --list
```

Scrape a specific project:
```bash
# Index Mina Protocol docs
node packages/scraper/dist/index.js --project mina

# Index Solana docs
node packages/scraper/dist/index.js --project solana

# Index Cosmos SDK docs
node packages/scraper/dist/index.js --project cosmos
```

This will:
- Crawl the project's documentation site
- Parse and chunk the content
- Generate embeddings via OpenAI
- Store in Qdrant (vector) and SQLite (full-text) with project tags

**Note**: First run takes 5-10 minutes per project and costs ~$0.10-0.20 in OpenAI API calls.

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

# List available projects
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_projects","arguments":{}},"id":2}'

# Search documentation (specify project)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_documentation","arguments":{"query":"how to deploy","project":"mina"}},"id":3}'
```

## Available MCP Tools

All tools (except `list_projects`) require a `project` parameter to specify which documentation to search.

| Tool | Description | Example Arguments |
|------|-------------|-------------------|
| `list_projects` | List available documentation projects | `{}` |
| `search_documentation` | Hybrid semantic/keyword search | `{"query": "state management", "project": "mina"}` |
| `get_code_examples` | Find code snippets by topic | `{"topic": "smart contract", "project": "solana"}` |
| `explain_concept` | Explain project terminology | `{"concept": "IBC", "project": "cosmos"}` |
| `debug_helper` | Troubleshoot errors | `{"error": "proof verification failed", "project": "mina"}` |
| `get_api_signature` | Look up API documentation | `{"className": "Field", "project": "mina"}` |
| `resolve_import` | Find import statements | `{"symbol": "Pubkey", "project": "solana"}` |
| `get_pattern` | Get code patterns and recipes | `{"task": "deploy contract", "project": "mina"}` |

## Adding New Projects

Create a new JSON file in `config/projects/`:

```json
{
  "id": "myproject",
  "name": "My Project",
  "docs": {
    "baseUrl": "https://docs.myproject.com",
    "excludePatterns": ["/api/", "/changelog/"],
    "maxPages": 200
  },
  "github": {
    "repo": "org/myproject",
    "branch": "main",
    "include": ["src/**/*.ts"],
    "exclude": ["**/*.test.ts"]
  },
  "crawler": {
    "concurrency": 5,
    "delayMs": 500
  }
}
```

Then run the scraper:
```bash
node packages/scraper/dist/index.js --project myproject
```

## Integration with AI Coding Agents

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "crypto-docs": {
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
crypto-docs-mcp/
├── config/
│   └── projects/         # Project configuration files
│       ├── mina.json
│       ├── solana.json
│       └── cosmos.json
├── packages/
│   ├── shared/           # Types, DB clients, search logic
│   │   ├── src/
│   │   │   ├── config/   # Project config loading
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
│   │   │   ├── github-source.ts
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
├── docker-compose.yml    # Qdrant setup
└── package.json          # Monorepo root
```

## Development

```bash
# Build all packages
npm run build

# List available projects
node packages/scraper/dist/index.js --list

# Index a project
node packages/scraper/dist/index.js --project mina

# Start server
npm run server

# Start server in dev mode (with watch)
npm run dev:server
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | OpenAI API key for embeddings |
| `MCP_PORT` | 3000 | Server port |
| `MCP_HOST` | localhost | Server host |
| `QDRANT_URL` | http://localhost:6333 | Qdrant URL |
| `QDRANT_COLLECTION` | crypto_docs | Qdrant collection name |
| `SQLITE_PATH` | ./data/crypto_docs.db | SQLite database path |
| `GITHUB_TOKEN` | (optional) | GitHub token for higher API rate limits |

## How It Works

1. **Project Config** defines documentation URL, GitHub repo, and crawler settings
2. **Scraper** crawls the documentation site for a specific project
3. **Parser** converts HTML to structured chunks (prose, code, API reference)
4. **GitHub Source** fetches and parses source code (TypeScript, Rust, Go)
5. **Chunker** splits large content with semantic overlap
6. **Embeddings** are generated via OpenAI text-embedding-3-small
7. **Qdrant** stores vectors for semantic search (with project tags)
8. **SQLite FTS5** provides fast full-text search (with project filtering)
9. **Hybrid Search** combines both using Reciprocal Rank Fusion
10. **MCP Server** exposes tools via JSON-RPC over HTTP

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
node packages/scraper/dist/index.js --project mina
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

### "No projects configured"
Make sure project JSON files exist in `config/projects/` directory.

## License

MIT

## Resources

- [Model Context Protocol](https://modelcontextprotocol.io)
- [Mina Protocol Documentation](https://docs.minaprotocol.com)
- [Solana Documentation](https://solana.com/docs)
- [Cosmos SDK Documentation](https://docs.cosmos.network)
