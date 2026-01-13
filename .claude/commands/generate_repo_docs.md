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

## Knowledge Handoff Protocol

Each wave MUST pass specific information to subsequent waves using the exact markdown structures below. Do NOT summarize or omit fields - context loss between waves degrades documentation quality.

### Wave 1 Output → Wave 2 Input

Wave 1 agents MUST return this exact structure:

```
### HANDOFF: Discovery Results

**Repository Identity**
- Name: [repo name from package.json/Cargo.toml/etc]
- Type: library | application | cli | service
- Monorepo: yes | no
- Primary language: [lang]
- Package manager: npm | yarn | pip | cargo | go mod

**Entry Points** (full paths, one per line)
- [path/to/main/entry.ts] - [brief description]
- [path/to/secondary.ts] - [brief description]

**Module Boundaries** (directories that constitute modules)
| Module Path | Purpose | File Count |
|-------------|---------|------------|
| src/auth/ | Authentication logic | 12 |
| src/db/ | Database layer | 8 |

**File Classification**
| Priority | Count | Key Files |
|----------|-------|-----------|
| HIGH | N | file1.ts, file2.ts, ... |
| MEDIUM | N | file3.ts, file4.ts, ... |
| LOW | N | (tests - note locations only) |

**Test Locations**: tests/, src/**/*.test.ts, __tests__/
```

### Wave 2 Output → Wave 3 Input

Wave 2 agents MUST return this exact structure:

```
### HANDOFF: Architecture Results

**Dependency Graph** (internal module dependencies)
- src/api/ → src/db/, src/auth/
- src/auth/ → src/db/
- src/utils/ → (none - leaf module)

**External Dependencies by Category**
| Category | Packages |
|----------|----------|
| HTTP | express, axios |
| Database | prisma, pg |
| Testing | jest, vitest |

**Architectural Style**: [MVC | Clean Architecture | Hexagonal | Layered | etc]

**Key Patterns Found**
| Pattern | Location | Example |
|---------|----------|---------|
| Repository | src/db/repos/ | UserRepository at src/db/repos/user.ts:15 |
| Factory | src/factories/ | createClient at src/factories/client.ts:8 |

**Data Flow Summary**
- Entry: [how data enters - HTTP/CLI/function calls]
- Transform: [key transformation points with file:line]
- Storage: [database/cache/file locations]
- Output: [how data exits]

**Integration Points**
| Point | Files | Purpose |
|-------|-------|---------|
| API↔DB | src/api/handlers.ts:45 | Query execution |
| Auth↔API | src/middleware/auth.ts:12 | Request validation |
```

### Wave 3 Output → Wave 4 Input

Wave 3 agents MUST return this exact structure per module:

```
### HANDOFF: Module Documentation

**Module**: [path]

**Public Exports**
| Export | Type | Signature | Line |
|--------|------|-----------|------|
| createUser | function | (data: UserInput) => Promise<User> | 45 |
| User | type | interface | 12 |

**Dependencies**: src/db/, src/utils/
**Dependents**: src/api/, src/cli/

**Key Internal Functions**
| Function | Purpose | Line |
|----------|---------|------|
| validateInput | Input sanitization | 78 |
| hashPassword | Security | 92 |

**Config/Env Vars Used**: DATABASE_URL, AUTH_SECRET
```

### Wave 4 Output → Wave 5 Input

Wave 4 agents MUST return:

```
### HANDOFF: API & Examples

**APIs Documented** (count by category)
| Category | Count | Has Examples |
|----------|-------|--------------|
| Functions | N | Y/N |
| Classes | N | Y/N |
| Types | N | N/A |

**APIs Missing Examples**
- functionName (src/path.ts:line)
- ClassName (src/path.ts:line)

**Example Sources Found**
| Test File | APIs Covered |
|-----------|--------------|
| tests/user.test.ts | createUser, deleteUser |
| tests/auth.test.ts | login, logout |
```

### Wave 5 Output → Wave 6 Input

Wave 5 agents MUST return:

```
### HANDOFF: Guides & Concepts

**Guides Written**
| Guide | Sections | References |
|-------|----------|------------|
| getting-started.md | 4 | src/index.ts, README.md |
| configuration.md | 6 | .env.example, config/ |

**Concepts Documented**
| Concept | Related Modules |
|---------|-----------------|
| Authentication Flow | src/auth/, src/middleware/ |
| Data Validation | src/validators/, src/types/ |

**Glossary Terms**: N terms defined
**Files Indexed**: N files catalogued
```

