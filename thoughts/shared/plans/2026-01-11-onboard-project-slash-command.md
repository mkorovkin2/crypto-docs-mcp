# Onboard Project Slash Command Implementation Plan

## Overview

Create an interactive `/onboard_project` slash command that guides users through adding a new blockchain documentation project to the crypto-docs-mcp system. The command will automate file creation, refactor hardcoded project lists to be dynamic, and provide clear guidance for any manual steps.

## Current State Analysis

When onboarding a new project (e.g., Pirate Chain), users must manually update **12 different locations**:

### Config Files (3 locations):
- `config/projects/<project-id>.json` - Project configuration
- `config/sources/<source-id>.json` - Source configurations (one per source)
- `config/sources/project-sources.json` - Project-to-sources mapping

### Hardcoded Lists (4 locations):
- `packages/server/src/tools/index.ts:19,37-42,77-78,etc.` - Tool descriptions mention specific projects
- `packages/evaluator/src/index.ts:58` - Hardcoded `['mina', 'solana', 'cosmos']`
- `packages/evaluator/src/validators/retrieval.ts:80-84` - Hardcoded project patterns
- `scripts/rag-inspector.ts:658,662` - Hardcoded project list in switch/help

### NPM Scripts (1 location):
- `package.json:27-32` - `rag:<project>` scripts

### Documentation (2 locations):
- `README.md` - Supported projects table
- `QUICKSTART.md` - Project-specific instructions

### Optional Evaluation (2 locations):
- `packages/evaluator/datasets/<project>/` - Test dataset directory
- Project-specific YAML test files

## Desired End State

After this plan is complete:
1. Running `/onboard_project` launches an interactive wizard
2. The wizard creates all necessary config files automatically
3. Hardcoded project lists are refactored to be dynamic (auto-discovered from `config/projects/`)
4. The only manual steps are: writing README descriptions and creating evaluation datasets
5. The command validates inputs and provides clear success/failure feedback

### Verification:
- Run `/onboard_project` and add a test project
- Verify all config files are created correctly
- Verify `npm run build` succeeds
- Verify `npm run scraper -- --list` shows the new project
- Verify MCP tools dynamically include the new project in descriptions

## What We're NOT Doing

- **Auto-generating evaluation datasets** - These require domain expertise about the project
- **Auto-writing README descriptions** - These need human-crafted content
- **Scraping automatically** - User should explicitly trigger scraping after review
- **UI landing page updates** - That's a separate future feature

## Implementation Approach

1. First, refactor all hardcoded project lists to be dynamic
2. Then create the slash command and supporting agent
3. Add templates and validation logic
4. The command only needs to create JSON config files - everything else auto-discovers

---

## Phase 1: Refactor Hardcoded Project Lists to Dynamic

### Overview
Convert all hardcoded project lists to dynamically read from `config/projects/` directory. This is the foundation that makes the slash command simple.

### Changes Required:

#### 1. Server Tools - Dynamic Project Descriptions
**File**: `packages/server/src/tools/index.ts`
**Changes**: Import `listProjects` and `loadProjectConfig`, generate descriptions dynamically

```typescript
// Add imports at top
import { listProjects, loadProjectConfig } from '@mina-docs/shared';

// Add helper function before getToolDefinitions()
function getProjectDescriptions(): string {
  try {
    const projects = listProjects();
    return projects.map(id => {
      const config = loadProjectConfig(id);
      return `- "${id}" - ${config.name}`;
    }).join('\n');
  } catch {
    return '- Use crypto_list_projects to see available projects';
  }
}

function getProjectList(): string {
  try {
    return listProjects().map(id => `"${id}"`).join(', ');
  } catch {
    return '"mina", "solana", "cosmos"';
  }
}
```

Then update tool descriptions to use these functions:
- Line 19: Replace hardcoded list with `${getProjectDescriptions()}`
- Lines 37-42, 77-78, etc.: Replace hardcoded project mentions with dynamic references

#### 2. Evaluator Index - Dynamic Project Discovery
**File**: `packages/evaluator/src/index.ts`
**Changes**: Import from shared config, replace hardcoded array

```typescript
// Add import
import { listProjects } from '@mina-docs/shared';

// Line 56-58: Replace hardcoded array
const projects = projectFilter
  ? [projectFilter]
  : listProjects().length > 0 ? listProjects() : ['mina', 'solana', 'cosmos'];
```

