# Project Onboarding Guide

This guide explains how to add new blockchain documentation projects to crypto-docs-mcp using the `/onboard_project` slash command.

## Quick Start

Run the slash command in Claude Code:

```
/onboard_project
```

The interactive wizard will guide you through the entire process.

## What Gets Created

When you onboard a new project, the wizard creates:

| File | Purpose |
|------|---------|
| `config/projects/<project-id>.json` | Main project configuration |
| `config/sources/<source-id>.json` | GitHub source configs (one per repo) |
| `config/sources/project-sources.json` | Updated mapping file |

## Step-by-Step Walkthrough

### 1. Project Name

Provide the display name for your project:

```
What is the name of the project you want to add?

> Avalanche
```

This is what users will see in tool descriptions and search results.

### 2. Project ID

The wizard auto-generates an ID from the name:

```
I'll use "avalanche" as the project ID.
Is this okay? (or type a different ID)

> yes
```

**Project ID rules:**
- Lowercase letters, numbers, and dashes only
- Must start with a letter
- Examples: `avalanche`, `pirate-chain`, `secret-network`

### 3. Documentation URL

Provide the base URL for the project's documentation:

```
What is the documentation URL?

> https://docs.avax.network
```

The scraper will crawl from this URL and follow internal links.

### 4. Scraping Settings

Configure how the documentation is crawled:

```
Does the site use Cloudflare protection? (default: no)
> no

URL patterns to exclude? (default: /api/, /changelog/, /releases/)
> defaults

Maximum pages to crawl? (default: 200)
> 150
```

**When to enable Cloudflare mode:**
- If the site shows a "checking your browser" page
- If you get empty content during scraping
- Examples: Some Gitbook sites, protected wikis

**Common exclude patterns:**
- `/api/` - API reference (often auto-generated)
- `/changelog/` - Version history
- `/releases/` - Release notes
- `/blog/` - Blog posts (often not technical)
- `/v1/`, `/legacy/` - Old documentation versions

### 5. GitHub Sources (Optional)

Add repositories for code examples and SDK documentation:

```
Would you like to add GitHub repositories as sources?

> yes

Repository (org/repo format):
> ava-labs/avalanchego

Source ID (suggested: avalanche-avalanchego):
> avalanche-avalanchego

Repository type:
1. sdk - Official SDK/library code
2. example-repo - Example projects and demos
3. tutorial-repo - Tutorial content
4. ecosystem-lib - Community libraries

> 1

Trust level:
1. official - Official project repositories
2. verified-community - Verified community repos
3. community - General community content

> 1

Branch (default: main):
> main

Description:
> Official Avalanche node implementation

Add another GitHub source? (y/n)
> n
```

### 6. Verification

The wizard validates your configuration:

```
Project configuration created successfully!

Files created:
- config/projects/avalanche.json
- config/sources/avalanche-avalanchego.json
- config/sources/project-sources.json (updated)

Running verification...
✓ JSON syntax valid
✓ Project appears in scraper list

Would you like me to run the scraper now?
> yes
```

## Configuration Details

### Project Config Structure

`config/projects/<project-id>.json`:

```json
{
  "id": "avalanche",
  "name": "Avalanche",
  "docs": {
    "baseUrl": "https://docs.avax.network",
    "excludePatterns": ["/api/", "/changelog/", "/releases/"],
    "maxPages": 150,
    "useBrowser": false
  },
  "github": {
    "repo": "ava-labs/avalanchego",
    "branch": "main",
    "include": ["src/**/*.go", "examples/**/*"],
    "exclude": ["**/*_test.go", "**/test/**"]
  },
  "crawler": {
    "concurrency": 3,
    "delayMs": 1000
  }
}
```

### Source Config Structure

`config/sources/<source-id>.json`:

```json
{
  "id": "avalanche-avalanchego",
  "type": "github",
  "repoType": "sdk",
  "trustLevel": "official",
  "repo": "ava-labs/avalanchego",
  "branch": "main",
  "description": "Official Avalanche node implementation",
  "scrapeStrategy": {
    "exampleDirs": ["examples", "demos", "tutorials", "samples"],
    "exclude": ["**/*.test.*", "**/test/**"],
    "extensions": [".go", ".ts", ".js", ".rs", ".py"]
  },
  "qualityThresholds": {
    "minDocumentationScore": 30,
    "minLLMRelevanceScore": 50,
    "requireReadme": true
  }
}
```

### Repository Types Explained