---

## Output Structure

Documentation is generated under `[output-dir]/[repo-name]/` where `repo-name` is extracted from the repository's package.json, Cargo.toml, pyproject.toml, go.mod, or directory name.

```
[output-dir]/
└── [repo-name]/
    ├── index.md                      # Main entry point (includes project identity header)
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

## Project Identity Header

**Every generated markdown file MUST start with this header:**

```markdown
---
project: [repo-name]
source: [absolute path to source repo]
generated: [ISO timestamp]
---
```

This ensures:
- Docs are clearly attributed to their source project
- Multiple project docs can coexist in the same output directory
- Readers always know which codebase the docs describe

## When Invoked

### Step 0: Parse Arguments and Extract Repo Name

Parse the command arguments:
- `path`: Repository path (default: current directory `.`)
- `--mode`: `quick` | `standard` | `deep` (default: `standard`)
- `--output`: Output directory (default: `docs/generated`)

**Extract repo name** (in priority order):
1. `name` field from package.json
2. `name` field from Cargo.toml
3. `name` field from pyproject.toml
4. Module name from go.mod
5. Directory name of the repository

Store as `REPO_NAME` - this will be used for the output folder and project identity headers.

Example invocations:
```
/generate_repo_docs
/generate_repo_docs . --mode deep
/generate_repo_docs /path/to/repo --mode quick --output docs/api
```

Example output paths:
- `/generate_repo_docs /path/to/my-library` → `docs/generated/my-library/`
- `/generate_repo_docs . --output docs/api` → `docs/api/[repo-name]/`

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
Use the EXACT "HANDOFF: Discovery Results" structure from the Knowledge Handoff Protocol section. Include:
- Repository Identity (all 5 fields)
- Entry Points (full paths with descriptions)
- Module Boundaries table
- File Classification table
- Test Locations
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

## Return Format
Merge your results with Agent 1's output to complete the "HANDOFF: Discovery Results" structure. Ensure:
- File Classification table has accurate counts
- Module Boundaries table is complete with file counts
- HIGH priority files are explicitly listed (not just counted)
```

**WAIT for both agents to complete.**

**CRITICAL**: Combine Agent 1 and Agent 2 results into a single complete "HANDOFF: Discovery Results" block. This EXACT block will be passed to Wave 2 agents.

---

## WAVE 2: Architecture Analysis (3 agents)

**Purpose**: Understand high-level architecture and patterns.

Spawn these 3 agents IN PARALLEL:

### Agent 3: Dependency Analysis

```
Task with subagent_type="codebase-analyzer":

Analyze the dependency structure of this repository.

## HANDOFF INPUT (from Wave 1)
[Paste the COMPLETE "HANDOFF: Discovery Results" block here - do not summarize]

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

## Return Format
Return these sections for the "HANDOFF: Architecture Results" structure:
- Dependency Graph (arrow notation: moduleA → moduleB, moduleC)
- External Dependencies by Category table
- Integration Points table
```

### Agent 4: Pattern Analysis

```
Task with subagent_type="codebase-pattern-finder":

Identify architectural patterns and conventions in this repository.

## HANDOFF INPUT (from Wave 1)
[Paste the COMPLETE "HANDOFF: Discovery Results" block here - do not summarize]

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

## Return Format
Return these sections for the "HANDOFF: Architecture Results" structure:
- Architectural Style (single line)
- Key Patterns Found table (Pattern | Location | Example with file:line)
```

### Agent 5: Data Flow Analysis

```
Task with subagent_type="codebase-analyzer":

Trace the primary data flows through this repository.

## HANDOFF INPUT (from Wave 1)
[Paste the COMPLETE "HANDOFF: Discovery Results" block here - do not summarize]

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

## Return Format
Return these sections for the "HANDOFF: Architecture Results" structure:
- Data Flow Summary (Entry/Transform/Storage/Output with file:line refs)
```

**WAIT for all 3 agents to complete.**

**CRITICAL**: Combine Agent 3, 4, and 5 results into a single complete "HANDOFF: Architecture Results" block. This EXACT block will be passed to Wave 3 agents.

---