#### 3. Retrieval Validator - Dynamic Project Patterns
**File**: `packages/evaluator/src/validators/retrieval.ts`
**Changes**: Load project patterns from config or use project name as fallback

```typescript
// Add import
import { listProjects, loadProjectConfig } from '@mina-docs/shared';

// Replace lines 80-84 with dynamic loading
function getProjectPatterns(): Record<string, string[]> {
  const patterns: Record<string, string[]> = {};
  try {
    for (const id of listProjects()) {
      const config = loadProjectConfig(id);
      // Use project name words as patterns, plus the ID
      const nameWords = config.name.toLowerCase().split(/\s+/);
      patterns[id] = [id, ...nameWords];
    }
  } catch {
    // Fallback for when config isn't available
    patterns['mina'] = ['mina', 'o1js', 'mina protocol'];
    patterns['solana'] = ['solana', 'anchor', 'spl'];
    patterns['cosmos'] = ['cosmos', 'cosmos sdk', 'cosmos-sdk', 'ibc'];
  }
  return patterns;
}

// Use in searchGuidanceHasProject:
const projectPatterns = getProjectPatterns();
```

#### 4. RAG Inspector - Dynamic Project List
**File**: `scripts/rag-inspector.ts`
**Changes**: Import config loader, generate project list dynamically

```typescript
// Add import near top
import { listProjects } from './path-to-shared-or-inline';

// Line 658: Replace hardcoded switch check
const availableProjects = listProjects();
if (argStr && availableProjects.includes(argStr.toLowerCase())) {
  currentProject = argStr.toLowerCase();
  log(colors.green, `Switched to project: ${currentProject}`);
} else {
  log(colors.yellow, `Available projects: ${availableProjects.join(', ')}`);
}
```

Note: The RAG inspector is a standalone script. We may need to either:
- Import from the built shared package
- Inline a simple directory-reading function
- Accept that this one location stays semi-hardcoded (just reads directory)

#### 5. Package.json - Document Dynamic Usage
**File**: `package.json`
**Changes**: Keep existing scripts but add a note that new projects work automatically with `--project <id>`

The `rag:<project>` scripts are convenience shortcuts. New projects work with:
```bash
node scripts/rag-inspector.js --project <new-project-id>
```

We can optionally add a generic script or document this in README.

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compilation passes with no errors
- [ ] `npm run scraper -- --list` shows all projects from config/projects/

#### Manual Verification:
- [ ] Start MCP server and verify `crypto_list_projects` returns dynamic list
- [ ] Add a dummy project config file, verify it appears in `--list` output
- [ ] Remove dummy project, verify it disappears

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Create Onboarding Skill with Templates

### Overview
Create a skill directory with JSON templates that the slash command will use to generate config files.

### Changes Required:

#### 1. Create Skill Directory Structure
**Directory**: `.claude/skills/project-onboarding/`

#### 2. Project Config Template
**File**: `.claude/skills/project-onboarding/project-template.json`

```json
{
  "$schema": "Project configuration template",
  "$description": "Template for config/projects/<project-id>.json",
  "id": "{{PROJECT_ID}}",
  "name": "{{PROJECT_NAME}}",
  "docs": {
    "baseUrl": "{{DOCS_URL}}",
    "excludePatterns": ["/api/", "/changelog/", "/releases/"],
    "maxPages": 200,
    "useBrowser": false
  },
  "github": {
    "repo": "{{GITHUB_ORG}}/{{GITHUB_REPO}}",
    "branch": "main",
    "include": ["src/**/*.ts", "src/**/*.js", "examples/**/*"],
    "exclude": ["**/*.test.*", "**/test/**", "**/tests/**", "**/__tests__/**"]
  },
  "crawler": {
    "concurrency": 3,
    "delayMs": 1000
  }
}
```

#### 3. Source Config Template
**File**: `.claude/skills/project-onboarding/source-template.json`

```json
{
  "$schema": "Source configuration template",
  "$description": "Template for config/sources/<source-id>.json",
  "id": "{{SOURCE_ID}}",
  "type": "github",
  "repoType": "{{REPO_TYPE}}",
  "trustLevel": "{{TRUST_LEVEL}}",
  "repo": "{{GITHUB_ORG}}/{{GITHUB_REPO}}",
  "branch": "main",
  "description": "{{SOURCE_DESCRIPTION}}",
  "scrapeStrategy": {
    "exampleDirs": ["examples", "demos", "tutorials", "samples"],
    "exclude": ["**/*.test.*", "**/test/**", "**/tests/**"],
    "extensions": [".ts", ".tsx", ".js", ".jsx", ".rs", ".go", ".py"]
  },
  "qualityThresholds": {
    "minDocumentationScore": 30,
    "minLLMRelevanceScore": 50,
    "requireReadme": true
  }
}
```

