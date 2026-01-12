---
name: generate-repo-docs-guide
description: Guide for using the /generate_repo_docs command to create comprehensive repository documentation
allowed-tools: Read
---

# Guide: Generating Repository Documentation

This guide explains how to use the `/generate_repo_docs` command to automatically generate comprehensive markdown documentation for any codebase.

## What It Does

The `/generate_repo_docs` command analyzes an entire repository using hierarchical subagents and produces:

- **Architecture documentation** - System overview, data flow, dependencies, patterns
- **Module documentation** - Detailed docs for each module with API reference
- **API reference** - Complete documentation of all public exports
- **Developer guides** - Getting started, installation, configuration, development
- **Code examples** - Extracted from tests + newly generated examples
- **Concept explanations** - Domain and technical concepts explained
- **Reference materials** - Glossary, file index, changelog

## Quick Start

### Basic Usage

```
/generate_repo_docs
```

This runs in `standard` mode on the current directory, outputting to `docs/generated/`.

### Specify a Repository

```
/generate_repo_docs /path/to/repo
```

### Choose a Mode

```
/generate_repo_docs . --mode quick
/generate_repo_docs . --mode standard
/generate_repo_docs . --mode deep
```

### Custom Output Directory

```
/generate_repo_docs . --output docs/api-reference
```

### Full Example

```
/generate_repo_docs /Users/me/projects/my-library --mode deep --output documentation
```

## Documentation Modes

### Quick Mode

**Best for:** Getting a fast overview of an unfamiliar codebase

| Aspect | Details |
|--------|---------|
| Files analyzed | Entry points only |
| Docs generated | 5-10 files |
| Agents used | 6 |
| Time estimate | 2-5 minutes |
| Token usage | ~150-200k |

**What you get:**
- Architecture overview
- Top 5 module summaries
- Main API reference
- Getting started guide
- Basic navigation

### Standard Mode (Default)

**Best for:** Normal documentation needs, libraries, medium-sized projects

| Aspect | Details |
|--------|---------|
| Files analyzed | All high + medium priority |
| Docs generated | 20-50 files |
| Agents used | 12 |
| Time estimate | 5-15 minutes |
| Token usage | ~400-500k |

**What you get:**
- Full architecture docs (overview, data flow, dependencies, patterns)
- All module documentation
- Complete API reference
- All developer guides
- Examples (extracted + generated)
- Concepts and glossary

### Deep Mode

**Best for:** Comprehensive documentation, large projects, public libraries

| Aspect | Details |
|--------|---------|
| Files analyzed | All documentable files |
| Docs generated | 100+ files |
| Agents used | 18+ |
| Time estimate | 15-30 minutes |
| Token usage | ~600-800k |

**What you get:**
- Everything in standard mode, plus:
- Internal API documentation
- File-level documentation
- Exhaustive examples
- Advanced concept explanations
- Complete file index with descriptions

## Output Structure

After running the command, you'll find this structure in your output directory:

```
docs/generated/
├── index.md                      # Main entry point - start here
│
├── architecture/
│   ├── overview.md               # High-level system architecture
│   ├── data-flow.md              # How data moves through the system
│   ├── dependencies.md           # Internal and external dependencies
│   └── patterns.md               # Design patterns and conventions
│
├── modules/
│   ├── index.md                  # List of all modules
│   └── [module-name]/
│       ├── README.md             # Module overview and purpose
│       ├── api.md                # Module's public API
│       └── examples.md           # Usage examples for this module
│
├── api/
│   ├── index.md                  # API overview and quick reference
│   ├── functions.md              # All exported functions
│   ├── classes.md                # All exported classes
│   ├── types.md                  # Type definitions and interfaces
│   └── constants.md              # Exported constants
│
├── guides/
│   ├── getting-started.md        # Quick start (5-minute setup)
│   ├── installation.md           # Detailed installation instructions
│   ├── configuration.md          # All configuration options
│   ├── development.md            # Setting up for development
│   └── contributing.md           # How to contribute
│
├── concepts/
│   ├── index.md                  # Overview of key concepts
│   └── [concept-name].md         # Individual concept explanations
│
├── examples/
│   ├── index.md                  # Examples overview
│   ├── basic/                    # Basic usage examples
│   ├── advanced/                 # Advanced patterns
│   └── integration/              # Integration with other tools
│
└── reference/
    ├── glossary.md               # Terms and definitions
    ├── file-index.md             # Every source file with description
    └── changelog-summary.md      # Recent changes summary
```

## How It Works

