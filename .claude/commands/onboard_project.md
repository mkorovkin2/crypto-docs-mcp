---
description: Interactively onboard a new blockchain documentation project
model: opus
---

# Onboard New Project

You are helping the user add a new blockchain documentation project to the crypto-docs-mcp system. Guide them through an interactive workflow to gather information and create all necessary configuration files.

## Initial Response

When this command is invoked, respond with:

```
I'll help you onboard a new documentation project to crypto-docs-mcp. This wizard will:

1. Gather basic project information (name, ID, docs URL)
2. Configure documentation scraping settings
3. Set up GitHub source repositories (optional)
4. Create all necessary config files
5. Validate the configuration

Let's start! What is the **name** of the project you want to add?
(e.g., "Pirate Chain", "Secret Network", "Avalanche")
```

Then wait for the user's input.

## Information Gathering Flow

### Step 1: Basic Information

Gather in sequence, validating as you go:

1. **Project Name** (display name)
   - Example: "Pirate Chain", "Secret Network"
   - This is what users will see

2. **Project ID** (auto-suggest from name, let user confirm/modify)
   - Must match regex: `/^[a-z][a-z0-9-]*$/`
   - Auto-generate suggestion: lowercase, spaces to dashes, remove special chars
   - Example: "pirate-chain", "secret-network"
   - **Validate**: Use Glob to check `config/projects/*.json` doesn't already have this ID
   - If duplicate, suggest alternatives like `<name>-docs` or `<name>-network`