#### 4. Skill Definition
**File**: `.claude/skills/project-onboarding/SKILL.md`

```markdown
---
name: project-onboarding
description: Templates and knowledge for onboarding new documentation projects
---

# Project Onboarding Skill

This skill provides templates and validation rules for onboarding new blockchain documentation projects.

## Templates

- `project-template.json` - Template for project configuration
- `source-template.json` - Template for source registry entries

## Validation Rules

### Project ID
- Must be lowercase alphanumeric with dashes
- Must start with a letter
- Pattern: `/^[a-z][a-z0-9-]*$/`
- Examples: `mina`, `pirate-chain`, `cosmos-sdk`

### Source ID
- Format: `<project-id>-<source-name>`
- Examples: `mina-o1js-official`, `pirate-piratepay`

### Repository Types
- `sdk` - Official SDK/library code
- `example-repo` - Example projects and demos
- `tutorial-repo` - Tutorial content
- `ecosystem-lib` - Community/ecosystem libraries

### Trust Levels
- `official` - Official project repositories
- `verified-community` - Verified community contributions
- `community` - General community content

## File Locations

After onboarding, these files should exist:
1. `config/projects/<project-id>.json`
2. `config/sources/<source-id>.json` (one per source)
3. `config/sources/project-sources.json` (updated with new mapping)
```

### Success Criteria:

#### Automated Verification:
- [ ] Template files exist and are valid JSON (except SKILL.md)
- [ ] `npm run build` still succeeds

#### Manual Verification:
- [ ] Templates contain all required fields from schema

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 3: Create the Slash Command

### Overview
Create the main `/onboard_project` command that orchestrates the interactive onboarding workflow.

### Changes Required:

#### 1. Slash Command Definition
**File**: `.claude/commands/onboard_project.md`

```markdown
---
description: Interactively onboard a new blockchain documentation project
model: opus
---

# Onboard New Project

You are helping the user add a new blockchain documentation project to the crypto-docs-mcp system. Guide them through an interactive workflow to gather information and create all necessary configuration files.

## Initial Response

When this command is invoked, respond with:

```
I'll help you onboard a new documentation project. This wizard will:

1. Gather basic project information (name, ID, docs URL)
2. Configure documentation scraping settings
3. Set up GitHub source repositories (optional)
4. Create all necessary config files
5. Validate the configuration

Let's start! What is the **name** of the project you want to add?
(e.g., "Pirate Chain", "Secret Network", "Avalanche")
```

## Information Gathering Flow

### Step 1: Basic Information
Gather in sequence, validating as you go:

1. **Project Name** (display name)
   - Example: "Pirate Chain", "Secret Network"

2. **Project ID** (auto-suggest from name, let user confirm/modify)
   - Must match: `/^[a-z][a-z0-9-]*$/`
   - Auto-generate: lowercase, spaces to dashes
   - Example: "pirate-chain", "secret-network"
   - **Validate**: Check `config/projects/` doesn't already have this ID

3. **Documentation URL**
   - Must be valid HTTPS URL
   - Example: "https://docs.piratechain.com"
   - **Validate**: Optionally check URL is reachable

### Step 2: Documentation Scraping Settings
Ask about special requirements:

1. **Cloudflare Protection?**
   - If yes, set `useBrowser: true`
   - Default: false

2. **URL Patterns to Exclude**
   - Suggest defaults: `["/api/", "/changelog/", "/releases/"]`
   - Let user add more

3. **Max Pages**
   - Default: 200
   - Suggest lower (100-150) for smaller doc sites

### Step 3: GitHub Sources (Optional)
Ask if they want to add GitHub repositories:

1. **Main Repository**
   - Format: "org/repo" (e.g., "PirateNetwork/pirate")
   - Branch (default: "main" or "master")

2. **Additional Sources**
   - For each source, gather:
     - Source ID (suggest: `<project-id>-<repo-name>`)
     - Repository (org/repo)
     - Type: sdk, example-repo, tutorial-repo, ecosystem-lib
     - Trust level: official, verified-community, community
     - Description

3. **File Patterns**
   - Include patterns (suggest based on repo type)
   - Exclude patterns (suggest: test files, node_modules)

### Step 4: Create Configuration Files

After gathering all information:

1. **Create project config**: `config/projects/<project-id>.json`
2. **Create source configs**: `config/sources/<source-id>.json` for each source
3. **Update project-sources mapping**: Add entry to `config/sources/project-sources.json`

Use the templates from `.claude/skills/project-onboarding/` as starting points.

### Step 5: Validation & Next Steps

After creating files:

1. **Validate JSON syntax** of all created files
2. **Run**: `npm run scraper -- --list` to verify project appears
3. **Present summary**:
   ```
   ✅ Project configuration created successfully!

   Files created:
   - config/projects/<project-id>.json
   - config/sources/<source-id>.json (×N)
   - config/sources/project-sources.json (updated)

   Next steps:
   1. Review the created config files
   2. Run the scraper: npm run scraper -- --project <project-id>
   3. (Optional) Add evaluation datasets in packages/evaluator/datasets/<project-id>/
   4. (Optional) Update README.md with project description

   Would you like me to run the scraper now? (This will index the documentation)
   ```

## Important Guidelines

1. **Validate early and often** - Check project ID format before proceeding
2. **Provide sensible defaults** - Most users can accept defaults for crawler settings
3. **Be helpful with GitHub patterns** - Suggest appropriate include/exclude based on repo type
4. **Create valid JSON** - Use proper escaping, no trailing commas
5. **Don't modify source code** - Only create/update JSON config files
6. **Preserve existing data** - When updating project-sources.json, preserve all existing entries

## Error Handling

- If project ID already exists, suggest alternatives
- If URL is unreachable, warn but allow proceeding
- If JSON creation fails, show the error and allow retry
- If GitHub repo doesn't exist, warn but allow proceeding (user might add it later)

## Templates Reference

Read templates from:
- `.claude/skills/project-onboarding/project-template.json`
- `.claude/skills/project-onboarding/source-template.json`
```

