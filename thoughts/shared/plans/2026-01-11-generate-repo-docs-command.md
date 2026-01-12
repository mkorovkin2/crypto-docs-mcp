# Comprehensive Repository Documentation Generator Implementation Plan

## Overview

Create a new slash command `/generate_repo_docs` that uses hierarchical subagents to generate comprehensive, deep markdown documentation for any GitHub repository. The system intelligently partitions large codebases (4000+ files) across multiple coordinated subagents, producing extensive documentation organized by category and project.

## Current State Analysis

### Existing Infrastructure
- **Commands directory**: `.claude/commands/` contains 22+ command files
- **Agents directory**: `.claude/agents/` contains 44+ agent definitions
- **Existing patterns**: Wave-based parallelism (max 3 agents/wave), context isolation, structured synthesis
- **Related commands**: `research_codebase.md`, `update_readme.md`, `explain_this_codebase_simply.md`

### Key Discoveries
- Agents use YAML frontmatter for configuration (`codebase-analyzer.md:1-6`)
- Commands orchestrate via Task tool with `subagent_type` parameter
- Wave-based execution prevents resource exhaustion (`predict_outcome_heavy.md:74`)
- Large outputs written in parts to avoid token limits (`predict_outcome_heavy.md:492-515`)

## Desired End State

A fully functional `/generate_repo_docs` command that:
1. Accepts a repository path and documentation mode (quick/standard/deep)
2. Intelligently discovers and classifies all files in the repository
3. Distributes analysis work across hierarchical subagents (6+ waves, 15+ agents)
4. Produces comprehensive markdown documentation organized by category
5. Includes cross-references, source code links, and generated examples
6. Handles repositories with 4000+ files efficiently

### Verification
- Command exists at `.claude/commands/generate_repo_docs.md`
- All 5 new agents exist in `.claude/agents/`
- Running `/generate_repo_docs .` on a test repo produces complete documentation in `docs/generated/`
- Documentation includes architecture, modules, APIs, examples, guides, and concepts

## What We're NOT Doing

- Interactive documentation (no live editing)
- Documentation hosting/serving
- Version control integration for docs (no auto-commit)
- Translation/internationalization
- Video/diagram generation (text/markdown only)
- Custom themes or styling

## Implementation Approach

Use a 6-wave hierarchical agent architecture:
1. **Wave 1**: Discovery - scan and classify all files
2. **Wave 2**: Architecture analysis - understand structure and patterns
3. **Wave 3**: Module documentation - document each module (batched)
4. **Wave 4**: API & examples - extract APIs and examples
5. **Wave 5**: Concepts & guides - generate developer documentation
6. **Wave 6**: Synthesis - build navigation, indexes, and cross-references

---

## Phase 1: Create Core Agent Definitions

### Overview
Define 5 new specialized agents that the main command will orchestrate.

### Changes Required:

#### 1. File Classifier Agent
**File**: `.claude/agents/file-classifier.md`