## WAVE 3: Module Documentation (3+ agents, batched)

**Purpose**: Document each module EXHAUSTIVELY with full source code and implementation details.

### Depth Requirements by Mode

| Mode | Target Lines/Module | Source Code | Internals | Functions Coverage |
|------|---------------------|-------------|-----------|-------------------|
| `quick` | 200+ lines | Signatures only | No | Public exports only |
| `standard` | 400+ lines | Key implementations | Key internals | 80% of functions |
| `deep` | 800+ lines | Full source code | All internals | 100% of functions |

### Determine Batching Strategy

Based on mode and file count:

| Mode | Modules per Agent | Max Agents |
|------|-------------------|------------|
| `quick` | 5 | 1 |
| `standard` | 5 | 3 |
| `deep` | 3 | 6 |

Calculate batches:
```
total_modules = count of distinct modules from CLASSIFICATION_RESULTS
agents_needed = ceil(total_modules / modules_per_agent)
agents_to_spawn = min(agents_needed, max_agents)
```

### For Each Batch (spawn in parallel, max 3 at a time)

```
Task with subagent_type="module-documenter":

## CRITICAL: You MUST produce EXHAUSTIVE documentation

### Depth Requirements (Mode: [MODE])
- **Minimum output: 800+ lines per module** (for deep mode)
- **Document EVERY function** - public AND private/internal
- **Include FULL source code** - embed actual implementations
- **Explain algorithms** - step-by-step for complex logic
- **Tag internal functions** - use [Internal] prefix

### Modules to Document (this batch)
- src/auth/
- src/database/
- src/utils/

### HANDOFF INPUT (from Wave 1)
[Paste the COMPLETE "HANDOFF: Discovery Results" block here - do not summarize]

### HANDOFF INPUT (from Wave 2)
[Paste the COMPLETE "HANDOFF: Architecture Results" block here - do not summarize]

### Documentation Mode: [MODE]

### For EACH module, you MUST:

1. **Read the ENTIRE source file(s)**
   - Use Read tool to get COMPLETE file contents
   - Do NOT skip any lines
   - Parse every function, class, type, constant

2. **Document EVERY function** (both public AND private)
   - Public functions: full documentation with implementation
   - Private functions: tag as [Internal], document fully including source code
   - Include FULL implementation code in code blocks

3. **Include source code blocks**
   - Copy actual function implementations (not just signatures)
   - Preserve original comments
   - Add explanatory comments for complex sections

4. **Document with these sections (REQUIRED)**:
   - **Overview**: 3-5 paragraphs on purpose, design, architecture fit
   - **Quick Reference**: Table of ALL exports AND internal functions
   - **Detailed API Reference**: Full documentation per function with:
     - Full signature
     - Source location (file:line-range)
     - Parameters table (name, type, required, default, description)
     - Returns description
     - Throws table
     - **FULL Implementation code block**
     - Implementation notes explaining key lines
     - Complexity analysis
     - Usage examples
   - **[Internal] Functions**: Same detail level, tagged as [Internal]
   - **Types and Interfaces**: Full definitions with field tables
   - **Constants and Enums**: Values, purposes, usage locations
   - **Internal Implementation Details**: Data flow, algorithms, error handling
   - **Dependencies**: Internal and external with purposes
   - **Used By**: Where this module is imported

5. **Trace ALL dependencies**
   - Where each function is called from (grep for usages)
   - What each function calls

### Validation Checklist (verify before returning)
- [ ] Every export from the module is documented
- [ ] Every private function is documented with [Internal] tag
- [ ] Full source code is included for all functions
- [ ] Output is 800+ lines (for deep mode)
- [ ] All parameters have type and detailed description
- [ ] All return values documented with possible values
- [ ] All errors/exceptions documented with conditions
- [ ] Implementation notes explain complex logic
- [ ] Line references point to actual source locations

**Return ONLY when this checklist is complete.**

### Output Format
For EACH module documented, return:

1. A "HANDOFF: Module Documentation" block following the Knowledge Handoff Protocol:
   - Module path
   - Public Exports table (Export | Type | Signature | Line)
   - Internal Functions table (Function | Purpose | Line) - NEW
   - Dependencies and Dependents
   - Key Internal Functions table
   - Config/Env Vars Used
   - Line Count of generated documentation

2. The FULL markdown documentation (800+ lines for deep mode) for final output
```