### Success Criteria:

#### Automated Verification:
- [ ] Command file exists at `.claude/commands/onboard_project.md`
- [ ] YAML frontmatter is valid
- [ ] `npm run build` succeeds

#### Manual Verification:
- [ ] Run `/onboard_project` and complete the wizard for a test project
- [ ] Verify all config files are created with correct content
- [ ] Verify `npm run scraper -- --list` shows the new project
- [ ] Clean up test project files after verification

**Implementation Note**: After completing this phase, do full end-to-end testing.

---

## Phase 4: Add NPM Script Helper (Optional)

### Overview
Add a convenience script to package.json that can be run for any project without needing project-specific scripts.

### Changes Required:

#### 1. Update Package.json
**File**: `package.json`
**Changes**: Add a generic rag script with documentation

```json
{
  "scripts": {
    "rag": "node scripts/rag-inspector.js",
    "rag:mina": "node scripts/rag-inspector.js --project mina",
    // ... existing scripts ...
  }
}
```

Usage: `npm run rag -- --project <any-project-id>`

### Success Criteria:

#### Automated Verification:
- [ ] `npm run rag -- --project mina` works
- [ ] `npm run rag -- --help` shows available options

---

## Testing Strategy

### Unit Tests:
- Project ID validation regex
- JSON template variable substitution
- Config file path generation

### Integration Tests:
- Full onboarding flow with mock inputs
- Verify created files match expected structure
- Verify scraper recognizes new project

### Manual Testing Steps:
1. Run `/onboard_project`
2. Add a test project called "test-chain"
3. Verify `config/projects/test-chain.json` is created
4. Verify `npm run scraper -- --list` includes "test-chain"
5. Start MCP server, verify `crypto_list_projects` includes "test-chain"
6. Run `npm run scraper -- --project test-chain --dry-run`
7. Clean up: delete test config files

## Performance Considerations

- Dynamic project loading adds minimal overhead (reads directory once)
- Tool descriptions are generated at server startup, not per-request
- Config files are small JSON, fast to read

## Migration Notes

No data migration needed. Existing projects continue to work unchanged.

## Rollback Plan

If issues arise:
1. Revert source code changes in Phase 1
2. Keep config files (they're additive)
3. Hardcoded lists still work as fallback in refactored code

## References

- Project config schema: `packages/shared/src/config/project-config.ts`
- Source registry schema: `packages/shared/src/config/source-registry.ts`
- Config loading: `packages/shared/src/config/load-config.ts`
- Existing project config example: `config/projects/pirate-chain.json`
- Existing source config example: `config/sources/mina-o1js-official.json`