The command uses a 6-wave hierarchical agent architecture:

```
Wave 1: Discovery & Classification
        ↓
        2 agents scan and classify all files
        ↓
Wave 2: Architecture Analysis
        ↓
        3 agents analyze dependencies, patterns, data flow
        ↓
Wave 3: Module Documentation
        ↓
        3-6 agents document modules in parallel batches
        ↓
Wave 4: API & Examples
        ↓
        3 agents extract APIs and generate examples
        ↓
Wave 5: Concepts & Guides
        ↓
        3 agents write developer guides and concepts
        ↓
Wave 6: Synthesis & Navigation
        ↓
        2 agents create navigation and verify quality
        ↓
     [Documentation Written to Disk]
```

## Best Practices

### When to Use Each Mode

| Scenario | Recommended Mode |
|----------|------------------|
| "What is this repo?" | `quick` |
| New team member onboarding | `standard` |
| Internal library documentation | `standard` |
| Public library documentation | `deep` |
| Monorepo documentation | `deep` |
| Quick architecture review | `quick` |

### Tips for Best Results

1. **Run from repository root** - The command works best when run from the root directory

2. **Ensure code is in good state** - Run on code that compiles/passes tests for accurate analysis

3. **Start with quick mode** - Preview what will be documented before running deep mode

4. **Review and customize** - Generated docs are a starting point; add project-specific context

5. **Re-run after major changes** - Keep documentation in sync with code changes

### Handling Large Repositories

For repos with 5000+ files, you'll see a warning:

```
This repository has [N] files.

Options:
1. Proceed with current mode
2. Switch to 'quick' mode
3. Specify directories to document
```

**Recommendations for large repos:**
- Start with `quick` mode to understand structure
- Use `standard` mode for most cases (it filters by priority)
- Only use `deep` mode if you need exhaustive docs
- Consider documenting specific directories if the repo is huge

## What Gets Documented

### Included (by default)

- Source code files (`.ts`, `.js`, `.py`, `.go`, `.rs`, etc.)
- Public APIs and exports
- Type definitions and interfaces
- Configuration files
- README content
- Test files (for example extraction)

### Excluded (automatically)

- `node_modules/`, `vendor/`, `__pycache__/`
- `dist/`, `build/`, `.next/`, `.nuxt/`
- `.git/`, `.cache/`, `coverage/`
- Generated files, minified files, source maps
- Lock files (`package-lock.json`, `yarn.lock`)

## Understanding the Output

### File References

Documentation includes source code links in this format:

```markdown
**Source:** [`src/client.ts:45`](../src/client.ts#L45)
```

These link directly to the source file and line number.

### Example Sources

Examples are marked with their origin:

```markdown
**Source:** Adapted from [`tests/client.test.ts:123`](../tests/client.test.ts#L123)
```

Or for generated examples:

```markdown
*Generated example*
```

### Cross-References

Documents link to related content:

```markdown
## See Also

- [Related Module](./other-module.md) - How they work together
- [API Reference](../api/functions.md#functionName) - Full API docs
```

## Troubleshooting

### "No documentable files found"

- Check that the path is correct
- Ensure the repository contains source code
- Verify files aren't all in excluded directories

### Documentation seems incomplete

- Try `standard` or `deep` mode for more coverage
- Check if key files are in unusual locations
- Some languages may have less complete extraction

### Broken internal links

- Run the quality check that's included in Wave 6
- Links to source files require the source to still exist
- Moving generated docs breaks relative links

### Takes too long

- Use `quick` mode for faster results
- Document specific directories instead of entire repo
- Large repos (5000+ files) naturally take longer

## Examples

### Document a Node.js Library

```
/generate_repo_docs ~/projects/my-npm-package --mode standard
```

### Quick Overview of Downloaded Repo

```
cd ~/Downloads/some-repo
/generate_repo_docs . --mode quick
```

### Comprehensive Docs for Public Release

```
/generate_repo_docs . --mode deep --output docs/v2.0
```

### Document Only the Source Directory

```
/generate_repo_docs ./src --mode standard
```

## Comparison with Other Commands

| Command | Purpose | Output |
|---------|---------|--------|
| `/generate_repo_docs` | Comprehensive documentation generation | Many markdown files |
| `/update_readme` | Update/create README.md | Single README file |
| `/explain_this_codebase_simply` | Quick orientation | In-chat response |
| `/research_codebase` | Answer specific questions | Research document |

Use `/generate_repo_docs` when you need **standalone, browseable documentation** that can be committed to the repo or hosted separately.
