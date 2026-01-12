---
description: Generates comprehensive markdown documentation for any repository using hierarchical subagents
argument-hint: "[path] [--mode quick|standard|deep] [--output docs/generated]"
allowed-tools: Read, Write, Edit, Glob, Grep, Task, TodoWrite, LS
model: opus
---

# Generate Repository Documentation

You are tasked with generating comprehensive, deep markdown documentation for a code repository. You will orchestrate multiple specialized subagents across 6 waves to analyze the entire codebase and produce extensive documentation.

## Modes

| Mode | Files Analyzed | Docs Generated | Agents | Use Case |
|------|----------------|----------------|--------|----------|
| `quick` | Entry points only | 5-10 docs | 6 | Quick overview |
| `standard` | All high+medium priority | 20-50 docs | 12 | Normal documentation |
| `deep` | All documentable files | 100+ docs | 18+ | Exhaustive documentation |

## Output Structure

```
[output-dir]/
├── index.md                      # Main entry point
├── architecture/
│   ├── overview.md               # System architecture
│   ├── data-flow.md              # Data flow diagrams
│   ├── dependencies.md           # Dependency analysis
│   └── patterns.md               # Design patterns
├── modules/
│   ├── index.md                  # Module listing
│   └── [module-name]/
│       ├── README.md             # Module overview
│       ├── api.md                # Module API
│       └── examples.md           # Module examples
├── api/
│   ├── index.md                  # API overview
│   └── [category]/
│       └── [api-name].md         # Individual API docs
├── guides/
│   ├── getting-started.md        # Quick start
│   ├── installation.md           # Setup guide
│   ├── configuration.md          # Config reference
│   ├── development.md            # Dev guide
│   └── contributing.md           # Contribution guide
├── concepts/
│   ├── index.md                  # Concepts overview
│   └── [concept-name].md         # Concept explanations
├── examples/
│   ├── index.md                  # Examples overview
│   └── [category]/
│       └── [example-name].md     # Individual examples
└── reference/
    ├── glossary.md               # Term definitions
    ├── file-index.md             # All files with descriptions
    └── changelog-summary.md      # Recent changes
```

## When Invoked

### Step 0: Parse Arguments

Parse the command arguments:
- `path`: Repository path (default: current directory `.`)
- `--mode`: `quick` | `standard` | `deep` (default: `standard`)
- `--output`: Output directory (default: `docs/generated`)

Example invocations:
```
/generate_repo_docs
/generate_repo_docs . --mode deep
/generate_repo_docs /path/to/repo --mode quick --output docs/api
```

### Step 1: Create Progress Tracker

Use TodoWrite to track all 6 waves:

```
1. Wave 1: Discovery & Classification - [pending]
2. Wave 2: Architecture Analysis - [pending]
3. Wave 3: Module Documentation - [pending]
4. Wave 4: API & Examples - [pending]
5. Wave 5: Concepts & Guides - [pending]
6. Wave 6: Synthesis & Navigation - [pending]
7. Write Documentation Files - [pending]
8. Present Summary - [pending]
```

---

## WAVE 1: Discovery & Classification (2 agents)

**Purpose**: Understand what files exist and how to categorize them.

### Agent 1: Structure Discovery

```
Task with subagent_type="codebase-locator":

Discover the complete structure of this repository.

## Repository Path
[PATH]

## Your Job
1. Find ALL files using Glob patterns (*.ts, *.js, *.py, *.go, etc.)
2. Identify project root(s) - check for monorepo indicators:
   - workspaces in package.json
   - lerna.json, pnpm-workspace.yaml
   - Multiple package.json files
3. Find package configurations (package.json, Cargo.toml, pyproject.toml, go.mod)
4. Map the directory tree structure (top 3 levels)
5. Identify entry points (index.*, main.*, app.*, server.*)
6. Count total files by extension

## Return Format
- Repository name and type (library/application/cli/service)
- Is monorepo: yes/no
- Primary language(s)
- Total file count by extension
- Directory tree (abbreviated)
- Entry point files
- Package manager used
- Test directory locations
```

### Agent 2: File Classification

```
Task with subagent_type="file-classifier":

Classify all files in this repository for documentation purposes.

## Repository Info
[Include structure discovery results from Agent 1]

## Documentation Mode
Current mode is: [MODE]
- quick: Only HIGH priority files
- standard: HIGH + MEDIUM priority
- deep: All except SKIP

## Your Job
1. Classify every documentable file by:
   - Type (source, test, config, docs, build, assets)
   - Priority (HIGH, MEDIUM, LOW, SKIP)
   - Category (core, utilities, tests, types, config)
   - Module/package it belongs to

2. Apply priority rules:
   - HIGH: Entry points, public APIs, core business logic
   - MEDIUM: Utilities, configuration, internal services
   - LOW: Tests (but note for example extraction)
   - SKIP: node_modules, dist, .git, generated files

3. Group files by module/package

Return the full classification JSON structure with:
- projects array (if monorepo)
- files by priority level
- categories with counts
- statistics
```