**Spawn up to 3 agents in parallel.**
**If more than 3 batches needed, WAIT for first 3 to complete, then spawn next batch.**

**CRITICAL**: Collect all "HANDOFF: Module Documentation" blocks from all batches. These will be passed to Wave 4 agents.
**CRITICAL**: If any module documentation is under the line threshold, RE-RUN the agent for that module with explicit instruction to add more detail.

---

## WAVE 4: API & Examples (3 agents)

**Purpose**: Extract detailed API references and examples.

Spawn these 3 agents IN PARALLEL:

### Agent: API Extraction

```
Task with subagent_type="api-extractor":

Extract complete API documentation from this repository.

## HANDOFF INPUT (from Wave 1)
[Paste the COMPLETE "HANDOFF: Discovery Results" block here - do not summarize]

## HANDOFF INPUT (from Wave 3)
[Paste ALL "HANDOFF: Module Documentation" blocks here - do not summarize]

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

## Return Format
Return a "HANDOFF: API & Examples" block with:
- APIs Documented table (Category | Count | Has Examples)
- APIs Missing Examples list (name + file:line)

ALSO return the full API markdown documentation (this goes to final output).
```

### Agent: Test Example Extraction

```
Task with subagent_type="example-generator":

Extract usage examples from test files.

## HANDOFF INPUT (from Wave 1)
[Paste the COMPLETE "HANDOFF: Discovery Results" block - includes Test Locations]

## HANDOFF INPUT (from Wave 3)
[Paste ALL "HANDOFF: Module Documentation" blocks - includes Public Exports to find examples for]

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

## Return Format
Return:
- Example Sources Found table (Test File | APIs Covered)
- Full example markdown organized by category (this goes to final output)
```

### Agent: Example Generation

```
Task with subagent_type="example-generator":

Generate new usage examples for APIs lacking examples.

## HANDOFF INPUT (from API Extraction Agent)
[Paste the "APIs Missing Examples" list from the API Extraction agent]

## HANDOFF INPUT (from Test Extraction Agent)
[Paste the "Example Sources Found" table - to avoid duplicating existing examples]

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

## Return Format
Return generated examples in markdown format. Mark each as "Generated Example" (vs extracted from tests).
```

**WAIT for all 3 agents to complete.**

**CRITICAL**: Combine results into a single "HANDOFF: API & Examples" block. This will be passed to Wave 5 agents.

---

## WAVE 5: Concepts & Guides (3 agents)

**Purpose**: Create developer guides and concept explanations.

Spawn these 3 agents IN PARALLEL:

### Agent: Concepts Documentation

```
Task with subagent_type="codebase-analyzer":

Identify and document key concepts in this repository.

## HANDOFF INPUT (from Wave 2)
[Paste the COMPLETE "HANDOFF: Architecture Results" block - includes patterns and architectural style]

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

## Return Format
Return:
- Concepts Documented table (Concept | Related Modules)
- Glossary Terms count
- Full concept markdown documentation (this goes to final output)
```

### Agent: Developer Guides

```
Task with subagent_type="module-documenter":

Create developer guides for this repository.

## HANDOFF INPUT (from Wave 1)
[Paste the COMPLETE "HANDOFF: Discovery Results" block - includes repo type, package manager]

## HANDOFF INPUT (from Wave 2)
[Paste the COMPLETE "HANDOFF: Architecture Results" block - includes patterns, config info]

## HANDOFF INPUT (from Wave 4)
[Paste the "HANDOFF: API & Examples" block - for referencing in guides]

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

## Return Format
Return:
- Guides Written table (Guide | Sections | References)
- Full guide markdown documentation (this goes to final output)
```

### Agent: Reference Documentation

```
Task with subagent_type="codebase-analyzer":

Create reference documentation.

## HANDOFF INPUT (from Wave 1)
[Paste the COMPLETE "HANDOFF: Discovery Results" block - includes file classification]

## HANDOFF INPUT (from Wave 3)
[Paste ALL "HANDOFF: Module Documentation" blocks - for file index]

## HANDOFF INPUT (from Wave 4)
[Paste the "HANDOFF: API & Examples" block - for API reference]

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

## Return Format
Return:
- Files Indexed count
- Full reference markdown documentation (this goes to final output)
```

