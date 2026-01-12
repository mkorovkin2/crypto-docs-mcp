---
date: 2026-01-11T12:00:00-05:00
topic: "Polymarket Documentation Onboarding Compatibility"
tags: [research, codebase, onboarding, polymarket, slash-commands]
status: complete
last_updated: 2026-01-11
---

# Research: Polymarket Documentation Onboarding Compatibility

**Date**: 2026-01-11T12:00:00-05:00

## Research Question
Will the existing slash commands work for onboarding Polymarket docs onto the crypto-docs-mcp system?

## Summary

**Yes, the existing `/onboard_project` slash command will work for Polymarket docs.** The system is designed for blockchain documentation projects, but the underlying mechanics are generic and will work for any project with:
1. A documentation website
2. Optional GitHub repositories with code examples

Polymarket has both:
- **Docs**: https://docs.polymarket.com (CLOB API), https://learn.polymarket.com (general)
- **GitHub**: `Polymarket/py-clob-client` (Python SDK), `Polymarket/clob-client` (TypeScript SDK)

## Detailed Findings

### The `/onboard_project` Command

**Location**: `.claude/commands/onboard_project.md`

The command is an interactive wizard that:
1. Gathers basic project info (name, ID, docs URL)
2. Configures documentation scraping settings (Cloudflare protection, URL exclusions, max pages)
3. Optionally sets up GitHub source repositories
4. Creates configuration files
5. Validates and provides next steps

### What Gets Created

When you run `/onboard_project`, it creates:
- `config/projects/polymarket.json` - Project configuration
- `config/sources/polymarket-*.json` - GitHub source configs (if added)
- Updates `config/sources/project-sources.json` - Maps project to sources

### Template Structure

**Project Config Template** (`.claude/skills/project-onboarding/project-template.json`):
```json
{
  "id": "{{PROJECT_ID}}",
  "name": "{{PROJECT_NAME}}",
  "docs": {
    "baseUrl": "{{DOCS_URL}}",
    "excludePatterns": ["/api/", "/changelog/", "/releases/"],
    "maxPages": 200,
    "useBrowser": false
  },
  "github": { ... },
  "crawler": { "concurrency": 3, "delayMs": 1000 }
}
```

### Recommended Polymarket Configuration

Based on the system architecture, here's what the Polymarket onboarding would look like:

**Project Config** (`config/projects/polymarket.json`):
```json
{
  "id": "polymarket",
  "name": "Polymarket",
  "docs": {
    "baseUrl": "https://docs.polymarket.com",
    "excludePatterns": ["/api/", "/changelog/"],
    "maxPages": 200,
    "useBrowser": false
  },
  "crawler": {
    "concurrency": 3,
    "delayMs": 1000
  }
}
```

**GitHub Sources** to add:
| Source ID | Repository | Type | Trust |
|-----------|------------|------|-------|
| `polymarket-py-clob-client` | `Polymarket/py-clob-client` | sdk | official |
| `polymarket-clob-client` | `Polymarket/clob-client` | sdk | official |

### No Modifications Required

The system will work without any code changes because:
1. **Generic scraping** - The crawler just needs a URL, it doesn't care if it's "blockchain" docs
2. **Standard GitHub scraping** - Works on any GitHub repo with code
3. **Quality filtering** - LLM-based filtering will still identify useful examples
4. **Multi-project architecture** - Already supports 6 different projects

### Minor Considerations

1. **Terminology**: The command says "blockchain documentation project" but this is just UX language - the code is generic
2. **Evaluation datasets**: Optional - located in `packages/evaluator/datasets/<project-id>/`
3. **Multiple docs sites**: Polymarket has multiple docs (docs.polymarket.com and learn.polymarket.com) - you may want to:
   - Start with just the main API docs (docs.polymarket.com)
   - Add learn.polymarket.com as a second onboarding if needed

## Code References

- `.claude/commands/onboard_project.md:1-257` - Full onboarding command
- `.claude/skills/project-onboarding/SKILL.md:1-145` - Validation rules and templates reference
- `.claude/skills/project-onboarding/project-template.json:1-21` - Project JSON template
- `config/projects/` - Existing project configs (6 projects as examples)
- `config/sources/project-sources.json` - Project-to-sources mapping

## How to Onboard Polymarket

1. Run `/onboard_project`
2. Enter project name: "Polymarket"
3. Enter docs URL: "https://docs.polymarket.com"
4. Accept default scraping settings (or adjust as needed)
5. Add GitHub sources:
   - `Polymarket/py-clob-client` (Python SDK, official)
   - `Polymarket/clob-client` (TypeScript SDK, official)
6. Run `npm run scraper -- --project polymarket`

## Open Questions

1. Should both docs.polymarket.com and learn.polymarket.com be indexed?
2. Are there other Polymarket GitHub repos worth indexing (e.g., examples, tutorials)?
3. Does the Polymarket docs site use any protection that requires browser mode?