3. **Documentation URL**
   - Must be valid HTTPS URL
   - Example: "https://docs.piratechain.com"
   - Optionally use WebFetch to check if URL is reachable (warn but don't block)

### Step 2: Documentation Scraping Settings

Ask about special requirements with sensible defaults:

1. **Cloudflare Protection?**
   - Ask: "Does the documentation site use Cloudflare protection? (If you're unsure, say no - we can change it later)"
   - If yes, set `useBrowser: true`
   - Default: false

2. **URL Patterns to Exclude**
   - Show defaults: `["/api/", "/changelog/", "/releases/"]`
   - Ask: "Any additional URL patterns to exclude? (Press enter to use defaults)"
   - Common additions: `/blog/`, `/news/`, `/v1/`, `/legacy/`

3. **Max Pages**
   - Show default: 200
   - Ask: "Maximum pages to crawl? (Press enter for 200, smaller sites might use 100-150)"

### Step 3: GitHub Sources (Optional)

Ask if they want to add GitHub repositories for code examples:

```
Would you like to add GitHub repositories as sources?
This indexes code examples, SDK documentation, and tutorials from GitHub.

Options:
1. Yes, add GitHub sources
2. No, just documentation site for now (can add later)
```

If yes, for each source gather:

1. **Repository** (format: "org/repo")
   - Example: "o1-labs/o1js", "PirateNetwork/pirate"
   - Optionally validate with WebFetch to GitHub API

2. **Source ID**
   - Auto-suggest: `<project-id>-<repo-name>` or `<project-id>-<descriptive-name>`
   - Example: "mina-o1js-official", "pirate-piratepay"

3. **Repository Type**
   - Options: sdk, example-repo, tutorial-repo, ecosystem-lib
   - Explain each briefly when asking

4. **Trust Level**
   - Options: official, verified-community, community
   - For first source, usually "official"

5. **Branch** (default: "main")
   - Ask: "Main branch? (default: main, some repos use master)"

6. **Description**
   - Brief description for documentation
   - Example: "Official o1js SDK for Mina zkApps"

After each source, ask: "Add another GitHub source? (y/n)"

### Step 4: Create Configuration Files

After gathering all information, create the files:

1. **Read the templates first**:
   - Read `.claude/skills/project-onboarding/project-template.json`
   - Read `.claude/skills/project-onboarding/source-template.json`

2. **Create project config**: `config/projects/<project-id>.json`
   - Fill in template placeholders with gathered values
   - Remove `$schema` comment field
   - Use Write tool

3. **Create source configs** (if any): `config/sources/<source-id>.json`
   - Fill in template placeholders for each source
   - Remove `$schema` comment field
   - Use Write tool

4. **Update project-sources mapping**:
   - Read `config/sources/project-sources.json`
   - Add new entry for this project
   - Preserve all existing entries
   - Use Write tool to update

### Step 5: Validation & Summary

After creating files:

1. **Validate JSON syntax** by reading each created file

2. **Run scraper list** to verify project appears:
   ```bash
   npm run scraper -- --list
   ```

3. **Present summary**:

```
Project configuration created successfully!

Files created:
- config/projects/<project-id>.json
- config/sources/<source-id>.json (xN sources)
- config/sources/project-sources.json (updated)

Configuration Summary:
- Project: <project-name> (<project-id>)
- Docs URL: <docs-url>
- Max pages: <max-pages>
- Browser mode: <yes/no>
- GitHub sources: <count>

Next steps:
1. Review the created config files if you want to make adjustments
2. Run the scraper: npm run scraper -- --project <project-id>
3. (Optional) Add evaluation datasets in packages/evaluator/datasets/<project-id>/
4. (Optional) Update README.md with project description

Would you like me to run the scraper now to index the documentation?
```

If user says yes, run:
```bash
npm run scraper -- --project <project-id>
```

## Important Guidelines

1. **Validate Early**
   - Check project ID format before proceeding
   - Check for duplicates before asking more questions
   - Provide clear error messages with suggestions

2. **Provide Sensible Defaults**
   - Most users can accept defaults for crawler settings
   - Make it easy to just press Enter for reasonable defaults

3. **Be Helpful with GitHub**
   - Suggest appropriate patterns based on repo type
   - SDK repos: focus on apiPaths
   - Example repos: focus on exampleDirs

4. **Create Valid JSON**
   - Use proper escaping
   - No trailing commas
   - Remove template comment fields ($schema)

5. **Don't Modify Source Code**
   - Only create/update JSON config files
   - Never edit TypeScript/JavaScript files

6. **Preserve Existing Data**
   - When updating project-sources.json, keep ALL existing entries
   - Never overwrite or remove other projects' configurations

## Error Handling

- **Project ID already exists**: Suggest alternatives, don't proceed until resolved
- **URL unreachable**: Warn but allow proceeding ("We couldn't reach the URL, but it might be temporary. Proceed anyway?")
- **JSON creation fails**: Show the error, offer to retry
- **GitHub repo doesn't exist**: Warn but allow proceeding (user might add it later)
- **Invalid project ID format**: Show the regex requirement, auto-fix if possible

## Template Reference

The templates are located at:
- `.claude/skills/project-onboarding/project-template.json`
- `.claude/skills/project-onboarding/source-template.json`
- `.claude/skills/project-onboarding/SKILL.md` (validation rules reference)

## Example Session

```
User: /onboard_project

Assistant: I'll help you onboard a new documentation project to crypto-docs-mcp...

User: Avalanche

Assistant: Great\! I'll use "avalanche" as the project ID. Let me check if that's available...
[Checks config/projects/ - no conflict]
Perfect, "avalanche" is available.

What is the documentation URL?

User: https://docs.avax.network

Assistant: Got it. A few quick settings:
1. Does the site use Cloudflare protection? (default: no)
2. URL patterns to exclude? (default: /api/, /changelog/, /releases/)
3. Max pages to crawl? (default: 200)

User: defaults are fine

Assistant: Would you like to add GitHub repositories as sources?

User: yes, add avalanchego

Assistant: Adding GitHub source:
- Repository: ava-labs/avalanchego
- Source ID: avalanche-avalanchego (suggested)
- Type: sdk
- Trust level: official

[Creates files...]

Project configuration created successfully\!
```
