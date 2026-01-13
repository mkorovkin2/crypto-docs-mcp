# RAG Testing per Project

Use the RAG Inspector CLI to validate retrieval quality for each onboarded project separately. The commands below let you target a single project (e.g., only Polymarket).

## Prerequisites
- Dependencies installed (`npm install`) and `.env` copied into `packages/server/.env` and `packages/scraper/.env` with `OPENAI_API_KEY` set.
- Qdrant and SQLite available (`docker-compose up -d` from the repo root).
- The project you want to test is indexed (run `npm run scraper -- --project <id>` first; for Polymarket generated docs, use `npm run index:generated-docs -- --project polymarket --dir docs/generated/Polymarket-Kalshi-Arbitrage-bot`).
- MCP server running in a separate terminal: `npm run server` (health check: `curl http://localhost:3000/health` should return `{"status":"ok"}`).

## Run the RAG Inspector for a single project
From the repo root, run one of the commands below to start the inspector with the desired project pre-selected:

| Project | Command |
|---------|---------|
| Mina (`mina`) | `npm run rag:mina` |
| Solana (`solana`) | `npm run rag:solana` |
| Cosmos SDK (`cosmos`) | `npm run rag:cosmos` |
| Secret Network (`secret`) | `npm run rag:secret` |
| Beam (`beam`) | `npm run rag:beam` |
| Pirate Chain (`pirate-chain`) | `npm run rag:pirate-chain` |
| Polymarket (`polymarket`) | `npm run rag:polymarket` |

If you prefer the generic form, use `npm run rag -- --project <id>` for any onboarded project ID (e.g., `npm run rag -- --project polymarket`).

## Quick usage once inside the inspector
- Ask a question: `ask How do I place a CLOB order on Polymarket?`
- Switch projects on the fly: `project polymarket` (or any ID from the table).
- View history and metadata: `history`, then `detail 1` to drill into a run.
- Exit: `quit`

Focus on the metadata block to confirm retrieval quality, corrective RAG retries, sources used, and timing for the specific project you are validating.
