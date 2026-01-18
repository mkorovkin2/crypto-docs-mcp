# Documentation Indexing

This repo supports two main indexing flows:
- Web docs and GitHub sources via the scraper.
- Locally generated markdown docs (including docs-agent-v3 output) via the manual generated docs indexer.

The generated-docs flow uses the same chunking/embedding pipeline as web docs, so retrieval quality and adjacent-chunk expansion are consistent.

## Generated Docs Pipeline (Local Markdown)

Primary indexer: `packages/scraper/src/manual-generated-indexer.ts` (script: `npm run index:generated-docs`).

What it does:
- Recursively reads `.md`/`.mdx` files in a folder.
- Splits headings and code fences into chunks, then uses the shared chunker to add ordering metadata.
- Generates embeddings and upserts into Qdrant + SQLite.
- Uses content hashes to skip unchanged files and marks removed files as orphaned.

URL scheme:
- `generated-docs://<custom>/<relative-path>`
- `--custom` (or `--dir` basename) becomes the source id and URL prefix.

Required env vars:
- `OPENAI_API_KEY` (embeddings)
- `QDRANT_URL`, `QDRANT_COLLECTION`, `SQLITE_PATH` (optional overrides)

## docs-agent-v3 Integration

`docs-agent-v3` generates markdown docs from a local repo path. It does not clone repositories.

Wrapper (recommended):
```bash
npm run generate-and-index-docs -- --project <project-id> --repo /path/to/repo
```

This wrapper uses `ts-node` registration via `--import` (no experimental loader warnings on Node 25).

Split workflow:
```bash
npm run generate-and-index-docs -- --project <project-id> --repo /path/to/repo --generate-only
npm run generate-and-index-docs -- --project <project-id> --output docs/generated/<custom> --index-only
```

Manual indexing:
```bash
npm run index:generated-docs -- --project <project-id> --dir docs/generated/<custom> --custom <custom>
```

If you run the scripts directly, use:
```bash
node --import ./scripts/ts-node-register.js scripts/generate-and-index-docs.ts --help
```

## Relationship Preservation

Relationships are preserved in two ways:
- Chunk ordering metadata (`documentId`, `chunkIndex`, `totalChunks`) keeps sections adjacent for retrieval.
- `RELATIONSHIPS.md` captures explicit dependency/entry-point data for better graph-style queries.

`RELATIONSHIPS.md` is generated from the docs-agent-v3 handoff JSON:
```bash
node scripts/export-docs-relationships.js --output docs/generated/<custom>
```

The exporter reads `docs/generated/<custom>/.handoffs/module_analysis_handoff.json` and writes:
- Entry points
- Module summary
- Module dependency summary
- File-level dependency edges
- Key relationships, data flow hints, patterns

If the handoff JSON is missing (for example, when indexing pre-existing markdown not produced by docs-agent-v3), relationship export is skipped.

## Web Docs Pipeline (Reference)

Web docs and GitHub sources are indexed by the scraper (`npm run scraper`) which:
- Crawls HTML pages and parses content into chunks.
- Optionally indexes GitHub examples after quality evaluation.
- Writes to the same Qdrant + SQLite stores.

## Common Flags and Tips

`npm run generate-and-index-docs --` flags:
- `--generate-only` to skip indexing
- `--index-only` to index an existing docs folder
- `--skip-relationships` to skip `RELATIONSHIPS.md`
- `--skip-index` to only generate docs

Tips:
- If you want stable URLs, keep `--custom` consistent across runs.
- Prefer `docs/generated/<custom>` for generated docs to match existing flows.
- If you index only, ensure the output folder exists and includes markdown files.