| Type | Use For | Scrape Strategy |
|------|---------|-----------------|
| `sdk` | Core libraries, main codebase | Focus on `apiPaths` for targeted scraping |
| `example-repo` | Sample applications, starters | Scrape `exampleDirs` broadly |
| `tutorial-repo` | Step-by-step guides | Scrape tutorials with context |
| `ecosystem-lib` | Third-party tools | Higher quality thresholds |

### Trust Levels Explained

| Level | Quality Thresholds | README Required |
|-------|-------------------|-----------------|
| `official` | Lower (20/40) | No |
| `verified-community` | Standard (30/50) | Yes |
| `community` | Higher (40/60) | Yes |

## After Onboarding

### Run the Scraper

Index your new project's documentation:

```bash
npm run scraper -- --project <project-id>
```

Options:
- `--dry-run` - Preview what would be scraped without indexing
- `--github-only` - Only scrape GitHub sources, skip docs
- `--use-registry` - Use intelligent GitHub scraping with quality filtering

### Test with RAG Inspector

Verify the indexed content works:

```bash
npm run rag -- --project <project-id>
```

Or use the project-specific shortcut (if added):

```bash
npm run rag:<project-id>
```

### Add Evaluation Datasets (Optional)

Create test cases to measure quality:

```
packages/evaluator/datasets/<project-id>/
├── basic.yaml
├── intermediate.yaml
└── advanced.yaml
```

Example test case:

```yaml
name: "Avalanche Basic Tests"
project: avalanche
tests:
  - id: avax-basic-1
    name: "What is Avalanche consensus?"
    tool: crypto_ask_docs
    input:
      question: "How does Avalanche consensus work?"
      project: avalanche
    difficulty: basic
    validators:
      - type: contains_keywords
        keywords: ["consensus", "snowball", "DAG"]
      - type: confidence_above
        threshold: 70
```

### Update README (Optional)

Add your project to the supported projects table in `README.md`:

```markdown
| Project | Documentation | Status |
|---------|--------------|--------|
| ... | ... | ... |
| Avalanche | [docs.avax.network](https://docs.avax.network) | Active |
```

## Troubleshooting

### "Project ID already exists"

Choose a different ID or modify the existing project:

```
The project ID "avalanche" already exists.
Suggestions: "avalanche-docs", "avalanche-network", "avax"
```

### "URL unreachable"

The wizard warns but allows proceeding:

```
Warning: Could not reach https://docs.avax.network
This might be temporary. Proceed anyway? (y/n)
```

Check:
- URL is correct (https, no typos)
- Site is accessible in your browser
- VPN/firewall isn't blocking

### "Cloudflare protection detected"

If scraping returns empty content:

1. Edit `config/projects/<project-id>.json`
2. Set `"useBrowser": true` in the `docs` section
3. Re-run the scraper

### "GitHub repo not found"

The wizard warns but allows proceeding:

```
Warning: Repository "org/repo" not found on GitHub
You can add it later. Proceed? (y/n)
```

Check:
- Repository is public
- Format is correct: `org/repo` (not full URL)
- Repository exists and isn't private

## Manual Configuration

If you prefer to create configs manually instead of using the wizard:

### 1. Create Project Config

```bash
cp config/projects/mina.json config/projects/<new-project>.json
# Edit the file with your project's details
```

### 2. Create Source Configs

```bash
cp config/sources/mina-o1js-official.json config/sources/<new-source>.json
# Edit the file with your source's details
```

### 3. Update Project-Sources Mapping

Edit `config/sources/project-sources.json`:

```json
[
  // ... existing entries ...
  {
    "projectId": "<new-project>",
    "sources": ["<source-id-1>", "<source-id-2>"]
  }
]
```

### 4. Verify

```bash
npm run scraper -- --list
# Should show your new project
```

## Reference

### File Locations

| Type | Location |
|------|----------|
| Project configs | `config/projects/<project-id>.json` |
| Source configs | `config/sources/<source-id>.json` |
| Source mapping | `config/sources/project-sources.json` |
| Evaluation datasets | `packages/evaluator/datasets/<project-id>/` |
| Templates | `.claude/skills/project-onboarding/` |

### Useful Commands

```bash
# List all projects
npm run scraper -- --list

# Scrape a project
npm run scraper -- --project <id>

# Scrape with dry run (preview)
npm run scraper -- --project <id> --dry-run

# Use intelligent GitHub scraping
npm run scraper -- --project <id> --use-registry

# Test with RAG inspector
npm run rag -- --project <id>

# Run evaluations
npm run eval -- --project <id>
```

### Schema Reference

For detailed schema information, see:
- `.claude/skills/project-onboarding/SKILL.md` - Validation rules
- `packages/shared/src/config/project-config.ts` - Project schema
- `packages/shared/src/config/source-registry.ts` - Source schema
