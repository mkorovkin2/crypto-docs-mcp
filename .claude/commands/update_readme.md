---
description: Research codebase and update README with accurate, current details
model: opus
---

# Update README

You are tasked with researching a codebase, analyzing its current README, identifying outdated or missing information, and dynamically updating the README to accurately reflect the current state of the project.

## When invoked, immediately begin analysis:

Do NOT wait for user input. Start analyzing the current working directory codebase right away.

## Steps to follow:

### Step 1: Read the existing README (if present)

First, check for and read any existing README:

```
Look for: README.md, README, readme.md, README.txt, README.rst
```

If a README exists, read it completely. Note:
- What sections exist
- What information is documented
- Any version numbers, dependencies, or commands mentioned
- Installation/setup instructions
- Usage examples
- API documentation

If no README exists, note this - you'll be creating one from scratch.

### Step 2: Launch parallel research agents

Spawn these 5 focused sub-agents in parallel using the Task tool to gather comprehensive codebase intelligence:

**Agent 1 - Project Identity & Structure** (subagent_type: codebase-analyzer):
```
Analyze this codebase for project identity and structure:
1. What is the project name and primary purpose?
2. What language(s) and framework(s) are used?
3. What is the overall architecture? (monolith, microservices, library, CLI tool, etc.)
4. What are the main directories and their purposes?
5. What are the key entry points?
6. Are there any notable design patterns or architectural decisions?

Return: Project name, purpose statement, tech stack, architecture overview, directory structure with explanations
```

**Agent 2 - Setup & Installation** (subagent_type: codebase-analyzer):
```
Analyze this codebase for setup and installation requirements:
1. What package manager is used? (npm, yarn, pip, cargo, etc.)
2. What are the dependencies? List key ones with their purposes
3. What environment setup is needed? (.env files, secrets, API keys, databases)
4. What system prerequisites are required? (Node version, Python version, etc.)
5. Are there any special installation steps or gotchas?
6. What config files exist and what do they configure?

Return: Package manager, prerequisites, installation commands, environment setup instructions, configuration details
```

**Agent 3 - Running & Usage** (subagent_type: codebase-analyzer):
```
Analyze this codebase for running and usage patterns:
1. How do you run the project in development mode?
2. How do you build for production?
3. What CLI commands or scripts are available? (package.json scripts, Makefile targets, etc.)
4. What are the main usage patterns or workflows?
5. Are there any example files or demo modes?
6. What API endpoints or interfaces does it expose (if applicable)?

Return: Development commands, production build commands, available scripts, usage examples, API overview if applicable
```

**Agent 4 - Testing & Quality** (subagent_type: codebase-analyzer):
```
Analyze this codebase for testing and quality information:
1. What testing framework(s) are used?
2. How do you run tests? All tests? Specific tests?
3. Is there linting/formatting configured? How to run it?
4. Is there CI/CD configured? What does it check?
5. What's the test coverage like? (look for coverage configs)
6. Are there any code quality tools or pre-commit hooks?

Return: Test framework, test commands, linting/formatting commands, CI/CD details, quality tooling
```

**Agent 5 - Recent Changes & Version Info** (subagent_type: codebase-analyzer):
```
Analyze this codebase for versioning and recent changes:
1. What is the current version? (check package.json, Cargo.toml, pyproject.toml, VERSION file, etc.)
2. Is there a CHANGELOG? What are recent notable changes?
3. What do recent git commits suggest about active development areas?
4. Are there any deprecation notices or migration guides?
5. What license is the project under?
6. Who are the maintainers/contributors? (check package.json, git history)

Return: Current version, recent changes summary, license, maintainer info, any deprecation notes
```

### Step 3: Wait for all agents and synthesize findings

**CRITICAL**: Wait for ALL 5 agents to complete before proceeding.

Once all agents return:
1. Compile all findings into a comprehensive understanding
2. Compare findings against the existing README (if present)
3. Identify:
   - **Outdated information**: Commands that changed, dependencies updated, versions wrong
   - **Missing sections**: Important info not documented (setup steps, env vars, etc.)
   - **Inaccurate claims**: Features documented but not present (or vice versa)
   - **Stale examples**: Code examples that no longer work
   - **Incorrect structure**: Documentation that doesn't match actual project layout

### Step 4: Present analysis to user

Before making changes, present your findings:

