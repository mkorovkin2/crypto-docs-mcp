---
name: project-onboarding
description: Templates and knowledge for onboarding new blockchain documentation projects to the crypto-docs-mcp system
---

# Project Onboarding Skill

This skill provides templates, validation rules, and knowledge for onboarding new blockchain documentation projects.

## Templates

### Project Configuration Template
**File**: `project-template.json`
**Target**: `config/projects/<project-id>.json`

Required placeholders:
- `{{PROJECT_ID}}` - Lowercase alphanumeric with dashes (e.g., "pirate-chain")
- `{{PROJECT_NAME}}` - Display name (e.g., "Pirate Chain")
- `{{DOCS_URL}}` - Documentation base URL (e.g., "https://docs.piratechain.com")
- `{{GITHUB_ORG}}` - GitHub organization (e.g., "PirateNetwork")
- `{{GITHUB_REPO}}` - GitHub repository name (e.g., "pirate")

### Source Configuration Template
**File**: `source-template.json`
**Target**: `config/sources/<source-id>.json`

Required placeholders:
- `{{SOURCE_ID}}` - Format: `<project-id>-<source-name>` (e.g., "mina-o1js-official")
- `{{REPO_TYPE}}` - One of: "sdk", "example-repo", "tutorial-repo", "ecosystem-lib"
- `{{TRUST_LEVEL}}` - One of: "official", "verified-community", "community"
- `{{GITHUB_ORG}}` - GitHub organization
- `{{GITHUB_REPO}}` - GitHub repository name
- `{{SOURCE_DESCRIPTION}}` - Brief description of the source

## Validation Rules

### Project ID Format
- Must be lowercase alphanumeric with dashes only
- Must start with a letter
- Pattern: `/^[a-z][a-z0-9-]*$/`
- Valid examples: `mina`, `pirate-chain`, `cosmos-sdk`
- Invalid examples: `Mina`, `pirate_chain`, `123chain`

### Source ID Format
- Must follow pattern: `<project-id>-<source-name>`
- Source name should be descriptive
- Valid examples: `mina-o1js-official`, `pirate-piratepay`, `solana-spl-official`

### Repository Types
| Type | Description | Use Case |
|------|-------------|----------|
| `sdk` | Official SDK/library code | Core libraries, main codebase |
| `example-repo` | Example projects and demos | Sample applications, starter templates |
| `tutorial-repo` | Tutorial content | Step-by-step guides, learning resources |
| `ecosystem-lib` | Community/ecosystem libraries | Third-party tools, integrations |

### Trust Levels
| Level | Description | Quality Thresholds |
|-------|-------------|-------------------|
| `official` | Official project repositories | Lower thresholds (20/40), README optional |
| `verified-community` | Verified community contributions | Standard thresholds (30/50), README required |
| `community` | General community content | Higher thresholds (40/60), README required |

### URL Validation
- Must be valid HTTPS URL
- Should be reachable (warning only, not blocking)
- Should not redirect to completely different domain

### GitHub Repository Validation
- Format: `org/repo` (e.g., "o1-labs/o1js")
- Should exist on GitHub (warning only, not blocking)

## File Locations After Onboarding

After successfully onboarding a project, these files should exist:

```
config/
├── projects/
│   └── <project-id>.json          # Project configuration
└── sources/
    ├── <source-id-1>.json         # Source config for each GitHub source
    ├── <source-id-2>.json
    └── project-sources.json       # Updated with new project mapping
```

## Project-Sources Mapping Format

When updating `config/sources/project-sources.json`, add an entry like:

```json
{
  "projectId": "<project-id>",
  "sources": ["<source-id-1>", "<source-id-2>"]
}
```

## Common Configuration Patterns

### For Cloudflare-Protected Sites
Set `useBrowser: true` in project config:
```json
{
  "docs": {
    "useBrowser": true
  }
}
```

### For SDK Repositories
Use `apiPaths` in source config for targeted scraping:
```json
{
  "repoType": "sdk",
  "scrapeStrategy": {
    "apiPaths": ["src/lib/**/*.ts", "src/core/**/*.ts"],
    "exampleDirs": ["examples"]
  },
  "qualityThresholds": {
    "minDocumentationScore": 20,
    "requireReadme": false
  }
}
```

### For Example Repositories
Focus on example directories:
```json
{
  "repoType": "example-repo",
  "scrapeStrategy": {
    "exampleDirs": ["examples", "demos", "tutorials", "samples"],
    "extensions": [".ts", ".tsx", ".js", ".jsx"]
  }
}
```

## Next Steps After Onboarding

1. **Review configuration files** - Verify the generated configs look correct
2. **Run the scraper** - `npm run scraper -- --project <project-id>`
3. **Test with RAG inspector** - `npm run rag -- --project <project-id>`
4. **(Optional) Create evaluation datasets** - Add YAML test files in `packages/evaluator/datasets/<project-id>/`
5. **(Optional) Update README** - Add project to the supported projects table