**WAIT for both agents to complete.**

Store results as `CLASSIFICATION_RESULTS` for use in subsequent waves.

---

## WAVE 2: Architecture Analysis (3 agents)

**Purpose**: Understand high-level architecture and patterns.

Spawn these 3 agents IN PARALLEL:

### Agent 3: Dependency Analysis

```
Task with subagent_type="codebase-analyzer":

Analyze the dependency structure of this repository.

## Repository Info
[CLASSIFICATION_RESULTS summary]

## Entry Points
[List from Wave 1]

## Your Job
1. Map internal dependencies:
   - Which modules import which
   - Dependency direction (who depends on whom)
   - Circular dependencies if any

2. Map external dependencies:
   - Third-party packages used
   - Group by category (HTTP, database, testing, etc.)

3. Find integration points:
   - Where modules connect
   - Shared interfaces/types
   - Event buses or message passing

Return:
- Internal dependency graph (text format)
- External dependencies by category
- Key integration points with file:line references
- Circular dependency warnings if any
```

### Agent 4: Pattern Analysis

```
Task with subagent_type="codebase-pattern-finder":

Identify architectural patterns and conventions in this repository.

## Repository Info
[CLASSIFICATION_RESULTS summary]

## High Priority Files
[List from classification]

## Your Job
1. Identify design patterns:
   - Factory, Singleton, Repository, etc.
   - Give examples with file:line references

2. Find coding conventions:
   - Naming patterns (camelCase, snake_case)
   - File organization patterns
   - Export patterns

3. Detect architectural style:
   - MVC, Clean Architecture, Hexagonal, etc.
   - Layer separation

4. Note error handling patterns:
   - Custom error classes
   - Error wrapping
   - Logging patterns

5. Find configuration patterns:
   - Environment variables
   - Config files
   - Feature flags

Return patterns report with concrete examples from the codebase.
```

### Agent 5: Data Flow Analysis

```
Task with subagent_type="codebase-analyzer":

Trace the primary data flows through this repository.

## Entry Points
[From Wave 1]

## Repository Type
[library/application/cli/service]

## Your Job
1. Start from main entry points
2. Trace how data enters the system:
   - HTTP requests (if web service)
   - CLI arguments (if CLI)
   - Function calls (if library)

3. Map data transformations:
   - Validation steps
   - Parsing/serialization
   - Business logic transformations

4. Identify data storage:
   - Database interactions
   - File system operations
   - Cache usage

5. Trace data output:
   - Response formatting
   - Return values
   - Side effects

Return data flow report with file:line references for each step.
```

**WAIT for all 3 agents to complete.**

Store combined results as `ARCHITECTURE_RESULTS`.

---

## WAVE 3: Module Documentation (3+ agents, batched)

**Purpose**: Document each module/component in detail.

### Determine Batching Strategy

Based on mode and file count:

| Mode | Modules per Agent | Max Agents |
|------|-------------------|------------|
| `quick` | 5 | 1 |
| `standard` | 10 | 3 |
| `deep` | 15 | 6 |

Calculate batches:
```
total_modules = count of distinct modules from CLASSIFICATION_RESULTS
agents_needed = ceil(total_modules / modules_per_agent)
agents_to_spawn = min(agents_needed, max_agents)
```

### For Each Batch (spawn in parallel, max 3 at a time)

```
Task with subagent_type="module-documenter":

Document these modules comprehensively.

## Modules to Document
[List of module paths for this batch, e.g.:]
- src/auth/
- src/database/
- src/utils/

## Repository Context
[Summary from ARCHITECTURE_RESULTS:]
- Primary language: [lang]
- Architectural style: [style]
- Key patterns: [patterns]

## Documentation Mode: [MODE]

## Your Job
For EACH module in your batch, produce complete documentation:

1. **Module Overview**
   - Purpose (why does this exist?)
   - Responsibility (what does it do?)
   - Position in architecture (what depends on it? what does it depend on?)

2. **Public API**
   - All exports with full signatures
   - Parameter descriptions
   - Return values
   - Exceptions thrown

3. **Internal Architecture**
   - Key internal functions
   - Data structures
   - Algorithms used

4. **Configuration**
   - Environment variables read
   - Config options

5. **Usage Examples**
   - Extract from tests if available
   - Generate basic examples if not

6. **Related Modules**
   - Dependencies
   - Consumers

## Output Format
Return complete markdown for each module following the module-documenter format.
Include file:line references to source code.
```