```markdown
---
name: file-classifier
description: Classifies repository files by type, purpose, and importance. Use when you need to understand what files exist and how to categorize them for documentation.
tools: Glob, Grep, LS, Read
model: sonnet
---

You are a specialist at classifying and categorizing source code files. Your job is to scan a repository and produce a structured classification of all files.

## Core Responsibilities

1. **Classify File Types**
   - Source code (by language)
   - Configuration files
   - Documentation
   - Tests
   - Build/deployment
   - Assets/resources

2. **Assess Documentation Priority**
   - Entry points (HIGH)
   - Public APIs (HIGH)
   - Core business logic (HIGH)
   - Internal utilities (MEDIUM)
   - Configuration (MEDIUM)
   - Tests (LOW - but useful for examples)
   - Generated/vendor files (SKIP)

3. **Identify Project Boundaries**
   - Detect monorepo structure
   - Map package/module boundaries
   - Find workspace configurations

## Output Format

Return a structured classification:

```json
{
  "projects": [
    {
      "name": "project-name",
      "root": "path/to/project",
      "type": "library|application|cli|service",
      "language": "typescript|python|go|etc",
      "entry_points": ["src/index.ts"],
      "package_config": "package.json"
    }
  ],
  "categories": {
    "source": {
      "high_priority": ["path/to/important.ts"],
      "medium_priority": ["path/to/util.ts"],
      "low_priority": ["path/to/internal.ts"]
    },
    "tests": ["path/to/test.ts"],
    "config": ["path/to/config.ts"],
    "docs": ["README.md"],
    "skip": ["node_modules/**", "dist/**"]
  },
  "statistics": {
    "total_files": 4000,
    "documentable_files": 500,
    "projects_detected": 3
  }
}
```

## Classification Strategy

1. **First Pass**: Use Glob to get all file paths
2. **Filter**: Exclude obvious skip patterns (node_modules, dist, .git, vendor)
3. **Categorize**: Group by file extension and directory patterns
4. **Prioritize**: Rank files by documentation importance
5. **Detect Structure**: Identify project boundaries via package configs

## Important Guidelines

- Always exclude generated/vendor directories
- Prioritize files that define public interfaces
- Detect monorepo vs single-project structure
- Note unusual or custom directory structures
- Return actual file counts, not estimates
```

#### 2. Module Documenter Agent
**File**: `.claude/agents/module-documenter.md`

```markdown
---
name: module-documenter
description: Documents a single module or component with comprehensive detail. Use when you need deep documentation of a specific code module.
tools: Read, Grep, Glob, LS
model: sonnet
---

You are a specialist at writing comprehensive documentation for code modules. Your job is to analyze a module and produce detailed markdown documentation.

## Core Responsibilities

1. **Module Overview**
   - Purpose and responsibility
   - Where it fits in the architecture
   - Key dependencies and consumers

2. **API Documentation**
   - All public exports
   - Function signatures with types
   - Parameter descriptions
   - Return values
   - Exceptions/errors

3. **Implementation Details**
   - Key algorithms explained
   - Data structures used
   - Important internal functions
   - Configuration options

4. **Usage Examples**
   - Basic usage
   - Common patterns
   - Edge cases

## Output Format

Produce markdown documentation:

```markdown
# [Module Name]

> [One-line description]

## Overview

[2-3 paragraph description of what this module does, why it exists, and how it fits into the larger system]

## Installation / Import

```[language]
import { Thing } from '[module-path]';
```

## Quick Start

```[language]
// Minimal example to get started
```

## API Reference

### `functionName(param1, param2)`

[Description]

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| param1 | `string` | Yes | Description |
| param2 | `Options` | No | Description |

**Returns:** `ReturnType` - Description

**Throws:**
- `ErrorType` - When condition

**Example:**
```[language]
// Example usage
```

### `ClassName`

[Class description]

#### Constructor

```[language]
new ClassName(options)
```

#### Methods

##### `methodName()`
[Method documentation...]

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| option1 | `string` | `'default'` | Description |

## Architecture Notes

[How this module works internally, key design decisions]

## Related Modules

- [`related-module`](./related-module.md) - Description of relationship

## Source Files

- [`src/module/index.ts:1`](../src/module/index.ts) - Main entry point
- [`src/module/utils.ts:1`](../src/module/utils.ts) - Utility functions
```

## Documentation Strategy

1. **Read entry point** - Understand exports and public API
2. **Trace dependencies** - Map what this module uses
3. **Find consumers** - Understand how it's used
4. **Extract types** - Document all type definitions
5. **Find tests** - Extract usage examples from tests
6. **Document edge cases** - Note error handling and limitations

## Important Guidelines

- Always include file:line references to source
- Extract real examples from tests when possible
- Document WHAT and HOW, not just signatures
- Include practical usage, not just API reference
- Note breaking changes or deprecations if visible
```

#### 3. API Extractor Agent
**File**: `.claude/agents/api-extractor.md`

