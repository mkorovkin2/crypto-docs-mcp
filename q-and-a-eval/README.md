# IDEA Processor

A TypeScript script that processes question files, routes them to MCP tools, and scores the answers using AI.

## What It Does

1. **Scans for IDEA files** - Finds all files starting with `IDEA_` in a configured directory
2. **Extracts questions** - Uses xAI Grok to parse each file and extract explicit questions
3. **Routes to MCP tools** - For each question, uses Grok to select the most appropriate MCP tool and constructs the parameters
4. **Calls MCP tools** - Executes the selected tool via your MCP server
5. **Scores answers** - Uses OpenAI GPT-5 to evaluate answer quality across multiple dimensions
6. **Logs everything** - Stores all tool calls, inputs, outputs, and scores in a SQLite database

## Prerequisites

- Node.js 18+
- An MCP server running locally (or accessible via HTTP)
- xAI API key (for Grok)
- OpenAI API key (for GPT-5)

## Quickstart

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# API Keys (REQUIRED)
XAI_API_KEY=your_xai_api_key
OPENAI_API_KEY=your_openai_api_key

# MCP Server (REQUIRED)
MCP_ENDPOINT=http://localhost:3000

# Paths (REQUIRED)
IDEAS_DIRECTORY=./ideas
DATABASE_PATH=./idea_processor.db
```

### 3. Add your IDEA files

Create files starting with `IDEA_` in your configured directory:

```bash
# Example: ideas/IDEA_research.md
echo "What is the best way to implement caching?
How do websockets work?
What are the tradeoffs of microservices?" > ideas/IDEA_research.md
```

### 4. Start your MCP server

Make sure your MCP server is running at the configured endpoint.

### 5. Run the processor

```bash
npm run dev
```

## Output

### Console Logs (Color-Coded)

- **DEBUG** (gray) - Raw API responses, internal details
- **INFO** (cyan) - General flow information
- **WARN** (yellow) - No tool match, continuing after errors
- **ERROR** (red) - Failures
- **SUCCESS** (green) - Completions, recorded entries

### SQLite Database

Two tables are created:

**`tool_calls`** - Records every question processed
| Column | Description |
|--------|-------------|
| `id` | Unique call ID |
| `question_text` | The extracted question |
| `tool_name` | MCP tool used (or `NO_TOOL_MATCH`) |
| `tool_params` | Tool's input schema |
| `tool_input` | Parameters passed to the tool |
| `tool_output` | Response from the tool |
| `source_file` | Which IDEA file it came from |
| `timestamp` | When it was processed |

**`scores`** - Quality scores for each answer
| Column | Description |
|--------|-------------|
| `id` | Unique score ID |
| `call_id` | Links to tool_calls.id |
| `comprehensive` | -1, 0, 1 (or -2 if no tool) |
| `detailed` | -1, 0, 1 (or -2 if no tool) |
| `confident` | -1, 0, 1 (or -2 if no tool) |
| `too_long` | -1, 0, 1 (or -2 if no tool) |
| `too_short` | -1, 0, 1 (or -2 if no tool) |
| `fully_answered` | -1, 0, 1 (or -2 if no tool) |
| `overall_score` | -1, 0, 1 (or -2 if no tool) |
| `timestamp` | When it was scored |

**Score meanings:**
- `-2` = Not applicable (no matching tool found)
- `-1` = Poor/negative
- `0` = Neutral/acceptable
- `1` = Good/positive

## Customizing Prompts

Edit `prompts.ts` to customize how the AI behaves:

- `QUESTION_EXTRACTION_SYSTEM_PROMPT` - How Grok extracts questions
- `TOOL_SELECTION_SYSTEM_PROMPT` - How Grok selects MCP tools
- `ANSWER_SCORING_SYSTEM_PROMPT` - How GPT-5 scores answers

## Querying Results

```bash
# View all tool calls
sqlite3 idea_processor.db "SELECT * FROM tool_calls"

# View scores
sqlite3 idea_processor.db "SELECT * FROM scores"

# Join for full picture
sqlite3 idea_processor.db "
  SELECT tc.question_text, tc.tool_name, s.overall_score, s.fully_answered
  FROM tool_calls tc
  JOIN scores s ON tc.id = s.call_id
"

# Find questions with no matching tool
sqlite3 idea_processor.db "
  SELECT question_text, tool_output
  FROM tool_calls
  WHERE tool_name = 'NO_TOOL_MATCH'
"
```

## Database Viewer CLI

A separate color-coded CLI is included to explore the SQLite database.

Build once, then run:

```bash
npm run build
node dist/idea-db.js
```

Common commands:

```bash
node dist/idea-db.js overview
node dist/idea-db.js tables
node dist/idea-db.js schema tool_calls
node dist/idea-db.js rows tool_calls 5
node dist/idea-db.js search tool_calls tool_name "mcp"
node dist/idea-db.js agg tools
node dist/idea-db.js agg scores
node dist/idea-db.js agg quality
node dist/idea-db.js agg files
node dist/idea-db.js agg errors
node dist/idea-db.js agg days
node dist/idea-db.js --db /path/to/idea_processor.db stats
```

Use `--json` for machine output and `--full` to disable cell truncation.
Aggregations treat `-2` scores as missing and ignore them in averages/distributions.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run directly with tsx (no build) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run compiled JavaScript |
| `npm run db` | Run the database viewer CLI (build first) |