**Spawn up to 3 agents in parallel.**
**If more than 3 batches needed, WAIT for first 3 to complete, then spawn next batch.**

Store all module documentation as `MODULE_DOCS`.

---

## WAVE 4: API & Examples (3 agents)

**Purpose**: Extract detailed API references and examples.

Spawn these 3 agents IN PARALLEL:

### Agent: API Extraction

```
Task with subagent_type="api-extractor":

Extract complete API documentation from this repository.

## Repository Info
[CLASSIFICATION_RESULTS summary]
[List of source files to analyze]

## Module Documentation Summary
[Brief summary of modules from MODULE_DOCS]

## Documentation Mode: [MODE]
- quick: Main APIs only (entry points)
- standard: All public APIs
- deep: Public + documented internal APIs

## Your Job
1. Find ALL public exports:
   - Functions
   - Classes
   - Types/Interfaces
   - Constants
   - Enums

2. Extract complete signatures with types

3. Extract documentation:
   - JSDoc comments
   - Docstrings
   - Inline comments

4. Note deprecated APIs

5. Group APIs by:
   - Module/package
   - Category (functions, classes, types, constants)

Return structured API documentation in markdown format.
Include file:line references for every API.
```

### Agent: Test Example Extraction

```
Task with subagent_type="example-generator":

Extract usage examples from test files.

## Test File Locations
[From CLASSIFICATION_RESULTS - test files]

## APIs to Find Examples For
[Key APIs from MODULE_DOCS]

## Your Job
1. Find all test files:
   - *.test.ts, *.spec.ts
   - test_*.py, *_test.py
   - *_test.go
   - etc.

2. Extract test bodies that demonstrate usage:
   - Unit tests showing API usage
   - Integration tests showing workflows
   - E2E tests showing full examples

3. Simplify for documentation:
   - Remove test assertions (expect, assert)
   - Remove mocking setup unless demonstrating mocks
   - Add explanatory comments
   - Show expected output as comments

4. Categorize by:
   - Module/feature
   - Complexity (basic, intermediate, advanced)

Return examples organized by category.
Credit source test file for each example.
```

### Agent: Example Generation

```
Task with subagent_type="example-generator":

Generate new usage examples for APIs lacking examples.

## APIs Documented
[From API extraction agent]

## Existing Examples
[From test extraction agent]

## APIs Needing Examples
[APIs without examples from tests]

## Your Job
1. Identify APIs without examples

2. Generate practical examples:
   - Basic "Hello World" usage
   - Common configuration patterns
   - Error handling examples
   - Integration examples (if applicable)

3. Ensure examples are:
   - Syntactically correct
   - Self-contained (can run independently)
   - Well-commented
   - Using realistic data (not foo/bar)

4. Create:
   - Quick Start example (absolute minimum to get started)
   - Configuration examples (minimal, standard, full)
   - Error handling examples
   - Advanced usage examples

Return generated examples in markdown format.
Mark as "Generated Example" (vs extracted from tests).
```

**WAIT for all 3 agents to complete.**

Store results as `API_DOCS` and `EXAMPLES`.

---

## WAVE 5: Concepts & Guides (3 agents)

**Purpose**: Create developer guides and concept explanations.

Spawn these 3 agents IN PARALLEL:

### Agent: Concepts Documentation

```
Task with subagent_type="codebase-analyzer":

Identify and document key concepts in this repository.

## Architecture Analysis
[ARCHITECTURE_RESULTS]

## Patterns Found
[From pattern analysis]

## Your Job
1. Identify domain-specific concepts:
   - Business domain terms
   - Custom abstractions
   - Domain models

2. Identify technical concepts:
   - Design patterns used and why
   - Architectural patterns
   - Custom utilities/helpers

3. For each concept, write:
   - Clear definition
   - Why it exists
   - How it's used
   - Code examples
   - Related concepts

4. Create a glossary of terms

Return concept documentation files.
```

### Agent: Developer Guides