**WAIT for all 3 agents to complete.**

**CRITICAL**: Combine results into a single "HANDOFF: Guides & Concepts" block. This will be passed to Wave 6 agents.

---

## WAVE 6: Synthesis & Navigation (2 agents)

**Purpose**: Combine all documentation and create navigation.

Spawn these 2 agents IN PARALLEL:

### Agent: Navigation Builder

```
Task with subagent_type="doc-synthesizer":

Create navigation structure for all documentation.

## HANDOFF INPUT (from Wave 1)
[Paste the "Repository Identity" section from "HANDOFF: Discovery Results"]

## HANDOFF INPUT (from Wave 3)
[List all module paths documented - extract from Module Documentation blocks]

## HANDOFF INPUT (from Wave 4)
[Paste "APIs Documented" table from "HANDOFF: API & Examples"]

## HANDOFF INPUT (from Wave 5)
[Paste the COMPLETE "HANDOFF: Guides & Concepts" block]

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

### Agent: Quality Check & Depth Validation

```
Task with subagent_type="codebase-analyzer":

Verify documentation quality, completeness, AND DEPTH.

## HANDOFF INPUT (from Wave 1)
[Paste "File Classification" table from "HANDOFF: Discovery Results" - for completeness check]

## HANDOFF INPUT (from Wave 3)
[List all module paths documented WITH their line counts]

## HANDOFF INPUT (from Wave 4)
[Paste "APIs Documented" and "APIs Missing Examples" from "HANDOFF: API & Examples"]

## HANDOFF INPUT (from Wave 5)
[Paste the COMPLETE "HANDOFF: Guides & Concepts" block]

## Documentation Mode: [MODE]

## Your Job

### 1. DEPTH VALIDATION (CRITICAL)

Verify each module documentation meets minimum line requirements:

| Mode | Minimum Lines/Module | Source Code Required | Internals Required |
|------|---------------------|---------------------|-------------------|
| `quick` | 200 lines | No | No |
| `standard` | 400 lines | Key functions | Key internals |
| `deep` | 800 lines | ALL functions | ALL internals |

For each module documentation file:
- Count total lines
- Flag any under threshold
- Check for full source code blocks (not just signatures)
- Verify [Internal] tags exist for private functions

### 2. COVERAGE VALIDATION

Count functions in source files vs functions in documentation:
- Parse source files for function definitions
- Parse documentation for function documentation
- Calculate coverage percentage
- Flag modules with <100% coverage (for deep mode)

### 3. SOURCE CODE VALIDATION

Verify documentation contains actual implementations:
- Check for code blocks longer than 10 lines (actual implementations)
- Verify code blocks contain function bodies, not just signatures
- Flag documentation that only has signature-level code

### 4. INTERNAL FUNCTION VALIDATION

For deep mode, verify:
- All private/internal functions are documented
- Each has [Internal] tag in heading
- Each has full implementation code

### 5. Check completeness:
   - Are all HIGH priority files documented?
   - Are all public APIs documented?
   - Do all modules have documentation?

### 6. Check internal links:
   - List all internal links in docs
   - Verify target files exist

### 7. Check file:line references:
   - Do referenced files exist?
   - Are line numbers reasonable?

### 8. Check consistency:
   - Consistent heading levels?
   - Consistent formatting?
   - Consistent terminology?

### 9. Identify gaps:
   - Important files not documented
   - APIs without examples
   - Modules without usage docs
   - **Functions missing documentation**
   - **Functions missing source code**

## Return Format

Return comprehensive quality report:

```json
{
  "depth_validation": {
    "mode": "[MODE]",
    "min_lines_required": 800,
    "modules_checked": 10,
    "modules_passing": 8,
    "modules_failing": [
      {
        "module": "src/auth/",
        "lines": 350,
        "required": 800,
        "issues": [
          "Under line threshold (350 < 800)",
          "Missing internal function _validateToken",
          "No source code for hashPassword()"
        ]
      }
    ]
  },
  "coverage_validation": {
    "total_functions_in_source": 45,
    "total_functions_documented": 42,
    "coverage_percentage": 93,
    "missing_functions": [
      {"name": "_helperA", "file": "src/utils.ts", "line": 45},
      {"name": "_helperB", "file": "src/utils.ts", "line": 78}
    ]
  },
  "source_code_validation": {
    "modules_with_full_code": 8,
    "modules_with_signatures_only": 2,
    "modules_needing_code": ["src/config/", "src/types/"]
  },
  "internal_function_validation": {
    "internal_functions_found": 15,
    "internal_functions_documented": 12,
    "missing_internal_docs": [
      {"name": "_parseConfig", "file": "src/config.ts", "line": 23}
    ]
  },
  "completeness_score": 85,
  "broken_links": [],
  "invalid_references": [],
  "gaps": [
    "Module src/utils/ has only 350 lines, needs expansion",
    "Function processData() missing source code"
  ],
  "consistency_issues": [],
  "recommendations": [
    "Re-run module-documenter on src/auth/ with instruction to include all internal functions",
    "Add source code to src/config/ documentation"
  ]
}
```