```markdown
## README Analysis Complete

### Current README Status
[Found at: path/to/README.md | No README found - will create new]

### Issues Found

#### Outdated Information
- [ ] [Issue 1: e.g., "Version listed as 1.0.0, actually 2.3.1"]
- [ ] [Issue 2: e.g., "Install command uses npm, project now uses pnpm"]

#### Missing Sections
- [ ] [Missing 1: e.g., "No environment setup documentation"]
- [ ] [Missing 2: e.g., "API endpoints not documented"]

#### Inaccuracies
- [ ] [Inaccuracy 1: e.g., "Documents feature X which was removed"]

#### Suggested Improvements
- [ ] [Improvement 1: e.g., "Add troubleshooting section"]

### Proposed README Structure
1. [Section 1]
2. [Section 2]
...

Shall I proceed with updating the README? (I'll show you the changes before committing)
```

### Step 5: Generate the updated README

After user confirmation (or immediately if user passed `--auto` flag), generate the updated README.

Use this structure as a baseline, adapting based on project type:

```markdown
# [Project Name]

[One-line description of what the project does]

## Overview

[2-3 sentence expanded description. What problem does this solve? Who is it for?]

## Features

- [Key feature 1]
- [Key feature 2]
- [Key feature 3]

## Prerequisites

- [Prerequisite 1 with version if applicable]
- [Prerequisite 2]

## Installation

```bash
[Installation commands]
```

## Configuration

[Environment variables, config files, etc.]

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VAR_1`  | Description | Yes/No   | value   |

## Usage

### [Primary Usage Pattern]

```bash
[Command or code example]
```

### [Secondary Usage Pattern]

```bash
[Command or code example]
```

## Development

### Running locally

```bash
[Dev server command]
```

### Running tests

```bash
[Test command]
```

### Building

```bash
[Build command]
```

## Project Structure

```
[directory-tree]
├── src/           # [description]
├── tests/         # [description]
└── ...
```

## API Reference

[If applicable - endpoints, methods, etc.]

## Contributing

[Contributing guidelines or link to CONTRIBUTING.md]

## License

[License type] - see [LICENSE](LICENSE) for details.

## Changelog

[Link to CHANGELOG.md or brief recent changes]
```

**Adapt the structure** based on project type:
- **Libraries**: Emphasize API reference, installation for consumers
- **CLI tools**: Focus on command reference, flags, examples
- **Web apps**: Include deployment, environment config
- **APIs**: Detail endpoints, authentication, request/response formats
- **Monorepos**: Document package structure, workspace setup

### Step 6: Show diff and apply changes

Present the changes as a clear diff:

```
## README Changes

### Summary
- Updated version from X to Y
- Added missing "Configuration" section
- Fixed installation command (was `npm install`, now `pnpm install`)
- Removed documentation for deprecated feature Z

### Full Updated README
[Show the complete new README]
```

Then use the Write or Edit tool to apply the changes to the README file.

### Step 7: Final summary

After updating:

```markdown
## README Updated Successfully

**File**: [path/to/README.md]

### Changes Made
- [Change 1]
- [Change 2]
- [Change 3]

### What to Verify
- [ ] Test the installation commands work
- [ ] Verify API examples are accurate
- [ ] Check that linked files/resources exist

Would you like me to verify any of the documented commands actually work?
```

## Important Notes

- **Accuracy over completeness**: Only document what you can verify from the codebase
- **Preserve custom content**: If the existing README has custom sections (badges, sponsor info, etc.), preserve them
- **Don't invent features**: Only document features you find evidence of in the code
- **Match project conventions**: If the project uses specific formatting or style, match it
- **Version specificity**: Include specific version numbers when they matter
- **Test commands**: When possible, verify that documented commands actually exist/work
- **Links**: Ensure any internal links (to other docs, files) are valid
- **Badges**: Preserve existing badges; suggest new ones only if clearly relevant

## Handling Edge Cases

### No README exists
Create a comprehensive README from scratch based on research findings.

### README is in a different format (RST, txt)
Ask user: "Found README.rst - should I update it in RST format or convert to Markdown?"

### Monorepo with multiple READMEs
Ask user which README to update, or offer to update multiple.

### README references external resources
Note any links to external docs/wikis that may also need updating.

## Arguments

- `--auto`: Skip confirmation and apply changes immediately
- `--dry-run`: Show what would change without making changes
- `--section <name>`: Only update a specific section
- `[path]`: Path to specific README file (default: look in current directory)