```
Task with subagent_type="module-documenter":

Create developer guides for this repository.

## Full Analysis Results
[Summary of all previous waves]

## Project Type
[library/application/cli/service]

## Package Manager
[npm/yarn/pip/cargo/go mod]

## Your Job
Create these guides:

1. **Getting Started** (getting-started.md)
   - Minimal setup to first success
   - "Hello World" equivalent
   - 5-minute quick start

2. **Installation** (installation.md)
   - Prerequisites
   - Installation steps
   - Verification steps
   - Common issues

3. **Configuration** (configuration.md)
   - All configuration options
   - Environment variables
   - Config file format
   - Examples for common setups

4. **Development** (development.md)
   - Setting up dev environment
   - Running in dev mode
   - Debugging tips
   - Code style guidelines

5. **Contributing** (contributing.md)
   - How to contribute
   - Code review process
   - Testing requirements
   - PR guidelines

Each guide should be:
- Practical and actionable
- Include concrete commands
- Reference actual files in the repo
```

### Agent: Reference Documentation

```
Task with subagent_type="codebase-analyzer":

Create reference documentation.

## Classification Results
[CLASSIFICATION_RESULTS]

## All Modules and APIs
[Summary from MODULE_DOCS and API_DOCS]

## Your Job
Create these reference documents:

1. **Glossary** (glossary.md)
   - All domain terms
   - Technical terms
   - Abbreviations
   - Link to relevant documentation

2. **File Index** (file-index.md)
   - Every source file
   - Brief description of purpose
   - Module it belongs to
   - Line count

3. **Changelog Summary** (changelog-summary.md)
   - If CHANGELOG.md exists, summarize
   - If git history available, note recent significant changes
   - Note any breaking changes

4. **Troubleshooting** (troubleshooting.md)
   - Common errors and solutions
   - Known issues
   - FAQ based on code comments

Return reference documentation files.
```

**WAIT for all 3 agents to complete.**

Store results as `GUIDES` and `REFERENCE_DOCS`.

---

## WAVE 6: Synthesis & Navigation (2 agents)

**Purpose**: Combine all documentation and create navigation.

Spawn these 2 agents IN PARALLEL:

### Agent: Navigation Builder

```
Task with subagent_type="doc-synthesizer":

Create navigation structure for all documentation.

## Generated Documentation Inventory
[List all docs from Waves 3-5:]

Modules:
- [list of module docs]

APIs:
- [list of API docs]

Examples:
- [list of example docs]

Guides:
- [list of guide docs]

Concepts:
- [list of concept docs]

Reference:
- [list of reference docs]

## Project Info
- Name: [name]
- Type: [library/application/etc]
- Primary Language: [lang]

## Your Job
1. Create main index.md:
   - Project overview
   - Quick links table
   - Full documentation tree
   - Generation timestamp

2. Create category index files:
   - modules/index.md
   - api/index.md
   - guides/index.md
   - examples/index.md
   - concepts/index.md

3. Add cross-references:
   - "See Also" sections for each doc
   - Related module links
   - API to example links

4. Create navigation footers:
   - Previous/Next links where applicable
   - "Back to index" links

Return all index files and list of cross-reference edits needed.
```

### Agent: Quality Check

```
Task with subagent_type="codebase-analyzer":

Verify documentation quality and completeness.

## Generated Documentation
[Full list from all waves]

## Classification Results
[CLASSIFICATION_RESULTS - for comparison]

## Your Job
1. Check completeness:
   - Are all HIGH priority files documented?
   - Are all public APIs documented?
   - Do all modules have documentation?

2. Check internal links:
   - List all internal links in docs
   - Verify target files exist

3. Check file:line references:
   - Do referenced files exist?
   - Are line numbers reasonable?

4. Check consistency:
   - Consistent heading levels?
   - Consistent formatting?
   - Consistent terminology?

5. Identify gaps:
   - Important files not documented
   - APIs without examples
   - Modules without usage docs

Return quality report:
- Completeness score (percentage)
- Broken links (if any)
- Invalid references (if any)
- Gaps to address
- Consistency issues
```

**WAIT for both agents to complete.**

Store as `NAVIGATION` and `QUALITY_REPORT`.

---

## Step 7: Write Documentation Files

After all waves complete, write all documentation to disk.

### Create Directory Structure

```bash
mkdir -p [output]/architecture
mkdir -p [output]/modules
mkdir -p [output]/api
mkdir -p [output]/guides
mkdir -p [output]/concepts
mkdir -p [output]/examples
mkdir -p [output]/reference
```

### Write Files by Category

**IMPORTANT**: Write files in parts if content exceeds 50KB to avoid token limits.

#### Architecture Docs
- Write `[output]/architecture/overview.md`
- Write `[output]/architecture/data-flow.md`
- Write `[output]/architecture/dependencies.md`
- Write `[output]/architecture/patterns.md`

#### Module Docs
For each module in MODULE_DOCS:
- Create `[output]/modules/[module-name]/` directory
- Write `README.md`, `api.md`, `examples.md`