**If any module fails depth validation, list it in recommendations for re-documentation.**
```

**WAIT for both agents to complete.**

**CRITICAL POST-WAVE-6 STEP**:
If the Quality Check identifies modules failing depth validation:
1. Re-run module-documenter for those specific modules with explicit instruction to increase depth
2. Repeat until all modules pass depth validation or 3 retry attempts exhausted

Navigation and Quality Check results are used directly for final output - no further handoff needed.

---

## Step 7: Write Documentation Files

After all waves complete, write all documentation to disk.

### Create Directory Structure

Use `REPO_NAME` from Step 0:

```bash
mkdir -p [output]/[REPO_NAME]/architecture
mkdir -p [output]/[REPO_NAME]/modules
mkdir -p [output]/[REPO_NAME]/api
mkdir -p [output]/[REPO_NAME]/guides
mkdir -p [output]/[REPO_NAME]/concepts
mkdir -p [output]/[REPO_NAME]/examples
mkdir -p [output]/[REPO_NAME]/reference
```

### Write Files by Category

**IMPORTANT**:
- Write files in parts if content exceeds 50KB to avoid token limits
- Every file MUST include the Project Identity Header (see above)
- Use `[output]/[REPO_NAME]/` as the base path

#### Architecture Docs
- Write `[output]/[REPO_NAME]/architecture/overview.md`
- Write `[output]/[REPO_NAME]/architecture/data-flow.md`
- Write `[output]/[REPO_NAME]/architecture/dependencies.md`
- Write `[output]/[REPO_NAME]/architecture/patterns.md`

#### Module Docs
For each module in MODULE_DOCS:
- Create `[output]/[REPO_NAME]/modules/[module-name]/` directory
- Write `README.md`, `api.md`, `examples.md`

#### API Docs
- Write `[output]/[REPO_NAME]/api/index.md`
- Write `[output]/[REPO_NAME]/api/functions.md`
- Write `[output]/[REPO_NAME]/api/classes.md`
- Write `[output]/[REPO_NAME]/api/types.md`

#### Guides
- Write `[output]/[REPO_NAME]/guides/getting-started.md`
- Write `[output]/[REPO_NAME]/guides/installation.md`
- Write `[output]/[REPO_NAME]/guides/configuration.md`
- Write `[output]/[REPO_NAME]/guides/development.md`
- Write `[output]/[REPO_NAME]/guides/contributing.md`

#### Concepts
- Write `[output]/[REPO_NAME]/concepts/index.md`
- Write individual concept files

#### Examples
- Write `[output]/[REPO_NAME]/examples/index.md`
- Write example files by category

#### Reference
- Write `[output]/[REPO_NAME]/reference/glossary.md`
- Write `[output]/[REPO_NAME]/reference/file-index.md`
- Write `[output]/[REPO_NAME]/reference/changelog-summary.md`

#### Navigation
- Write `[output]/[REPO_NAME]/index.md` (main entry)
- Write category index files
- Apply cross-reference edits

---

## Step 8: Present Summary

```markdown
## Documentation Generated Successfully

**Project**: [REPO_NAME]
**Source Repository**: [absolute path]
**Mode**: [quick|standard|deep]
**Output Directory**: [output-dir]/[REPO_NAME]/

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
└── [REPO_NAME]/
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

- **Start Here**: `[output]/[REPO_NAME]/index.md`
- **Getting Started**: `[output]/[REPO_NAME]/guides/getting-started.md`
- **API Reference**: `[output]/[REPO_NAME]/api/index.md`

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