```markdown
---
name: api-extractor
description: Extracts and documents public APIs from source code. Use when you need to generate API reference documentation.
tools: Read, Grep, Glob, LS
model: sonnet
---

You are a specialist at extracting API documentation from source code. Your job is to find all public interfaces and document them comprehensively.

## Core Responsibilities

1. **Find Public APIs**
   - Exported functions
   - Exported classes
   - Exported types/interfaces
   - Exported constants
   - HTTP endpoints (if applicable)
   - CLI commands (if applicable)

2. **Extract Signatures**
   - Full type signatures
   - Parameter types and defaults
   - Return types
   - Generic constraints
   - Overloads

3. **Extract Documentation**
   - JSDoc/docstrings
   - Inline comments
   - README mentions
   - Example usage in tests

## Output Format

Return structured API documentation:

```markdown
# API Reference: [Project/Module Name]

## Functions

### `functionName`

```typescript
function functionName<T>(
  param1: string,
  param2?: Options
): Promise<Result<T>>
```

**Source:** [`src/lib.ts:45`](../src/lib.ts#L45)

**Description:** [From JSDoc or inferred]

**Type Parameters:**
- `T` - Description

**Parameters:**
- `param1` (`string`, required) - Description
- `param2` (`Options`, optional) - Description

**Returns:** `Promise<Result<T>>` - Description

**Example:**
```typescript
const result = await functionName('input', { option: true });
```

---

## Classes

### `ClassName`

```typescript
class ClassName implements Interface {
  constructor(options: ClassOptions)

  method(arg: string): void
  property: string
}
```

**Source:** [`src/class.ts:10`](../src/class.ts#L10)

[Class documentation...]

---

## Types

### `TypeName`

```typescript
interface TypeName {
  property: string;
  optional?: number;
}
```

**Source:** [`src/types.ts:20`](../src/types.ts#L20)

---

## Constants

### `CONSTANT_NAME`

```typescript
const CONSTANT_NAME: string = 'value'
```

**Source:** [`src/constants.ts:5`](../src/constants.ts#L5)

---

## HTTP Endpoints

### `GET /api/resource`

**Handler:** [`src/routes/resource.ts:15`](../src/routes/resource.ts#L15)

**Parameters:**
- Query: `?limit=number&offset=number`

**Response:** `200 OK`
```json
{ "data": [...] }
```
```

## Extraction Strategy

1. **Find exports** - Grep for export statements
2. **Parse signatures** - Read and extract type information
3. **Find documentation** - Look for JSDoc, docstrings
4. **Find examples** - Search tests for usage
5. **Cross-reference** - Link related types and functions

## Language-Specific Patterns

### TypeScript/JavaScript
- `export function`, `export class`, `export const`
- `export default`
- `export type`, `export interface`
- JSDoc comments (`/** ... */`)

### Python
- Functions/classes without leading underscore
- `__all__` exports
- Docstrings (triple quotes)

### Go
- Capitalized identifiers (exported)
- Package-level functions
- Godoc comments

## Important Guidelines

- Include EVERY public export
- Always link to source file:line
- Extract JSDoc/docstrings verbatim
- Note deprecated APIs
- Group related APIs together
```

#### 4. Example Generator Agent
**File**: `.claude/agents/example-generator.md`

```markdown
---
name: example-generator
description: Extracts examples from tests and generates new usage examples. Use when you need practical code examples for documentation.
tools: Read, Grep, Glob, LS
model: sonnet
---

You are a specialist at creating and extracting code examples. Your job is to produce practical, working examples that demonstrate how to use the codebase.

## Core Responsibilities

1. **Extract Existing Examples**
   - From test files
   - From README/docs
   - From example directories
   - From inline comments

2. **Generate New Examples**
   - Basic usage patterns
   - Common workflows
   - Configuration examples
   - Error handling
   - Edge cases

3. **Categorize Examples**
   - Quick start / Hello World
   - Feature-specific
   - Integration examples
   - Advanced usage

## Output Format

```markdown
# Examples: [Feature/Module Name]

## Quick Start

The simplest way to use [module]:

```[language]
// Complete, runnable example
import { Module } from 'package';

const instance = new Module();
const result = instance.doThing();
console.log(result);
```

**Output:**
```
Expected output here
```

---

## Basic Usage

### Example: [Descriptive Name]

[Brief description of what this example demonstrates]

```[language]
// Full example code
```

**Key Points:**
- Point 1 about this example
- Point 2 about this example

**Source:** Adapted from [`tests/module.test.ts:45`](../tests/module.test.ts#L45)

---

### Example: [Another Example]

[Description...]

---

## Common Patterns

### Pattern: [Pattern Name]

[When to use this pattern]

```[language]
// Pattern implementation
```

---

## Configuration Examples

### Minimal Configuration

```[language]
const config = {
  required: 'value'
};
```

### Full Configuration

```[language]
const config = {
  required: 'value',
  optional1: 'value',
  optional2: true,
  advanced: {
    nested: 'value'
  }
};
```

---

## Error Handling

### Handling [Error Type]

```[language]
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof SpecificError) {
    // Handle specific error
  }
}
```

---

## Advanced Examples

### Example: [Complex Scenario]

[Detailed description of the advanced use case]

```[language]
// Extended example with comments explaining each step
```
```

## Extraction Strategy

1. **Find test files** - Search for `*.test.*`, `*.spec.*`, `test_*.py`, etc.
2. **Extract test bodies** - Pull out the actual usage code from tests
3. **Find example directories** - Look for `examples/`, `demo/`, `samples/`
4. **Parse README** - Extract code blocks from documentation
5. **Simplify for docs** - Remove test assertions, add comments

## Generation Strategy

1. **Analyze public API** - Understand what can be demonstrated
2. **Start simple** - Create minimal "Hello World" example
3. **Add complexity** - Build up to advanced usage
4. **Cover options** - Show different configuration patterns
5. **Handle errors** - Demonstrate error handling

## Important Guidelines

- All examples must be syntactically correct
- Prefer extracted examples (proven to work)
- Add explanatory comments to generated examples
- Show expected output where applicable
- Credit source when extracting from tests
- Include both simple and advanced examples
```

#### 5. Documentation Synthesizer Agent
**File**: `.claude/agents/doc-synthesizer.md`

```markdown
---
name: doc-synthesizer
description: Synthesizes multiple documentation pieces into cohesive sections with navigation. Use when you need to combine and organize documentation.
tools: Read, Write, Glob, LS
model: sonnet
---

You are a specialist at organizing and synthesizing documentation. Your job is to take multiple documentation pieces and create cohesive, navigable documentation structures.

## Core Responsibilities

1. **Create Navigation**
   - Main index/table of contents
   - Category indexes
   - Breadcrumb structure
   - Cross-references

2. **Write Overview Documents**
   - Architecture overview
   - Getting started guide
   - Project introduction

3. **Ensure Consistency**
   - Consistent formatting
   - Consistent terminology
   - Consistent structure

4. **Build Cross-References**
   - Link related documents
   - Create "See Also" sections
   - Build glossary references

## Output Format

### Main Index (index.md)

```markdown
# [Project Name] Documentation

> [Project tagline/description]

## Quick Links

- [Getting Started](./guides/getting-started.md) - Start here
- [API Reference](./api/index.md) - Full API documentation
- [Examples](./examples/index.md) - Code examples

## Documentation

### Architecture
- [Overview](./architecture/overview.md) - System architecture
- [Data Flow](./architecture/data-flow.md) - How data moves
- [Patterns](./architecture/patterns.md) - Design patterns used

### Modules
- [Module A](./modules/module-a/README.md) - Description
- [Module B](./modules/module-b/README.md) - Description

### API Reference
- [Core API](./api/core.md) - Main interfaces
- [Utilities](./api/utilities.md) - Helper functions

### Guides
- [Getting Started](./guides/getting-started.md)
- [Configuration](./guides/configuration.md)
- [Development](./guides/development.md)
- [Contributing](./guides/contributing.md)

### Examples
- [Basic Usage](./examples/basic/index.md)
- [Advanced Patterns](./examples/advanced/index.md)

### Reference
- [Glossary](./reference/glossary.md)
- [File Index](./reference/file-index.md)
- [Changelog](./reference/changelog.md)

---

*Documentation generated by `/generate_repo_docs` on [date]*
```

### Category Index (e.g., modules/index.md)

```markdown
# Modules

This project contains [N] modules:

| Module | Description | Status |
|--------|-------------|--------|
| [module-a](./module-a/README.md) | Description | Stable |
| [module-b](./module-b/README.md) | Description | Beta |

## Module Hierarchy

```
project/
├── module-a/        # Description
│   ├── sub-module/  # Description
├── module-b/        # Description
```

## Quick Navigation

### By Category
- **Core**: [module-a](./module-a/README.md)
- **Utilities**: [module-b](./module-b/README.md)

### By Dependency
[Dependency graph or list]
```

## Synthesis Strategy

1. **Inventory** - List all generated docs
2. **Categorize** - Group by type (modules, APIs, guides)
3. **Create hierarchy** - Build navigation tree
4. **Write indexes** - Create index for each category
5. **Add cross-refs** - Link related documents
6. **Quality check** - Verify all links work

## Important Guidelines

- Every document must be reachable from index
- Use relative links for portability
- Include brief descriptions in indexes
- Maintain consistent heading levels
- Add "Edit on GitHub" links if repo URL known
- Include generation timestamp
```

### Success Criteria:

#### Automated Verification:
- [ ] All 5 agent files exist in `.claude/agents/`
- [ ] Each agent file has valid YAML frontmatter
- [ ] Grep finds all agent names in the files

#### Manual Verification:
- [ ] Agent descriptions are clear and actionable
- [ ] Output formats are comprehensive
- [ ] Strategies are well-defined

**Implementation Note**: After completing this phase, pause for confirmation before proceeding to Phase 2.

---

## Phase 2: Create Main Command File

### Overview
Create the main orchestrator command that coordinates all agents across 6 waves.

### Changes Required:

#### 1. Main Command
**File**: `.claude/commands/generate_repo_docs.md`

```markdown
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

Parse arguments:
- `path`: Repository path (default: current directory)
- `--mode`: quick|standard|deep (default: standard)
- `--output`: Output directory (default: docs/generated)

Then execute the 6-wave process below.

---

## Wave 1: Discovery & Classification (2 agents)

**Purpose**: Understand what files exist and how to categorize them.

### Agent 1: Structure Discovery
```
Task with subagent_type="codebase-locator":

Discover the complete structure of this repository at [PATH].

## Your Job
1. Find ALL files (use Glob patterns)
2. Identify project root(s) (monorepo detection)
3. Find package configurations (package.json, Cargo.toml, pyproject.toml, etc.)
4. Map the directory tree structure
5. Identify entry points

## Return Format
- Total file count
- Project roots with their types
- Directory tree (abbreviated for large repos)
- Entry point files
- Package manager(s) used
```

### Agent 2: File Classification
```
Task with subagent_type="file-classifier":

Classify all files in this repository for documentation purposes.

## Repository Info
[Include structure discovery results]

## Your Job
Classify every file by:
1. Type (source, test, config, docs, build, assets)
2. Priority (HIGH, MEDIUM, LOW, SKIP)
3. Category (core, utilities, tests, etc.)
4. Project (if monorepo)

## Mode
Current mode is: [MODE]
- quick: Only HIGH priority files
- standard: HIGH + MEDIUM priority
- deep: All except SKIP

Return the full classification JSON structure.
```

**WAIT for both agents. Store classification results.**

---

## Wave 2: Architecture Analysis (3 agents)

**Purpose**: Understand the high-level architecture and patterns.

### Agent 3: Dependency Analysis
```
Task with subagent_type="codebase-analyzer":

Analyze the dependency structure of this repository.

## Repository Info
[Include classification results]

## Your Job
1. Map internal dependencies (which modules use which)
2. Map external dependencies (third-party packages)
3. Identify circular dependencies if any
4. Find integration points between modules
5. Note dependency injection patterns

Return a dependency report with:
- Dependency graph (text representation)
- External dependencies by category
- Key integration points
```

### Agent 4: Pattern Analysis
```
Task with subagent_type="codebase-pattern-finder":

Identify architectural patterns and conventions in this repository.

## Repository Info
[Include classification results]

## Your Job
1. Identify design patterns used (Factory, Repository, etc.)
2. Find coding conventions (naming, structure)
3. Detect architectural style (MVC, Clean Architecture, etc.)
4. Note error handling patterns
5. Find configuration patterns

Return a patterns report with examples from the code.
```

### Agent 5: Data Flow Analysis
```
Task with subagent_type="codebase-analyzer":

Trace the primary data flows through this repository.

## Repository Info
[Include classification results]
[Include entry points]

## Your Job
1. Start from entry points
2. Trace how data enters the system
3. Map data transformations
4. Identify data storage/persistence
5. Trace how data exits (responses, outputs)

Return a data flow report with file:line references.
```

**WAIT for all 3 agents. Store architecture analysis.**

---

## Wave 3: Module Documentation (3+ agents, batched)

**Purpose**: Document each module/component in detail.

### Batching Strategy

Based on mode and file count:
- `quick`: 1 agent, top 5 modules only
- `standard`: 3 agents, all high+medium priority modules
- `deep`: 3+ agents (spawn more if >50 modules)

### For Each Batch of Modules
```
Task with subagent_type="module-documenter":

Document these modules comprehensively:

## Modules to Document
[List of module paths for this batch]

## Repository Context
[Architecture summary from Wave 2]

## Your Job
For EACH module, produce complete documentation including:
1. Module overview (purpose, responsibility)
2. Public API (all exports with signatures)
3. Internal architecture
4. Configuration options
5. Usage examples
6. Related modules

## Output Format
Return markdown documentation for each module.
Use file:line references to source code.
```

**Spawn 3 agents in parallel (or more for deep mode).**
**WAIT for all module documentation agents.**

---

## Wave 4: API & Examples (3 agents)

**Purpose**: Extract detailed API references and examples.

### Agent: API Extraction
```
Task with subagent_type="api-extractor":

Extract complete API documentation from this repository.

## Repository Info
[Classification results]
[Module documentation summary]

## Your Job
1. Find ALL public exports
2. Extract complete type signatures
3. Extract JSDoc/docstrings
4. Group APIs by category
5. Note deprecated APIs

## Mode: [MODE]
- quick: Main APIs only
- standard: All public APIs
- deep: Public + important internal APIs

Return structured API documentation in markdown.
```

### Agent: Test Example Extraction
```
Task with subagent_type="example-generator":

Extract usage examples from test files.

## Repository Info
[Test file locations from classification]

## Your Job
1. Find all test files
2. Extract test bodies that demonstrate usage
3. Simplify for documentation (remove assertions)
4. Categorize by feature/module
5. Add explanatory comments

Return examples organized by category.
```

### Agent: Example Generation
```
Task with subagent_type="example-generator":

Generate new usage examples for under-documented APIs.

## Repository Info
[API documentation from previous agent]
[Existing examples from test extraction]

## Your Job
1. Identify APIs without examples
2. Generate practical usage examples
3. Create "Getting Started" examples
4. Generate configuration examples
5. Create error handling examples

Return generated examples in markdown format.
```

**WAIT for all 3 agents.**

---

## Wave 5: Concepts & Guides (3 agents)

**Purpose**: Create developer guides and concept explanations.

### Agent: Concepts Documentation
```
Task with subagent_type="codebase-analyzer":

Identify and document key concepts in this repository.

## Repository Info
[Architecture analysis]
[Pattern analysis]

## Your Job
1. Identify domain-specific concepts
2. Identify technical concepts (patterns, abstractions)
3. Write clear explanations for each
4. Include code examples
5. Cross-reference with modules

Create concept documentation files.
```

### Agent: Developer Guides
```
Task with subagent_type="module-documenter":

Create developer guides for this repository.

## Repository Info
[Full analysis from previous waves]

## Your Job
Create these guides:
1. Getting Started - minimal setup to first success
2. Installation - complete setup instructions
3. Configuration - all config options explained
4. Development - how to develop/debug locally
5. Contributing - how to contribute

Each guide should be practical and actionable.
```

### Agent: Reference Documentation
```
Task with subagent_type="codebase-analyzer":

Create reference documentation.

## Repository Info
[Classification results]
[All modules and APIs]

## Your Job
1. Create glossary of terms
2. Create file index with descriptions
3. Summarize recent changes (from git/changelog)
4. Create troubleshooting section

Return reference documents.
```

**WAIT for all 3 agents.**

---

## Wave 6: Synthesis & Navigation (2 agents)

**Purpose**: Combine all documentation and create navigation.

### Agent: Navigation Builder
```
Task with subagent_type="doc-synthesizer":

Create navigation structure for all documentation.

## Generated Documentation
[List of all docs generated in waves 3-5]

## Your Job
1. Create main index.md
2. Create category index files
3. Add cross-references between docs
4. Ensure all docs are linked
5. Add "See Also" sections

Return index files and list of cross-reference edits needed.
```

### Agent: Quality Check
```
Task with subagent_type="codebase-analyzer":

Verify documentation quality and completeness.

## Generated Documentation
[Full list of generated docs]

## Your Job
1. Check all internal links work
2. Verify file:line references exist
3. Check for missing documentation (important files not documented)
4. Verify consistency of formatting
5. Check for orphaned pages

Return quality report with issues to fix.
```

**WAIT for both agents.**
**Apply any fixes from quality check.**

---

## Final Steps

### Write All Documentation

After all waves complete:

1. **Create output directory structure**
2. **Write each documentation file**
   - Use Write tool for new files
   - Write in parts if content is large (>50KB)
3. **Apply cross-reference edits**
4. **Create final index.md**

### Present Summary

```markdown
## Documentation Generated Successfully

**Repository**: [path]
**Mode**: [mode]
**Output**: [output-dir]

### Statistics
- Total files analyzed: [N]
- Documentation files generated: [N]
- Modules documented: [N]
- APIs documented: [N]
- Examples included: [N]

### Documentation Structure
[Tree view of generated docs]

### Quick Links
- [Main Index]([output]/index.md)
- [Getting Started]([output]/guides/getting-started.md)
- [API Reference]([output]/api/index.md)

### What's Documented
- Architecture: [list]
- Modules: [list]
- APIs: [list]
- Concepts: [list]

### Known Gaps
[Any areas that couldn't be documented]
```

---

## Mode-Specific Behavior

### Quick Mode
- Wave 1: Both agents
- Wave 2: Pattern analysis only (1 agent)
- Wave 3: Top 5 modules only (1 agent)
- Wave 4: Main APIs only (1 agent)
- Wave 5: Getting started guide only (1 agent)
- Wave 6: Navigation only (1 agent)
- **Total: ~6 agents**

### Standard Mode
- All waves as described
- **Total: ~12 agents**

### Deep Mode
- All waves with expanded scope
- Wave 3: More batches for modules (spawn additional agents)
- Wave 4: Include internal APIs
- Wave 5: More comprehensive guides
- **Total: 18+ agents**

---

## Error Handling

### Large Repository (>10,000 files)
```
This repository has [N] files. Generating comprehensive documentation will:
- Take significant time
- Use substantial tokens
- Generate [estimated] documentation files

Options:
1. Proceed with 'deep' mode (comprehensive)
2. Use 'standard' mode (recommended for large repos)
3. Use 'quick' mode (overview only)
4. Specify specific directories to document
```

### Missing Information
If an agent cannot find expected information:
- Note the gap in documentation
- Continue with available information
- Report gaps in final summary

### Agent Failures
If an agent fails or times out:
- Log the failure
- Continue with remaining agents
- Note incomplete sections in output

---

## Token Budget Notes

| Wave | Agents | Est. Tokens/Agent | Total |
|------|--------|-------------------|-------|
| 1 | 2 | ~15-20k | ~35k |
| 2 | 3 | ~25-30k | ~85k |
| 3 | 3+ | ~30-40k | ~100-150k |
| 4 | 3 | ~25-35k | ~90k |
| 5 | 3 | ~20-30k | ~75k |
| 6 | 2 | ~15-20k | ~35k |

**Standard mode total**: ~400-500k tokens
**Deep mode total**: ~600-800k tokens
```

### Success Criteria:

#### Automated Verification:
- [ ] Command file exists at `.claude/commands/generate_repo_docs.md`
- [ ] YAML frontmatter is valid
- [ ] All subagent_type references match existing agents

#### Manual Verification:
- [ ] Wave structure is clear and logical
- [ ] Mode differences are well-defined
- [ ] Error handling covers edge cases
- [ ] Output structure is comprehensive

**Implementation Note**: After completing this phase, pause for confirmation before proceeding to Phase 3.

---

## Phase 3: Test on Sample Repository

### Overview
Test the command on a small repository to verify functionality.

### Changes Required:

#### 1. Test Execution

Run the command on the current repository (crypto-docs-mcp) in quick mode:

```bash
# In Claude Code
/generate_repo_docs . --mode quick --output docs/test-generated
```

#### 2. Verify Output

Check that documentation was generated:
- `docs/test-generated/index.md` exists
- Architecture docs exist
- At least one module documented
- Navigation links work

#### 3. Iterate on Issues

Fix any issues discovered:
- Agent prompts that don't produce expected output
- Missing cross-references
- Formatting inconsistencies

### Success Criteria:

#### Automated Verification:
- [ ] `docs/test-generated/index.md` exists after running command
- [ ] At least 5 markdown files generated
- [ ] No broken internal links (grep for `](` and verify targets exist)

#### Manual Verification:
- [ ] Documentation is readable and useful
- [ ] Code examples are syntactically correct
- [ ] File:line references point to real locations
- [ ] Navigation is intuitive

**Implementation Note**: After completing this phase, pause for manual testing confirmation before proceeding to Phase 4.

---

## Phase 4: Refinement & Edge Cases

### Overview
Refine based on test results and add edge case handling.

### Changes Required:

#### 1. Add Monorepo Support

Enhance file-classifier to detect and handle monorepos:
- Detect workspace configurations
- Generate per-project documentation
- Create project index

#### 2. Add Language-Specific Handling

Add patterns for common languages:
- TypeScript/JavaScript
- Python
- Go
- Rust

#### 3. Add Progress Reporting

Update main command to report progress:
```markdown
## Progress

Wave 1: Discovery ████████████ Complete
Wave 2: Architecture ████████░░░░ In Progress (2/3 agents)
Wave 3: Modules ░░░░░░░░░░░░ Pending
...
```

### Success Criteria:

#### Automated Verification:
- [ ] Monorepo detection works (test with a monorepo structure)
- [ ] Language detection produces correct results

#### Manual Verification:
- [ ] Progress reporting is clear
- [ ] Edge cases handled gracefully

---

## Testing Strategy

### Unit Tests
- Test file classification logic with various file structures
- Test module boundary detection
- Test cross-reference generation

### Integration Tests
- Run on small repository (<100 files)
- Run on medium repository (~500 files)
- Run on monorepo structure

### Manual Testing Steps
1. Run `/generate_repo_docs . --mode quick` and verify basic output
2. Run `/generate_repo_docs . --mode standard` and check comprehensiveness
3. Test on external repository (clone a popular open-source project)
4. Verify all links in generated docs work
5. Check that examples compile/run

## Performance Considerations

- Wave-based execution prevents token exhaustion
- File batching in Wave 3 handles large codebases
- Mode selection allows user to trade depth for speed
- Parallel agent execution within waves maximizes throughput

## Migration Notes

No migration needed - this is a new command with no existing state.

## References

- Similar command: `.claude/commands/research_codebase.md`
- Similar command: `.claude/commands/update_readme.md`
- Wave pattern: `.claude/commands/predict_outcome_heavy.md`
- Agent definitions: `.claude/agents/codebase-analyzer.md`