#### API Docs
- Write `[output]/api/index.md`
- Write `[output]/api/functions.md`
- Write `[output]/api/classes.md`
- Write `[output]/api/types.md`

#### Guides
- Write `[output]/guides/getting-started.md`
- Write `[output]/guides/installation.md`
- Write `[output]/guides/configuration.md`
- Write `[output]/guides/development.md`
- Write `[output]/guides/contributing.md`

#### Concepts
- Write `[output]/concepts/index.md`
- Write individual concept files

#### Examples
- Write `[output]/examples/index.md`
- Write example files by category

#### Reference
- Write `[output]/reference/glossary.md`
- Write `[output]/reference/file-index.md`
- Write `[output]/reference/changelog-summary.md`

#### Navigation
- Write `[output]/index.md` (main entry)
- Write category index files
- Apply cross-reference edits

---

## Step 8: Present Summary

```markdown
## Documentation Generated Successfully

**Repository**: [path]
**Mode**: [quick|standard|deep]
**Output**: [output-dir]

### Statistics

| Category | Count |
|----------|-------|
| Total files analyzed | [N] |
| Documentation files generated | [N] |
| Modules documented | [N] |
| APIs documented | [N] |
| Examples included | [N] |
| Guides written | [N] |

### Quality Report

- **Completeness**: [X]% of high-priority files documented
- **Links**: [N] internal links, [N] broken (if any)
- **Coverage**: [X]% of public APIs have examples

### Documentation Structure

```
[output]/
├── index.md                    ✓
├── architecture/
│   ├── overview.md             ✓
│   ├── data-flow.md            ✓
│   ├── dependencies.md         ✓
│   └── patterns.md             ✓
├── modules/
│   ├── index.md                ✓
│   └── [N] module directories  ✓
├── api/
│   ├── index.md                ✓
│   └── [N] API files           ✓
├── guides/
│   └── [N] guides              ✓
├── concepts/
│   └── [N] concepts            ✓
├── examples/
│   └── [N] examples            ✓
└── reference/
    └── [N] reference files     ✓
```

### Quick Links

- **Start Here**: [`[output]/index.md`]([output]/index.md)
- **Getting Started**: [`[output]/guides/getting-started.md`]([output]/guides/getting-started.md)
- **API Reference**: [`[output]/api/index.md`]([output]/api/index.md)

### Known Gaps

[If quality report identified gaps:]
- [Gap 1]
- [Gap 2]

### Next Steps

1. Review generated documentation
2. Add any missing custom content
3. Consider running with `--mode deep` for more coverage
```

---

## Mode-Specific Behavior

### Quick Mode (6 agents, ~5-10 docs)

| Wave | Agents | Scope |
|------|--------|-------|
| 1 | 2 | Full discovery |
| 2 | 1 | Pattern analysis only |
| 3 | 1 | Top 5 modules |
| 4 | 1 | Main APIs only |
| 5 | 1 | Getting started guide only |
| 6 | 1 | Navigation only |

### Standard Mode (12 agents, ~20-50 docs)

All waves as described above.

### Deep Mode (18+ agents, ~100+ docs)

| Wave | Agents | Scope |
|------|--------|-------|
| 1 | 2 | Full discovery |
| 2 | 3 | Full architecture analysis |
| 3 | 6 | All modules (more batches) |
| 4 | 3 | All APIs + internal APIs |
| 5 | 3 | Full guides suite |
| 6 | 2 | Full synthesis + quality |

---

## Error Handling

### Large Repository Warning

If file count > 5000:
```
This repository has [N] files.

Comprehensive documentation will:
- Analyze [N] documentable files
- Generate ~[N] documentation files
- Use ~[N] agents across 6 waves

Options:
1. Proceed with current mode ([mode])
2. Switch to 'quick' mode (faster, less comprehensive)
3. Specify directories to document: --include src/,lib/
```

### Agent Timeout

If an agent times out:
- Log the failure
- Note affected documentation
- Continue with remaining agents
- Report incomplete sections in summary

### Missing Information

If agents cannot find expected information:
- Document what was found
- Note gaps in the documentation
- Suggest manual additions in summary

---

## Token Budget Notes

| Wave | Agents | Est. Tokens/Agent | Total |
|------|--------|-------------------|-------|
| 1 | 2 | ~15-20k | ~35k |
| 2 | 3 | ~25-30k | ~85k |
| 3 | 3-6 | ~30-40k | ~120-200k |
| 4 | 3 | ~25-35k | ~90k |
| 5 | 3 | ~20-30k | ~75k |
| 6 | 2 | ~15-20k | ~35k |

**Quick mode**: ~150-200k total
**Standard mode**: ~400-500k total
**Deep mode**: ~600-800k total
