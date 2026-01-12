# Generate Repository Documentation Guide

A comprehensive guide for using the `/generate_repo_docs` command to automatically generate extensive markdown documentation for any codebase.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Command Syntax](#command-syntax)
- [Documentation Modes](#documentation-modes)
- [Output Structure](#output-structure)
- [How It Works](#how-it-works)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [What Gets Documented](#what-gets-documented)
- [Understanding the Output](#understanding-the-output)
- [Large Repository Handling](#large-repository-handling)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Overview

The `/generate_repo_docs` command uses **hierarchical subagents** to analyze an entire repository and produce comprehensive documentation. It's designed to handle codebases of any size—from small libraries to massive monorepos with 4000+ files.

### What It Generates

| Category | Description |
|----------|-------------|
| **Architecture** | System overview, data flow diagrams, dependency maps, design patterns |
| **Modules** | Detailed documentation for each module with API reference and examples |
| **API Reference** | Complete documentation of all public exports with type signatures |
| **Developer Guides** | Getting started, installation, configuration, development, contributing |
| **Code Examples** | Extracted from tests + newly generated practical examples |
| **Concepts** | Domain and technical concept explanations |
| **Reference** | Glossary, file index, changelog summary |

### Key Features

- **Intelligent file classification** - Automatically identifies what's important to document
- **Parallel processing** - Uses up to 18+ agents across 6 waves for speed
- **Source code linking** - All documentation includes `file:line` references
- **Example extraction** - Pulls real examples from your test files
- **Cross-referencing** - Automatic linking between related documentation
- **Multiple modes** - Quick overview to exhaustive deep documentation

---

## Quick Start

### Document Current Directory

```
/generate_repo_docs
```

### Document a Specific Repository

```
/generate_repo_docs /path/to/repo
```

### Quick Overview Mode

```
/generate_repo_docs . --mode quick
```

### Full Documentation

```
/generate_repo_docs . --mode deep --output docs/api
```

---

## Command Syntax

```
/generate_repo_docs [path] [--mode <mode>] [--output <directory>]
```

### Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `path` | No | `.` (current directory) | Path to the repository to document |
| `--mode` | No | `standard` | Documentation depth: `quick`, `standard`, or `deep` |
| `--output` | No | `docs/generated` | Output directory for generated documentation |

### Examples

```bash
# All defaults - standard mode, current directory, docs/generated output
/generate_repo_docs

# Specify repository path
/generate_repo_docs ~/projects/my-library

# Quick mode for fast overview
/generate_repo_docs . --mode quick

# Deep mode with custom output
/generate_repo_docs /path/to/repo --mode deep --output documentation

# Combine all options
/generate_repo_docs ~/code/big-project --mode standard --output docs/v2
```

---

## Documentation Modes

### Quick Mode

**Use when:** You need a fast overview of an unfamiliar codebase or want to preview what will be documented.

| Aspect | Value |
|--------|-------|
| **Files Analyzed** | Entry points only |
| **Docs Generated** | 5-10 files |
| **Agents Used** | 6 |
| **Estimated Time** | 2-5 minutes |
| **Token Usage** | ~150-200k |

**Output includes:**
- Architecture overview (1 file)
- Top 5 module summaries
- Main API reference
- Getting started guide
- Basic navigation index

---

### Standard Mode (Default)

**Use when:** You need complete documentation for a library, service, or medium-sized project.

| Aspect | Value |
|--------|-------|
| **Files Analyzed** | All high + medium priority files |
| **Docs Generated** | 20-50 files |
| **Agents Used** | 12 |
| **Estimated Time** | 5-15 minutes |
| **Token Usage** | ~400-500k |

**Output includes:**
- Full architecture documentation (4 files)
- All module documentation with APIs
- Complete API reference
- All developer guides (5 files)
- Examples (extracted + generated)
- Concepts and glossary
- File index and references

---

### Deep Mode

**Use when:** You need exhaustive documentation for public libraries, large projects, or comprehensive internal documentation.

| Aspect | Value |
|--------|-------|
| **Files Analyzed** | All documentable files |
| **Docs Generated** | 100+ files |
| **Agents Used** | 18+ |
| **Estimated Time** | 15-30 minutes |
| **Token Usage** | ~600-800k |

**Output includes everything in standard mode, plus:**
- Internal API documentation
- File-level documentation
- Exhaustive examples for all APIs
- Advanced concept explanations
- Complete file index with line counts and descriptions
- Detailed troubleshooting guides

---

### Mode Comparison Table

| Feature | Quick | Standard | Deep |
|---------|-------|----------|------|
| Architecture overview | ✓ | ✓ | ✓ |
| Data flow documentation | - | ✓ | ✓ |
| Dependency analysis | - | ✓ | ✓ |
| Pattern documentation | - | ✓ | ✓ |
| Module documentation | Top 5 | All | All + internals |
| API reference | Main only | All public | Public + internal |
| Getting started guide | ✓ | ✓ | ✓ |
| Installation guide | - | ✓ | ✓ |
| Configuration guide | - | ✓ | ✓ |
| Development guide | - | ✓ | ✓ |
| Contributing guide | - | ✓ | ✓ |
| Extracted examples | Few | Many | Exhaustive |
| Generated examples | Basic | Standard | Comprehensive |
| Concept explanations | - | Key concepts | All concepts |
| Glossary | - | ✓ | ✓ |
| File index | - | Summary | Detailed |

---

## Output Structure

After running the command, documentation is organized as follows:

```
docs/generated/
│
├── index.md                          # START HERE - Main entry point
│
├── architecture/
│   ├── overview.md                   # High-level system architecture
│   ├── data-flow.md                  # How data moves through the system
│   ├── dependencies.md               # Internal and external dependencies
│   └── patterns.md                   # Design patterns and conventions used
│
├── modules/
│   ├── index.md                      # List of all modules with descriptions
│   │
│   ├── auth/                         # Example module
│   │   ├── README.md                 # Module overview, purpose, architecture
│   │   ├── api.md                    # Module's public API reference
│   │   └── examples.md               # Usage examples for this module
│   │
│   ├── database/                     # Another module
│   │   ├── README.md
│   │   ├── api.md
│   │   └── examples.md
│   │
│   └── [other-modules]/              # One directory per module
│
├── api/
│   ├── index.md                      # API overview and quick reference
│   ├── functions.md                  # All exported functions
│   ├── classes.md                    # All exported classes
│   ├── types.md                      # Type definitions and interfaces
│   └── constants.md                  # Exported constants and enums
│
├── guides/
│   ├── getting-started.md            # 5-minute quick start
│   ├── installation.md               # Detailed setup instructions
│   ├── configuration.md              # All configuration options explained
│   ├── development.md                # Local development setup
│   └── contributing.md               # How to contribute to the project
│
├── concepts/
│   ├── index.md                      # Overview of key concepts
│   ├── authentication.md             # Example concept
│   ├── caching.md                    # Example concept
│   └── [other-concepts].md           # One file per concept
│
├── examples/
│   ├── index.md                      # Examples overview and categories
│   ├── basic/
│   │   ├── hello-world.md            # Simplest possible example
│   │   └── configuration.md          # Basic configuration examples
│   ├── advanced/
│   │   ├── custom-middleware.md      # Advanced usage patterns
│   │   └── performance.md            # Performance optimization examples
│   └── integration/
│       ├── express.md                # Integration with Express
│       └── react.md                  # Integration with React
│
└── reference/
    ├── glossary.md                   # Terms and definitions
    ├── file-index.md                 # Every source file with description
    └── changelog-summary.md          # Recent changes summary
```

### Navigation

Every documentation file includes:

- **Breadcrumbs** - Know where you are in the hierarchy
- **See Also** - Links to related documentation
- **Source links** - Direct links to source code
- **Previous/Next** - Sequential navigation where applicable

---

## How It Works

The command uses a **6-wave hierarchical architecture** with specialized agents:

```
┌─────────────────────────────────────────────────────────────────┐
│                    WAVE 1: Discovery                             │
│                    (2 agents)                                    │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ Structure        │    │ File             │                   │
│  │ Discovery        │    │ Classifier       │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           └──────────┬───────────┘                              │
│                      ▼                                          │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WAVE 2: Architecture                          │
│                    (3 agents in parallel)                        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Dependency   │  │ Pattern      │  │ Data Flow    │          │
│  │ Analysis     │  │ Analysis     │  │ Analysis     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WAVE 3: Module Documentation                  │
│                    (3-6 agents, batched)                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Batch 1      │  │ Batch 2      │  │ Batch 3      │          │
│  │ (modules     │  │ (modules     │  │ (modules     │          │
│  │  1-10)       │  │  11-20)      │  │  21-30)      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WAVE 4: API & Examples                        │
│                    (3 agents in parallel)                        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ API          │  │ Test Example │  │ Example      │          │
│  │ Extractor    │  │ Extractor    │  │ Generator    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WAVE 5: Concepts & Guides                     │
│                    (3 agents in parallel)                        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Concepts     │  │ Developer    │  │ Reference    │          │
│  │ Writer       │  │ Guides       │  │ Docs         │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WAVE 6: Synthesis                             │
│                    (2 agents in parallel)                        │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────┐          │
│  │ Navigation           │    │ Quality              │          │
│  │ Builder              │    │ Checker              │          │
│  └──────────┬───────────┘    └──────────┬───────────┘          │
│             └────────────┬───────────────┘                      │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │ Write Documentation   │                          │
│              │ to Disk               │                          │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Types Used

| Agent | Purpose |
|-------|---------|
| `codebase-locator` | Finds files and maps structure |
| `file-classifier` | Classifies files by importance |
| `codebase-analyzer` | Analyzes implementation details |
| `codebase-pattern-finder` | Identifies patterns and conventions |
| `module-documenter` | Writes comprehensive module docs |
| `api-extractor` | Extracts API signatures and JSDoc |
| `example-generator` | Extracts and generates examples |
| `doc-synthesizer` | Creates navigation and indexes |

---

## Best Practices

### Choosing the Right Mode

| Scenario | Recommended Mode |
|----------|------------------|
| "What is this codebase?" | `quick` |
| New team member onboarding | `standard` |
| Internal library documentation | `standard` |
| Open source library release | `deep` |
| Monorepo documentation | `deep` |
| Quick architecture review | `quick` |
| API reference generation | `standard` |
| Compliance/audit documentation | `deep` |

### Tips for Best Results

1. **Run from repository root**
   ```
   cd /path/to/repo
   /generate_repo_docs
   ```

2. **Ensure code compiles** - Run on working code for accurate analysis

3. **Start with quick mode** - Preview what will be documented
   ```
   /generate_repo_docs . --mode quick
   # Review output, then:
   /generate_repo_docs . --mode standard
   ```

4. **Use meaningful commit state** - Document a tagged release or stable branch

5. **Review and customize** - Generated docs are a starting point; add project-specific context

6. **Keep docs in sync** - Re-run after major changes to the codebase

### What to Do After Generation

1. **Review `index.md`** - Ensure the project description is accurate
2. **Check getting-started.md** - Verify the quick start actually works
3. **Add custom sections** - Project-specific information that agents couldn't infer
4. **Commit the docs** - Add to version control
5. **Set up hosting** - Consider GitHub Pages, ReadTheDocs, or similar

---

## Examples

### Document a Node.js Library

```
/generate_repo_docs ~/projects/my-npm-package --mode standard
```

**Output:** Complete library documentation with API reference, examples extracted from Jest tests, and npm-specific installation instructions.

### Quick Overview of Downloaded Repository

```
cd ~/Downloads/interesting-project
/generate_repo_docs . --mode quick
```

**Output:** Fast overview to understand architecture, main entry points, and key modules.

### Comprehensive Documentation for Open Source Release

```
/generate_repo_docs . --mode deep --output docs
```

**Output:** Exhaustive documentation suitable for public release, including all internal APIs and comprehensive examples.

### Document a Python Project

```
/generate_repo_docs ~/code/python-service --mode standard
```

**Output:** Documentation with Python-specific patterns, docstring extraction, and pytest example extraction.

### Document a Monorepo

```
/generate_repo_docs ~/work/monorepo --mode deep
```

**Output:** Per-package documentation with cross-references between packages, workspace structure documentation, and shared dependency analysis.

### Generate Only API Reference

```
/generate_repo_docs ./src --mode standard --output docs/api
```

**Output:** Focused documentation on just the source directory.

---

## What Gets Documented

### Included by Default

**Source Code:**
- `.ts`, `.tsx` - TypeScript
- `.js`, `.jsx`, `.mjs`, `.cjs` - JavaScript
- `.py` - Python
- `.go` - Go
- `.rs` - Rust
- `.java` - Java
- `.rb` - Ruby
- `.php` - PHP
- `.cs` - C#
- `.cpp`, `.cc`, `.c`, `.h` - C/C++
- `.swift` - Swift
- `.kt` - Kotlin

**Configuration:**
- `package.json`, `tsconfig.json`
- `pyproject.toml`, `setup.py`
- `Cargo.toml`
- `go.mod`
- `.env.example`

**Documentation:**
- `README.md`, `CONTRIBUTING.md`
- `CHANGELOG.md`
- Existing `docs/` content

**Tests (for example extraction):**
- `*.test.ts`, `*.spec.ts`
- `test_*.py`, `*_test.py`
- `*_test.go`
- `*.test.js`, `*.spec.js`

### Excluded Automatically

```
node_modules/          # Dependencies
dist/, build/          # Build output
.git/                  # Version control
vendor/                # Vendored dependencies
__pycache__/          # Python cache
.next/, .nuxt/        # Framework builds
coverage/              # Test coverage
.cache/                # Various caches
*.min.js              # Minified files
*.bundle.js           # Bundles
*.map                 # Source maps
package-lock.json     # Lock files
yarn.lock
```

### Priority Classification

| Priority | Examples | Documented In |
|----------|----------|---------------|
| **HIGH** | Entry points, public APIs, core logic | All modes |
| **MEDIUM** | Utilities, config, internal services | Standard, Deep |
| **LOW** | Tests, mocks, fixtures | Deep only (for examples) |
| **SKIP** | node_modules, dist, generated | Never |

---

## Understanding the Output

### Source Code Links

Documentation includes direct links to source:

```markdown
**Source:** [`src/auth/client.ts:45`](../src/auth/client.ts#L45)
```

Click to jump directly to that line in the source file.

### Example Attribution

Examples show their origin:

**Extracted from tests:**
```markdown
**Source:** Adapted from [`tests/auth.test.ts:123`](../tests/auth.test.ts#L123)
```

**Generated:**
```markdown
*Generated example based on API analysis*
```

### Cross-References

Related documentation is linked:

```markdown
## See Also

- [Authentication Module](./modules/auth/README.md) - Full module documentation
- [Session Management](./concepts/sessions.md) - Related concept
- [login() API](./api/functions.md#login) - API reference
```

### Navigation Elements

Every page includes:

```markdown
---

← [Previous: Installation](./installation.md) |
[Up: Guides](./index.md) |
[Next: Configuration](./configuration.md) →
```

---

## Large Repository Handling

### Automatic Warning

For repositories with 5000+ files:

```
⚠️  This repository has 7,432 files.

Comprehensive documentation will:
- Analyze ~1,200 documentable files
- Generate ~150 documentation files
- Use 18+ agents across 6 waves
- Take approximately 20-30 minutes

Options:
1. Proceed with 'standard' mode (recommended)
2. Switch to 'quick' mode (faster, overview only)
3. Specify directories: /generate_repo_docs ./src ./lib
```

### Strategies for Large Codebases

1. **Start with quick mode**
   ```
   /generate_repo_docs . --mode quick
   ```
   Review the structure, then decide on full documentation.

2. **Document specific directories**
   ```
   /generate_repo_docs ./src/core --mode deep
   ```

3. **Use standard mode** - It filters by priority, documenting only important files.

4. **Run overnight** - Deep mode on large repos can take 30+ minutes.

### Monorepo Support

The command automatically detects monorepos by looking for:
- `workspaces` in `package.json`
- `lerna.json`
- `pnpm-workspace.yaml`
- Multiple `package.json` files

**Monorepo output includes:**
- Per-package documentation
- Cross-package dependency maps
- Shared module documentation
- Workspace structure overview

---

## Troubleshooting

### "No documentable files found"

**Causes:**
- Wrong path specified
- Repository contains only excluded file types
- All code is in an unusual directory

**Solutions:**
```bash
# Verify path
ls /path/to/repo

# Check for source files
find /path/to/repo -name "*.ts" -o -name "*.py" -o -name "*.js"

# Try specifying source directory directly
/generate_repo_docs /path/to/repo/src
```

### Documentation seems incomplete

**Causes:**
- Using quick mode
- Files classified as low priority
- Unusual file naming conventions

**Solutions:**
```bash
# Use deeper mode
/generate_repo_docs . --mode deep

# Check classification results in the command output
# Look for "Statistics" section showing file counts
```

### Broken internal links

**Causes:**
- Source files moved after documentation generated
- Documentation moved to different location
- Relative path issues

**Solutions:**
- Regenerate documentation after moving files
- Keep generated docs in the specified output directory
- Don't restructure source after generating docs

### Command takes too long

**Causes:**
- Large repository (5000+ files)
- Deep mode on medium+ repo
- Slow network (if fetching external info)

**Solutions:**
```bash
# Use faster mode
/generate_repo_docs . --mode quick

# Document specific directories
/generate_repo_docs ./src --mode standard

# Run in background and check later
```

### Missing examples

**Causes:**
- No test files found
- Tests don't follow standard naming
- Tests are in unusual location

**Solutions:**
- Ensure tests use standard naming (`*.test.ts`, `test_*.py`, etc.)
- The command will generate examples even without tests
- Check `examples/` directory in output for generated examples

### Incorrect project type detection

**Causes:**
- Missing or non-standard package configuration
- Multiple project types in repo

**Solutions:**
- Ensure `package.json`, `pyproject.toml`, etc. exists
- For monorepos, ensure workspace configuration is present
- Generated docs can be manually corrected

---

## FAQ

### How is this different from JSDoc/TypeDoc/Sphinx?

| Feature | generate_repo_docs | Traditional Tools |
|---------|-------------------|-------------------|
| Setup required | None | Configuration files |
| Language support | Any | Language-specific |
| Architecture docs | Yes | No |
| Example generation | Yes | No |
| Cross-referencing | Automatic | Manual |
| Guide writing | Yes | No |

### Can I customize the output format?

The output is standard Markdown, so you can:
- Edit generated files
- Add custom sections
- Change styling via your documentation platform
- Move files to different locations

### How often should I regenerate docs?

- **After major releases** - Tag a release, generate docs
- **After significant refactoring** - Architecture may have changed
- **Before onboarding** - Ensure docs match current code
- **Quarterly** - As a maintenance task

### Can I document private repositories?

Yes, the command runs locally and doesn't send code externally. All analysis happens on your machine.

### What about proprietary code?

Same as above - all processing is local. Generated documentation can be kept internal or published as you choose.

### Does it work with all programming languages?

It works best with:
- TypeScript/JavaScript (excellent)
- Python (excellent)
- Go (very good)
- Rust (very good)
- Java (good)
- Other languages (basic support)

### Can I exclude certain files or directories?

Currently, exclusion is automatic based on common patterns. To document specific parts:
```
/generate_repo_docs ./src/public-api --mode standard
```

### How do I update existing documentation?

The command replaces all generated documentation. To update:
1. Re-run the command with same output directory
2. All files in output directory will be regenerated
3. Any manual additions outside the output directory are preserved

---

## Related Commands

| Command | Use Case | Output |
|---------|----------|--------|
| `/generate_repo_docs` | Comprehensive standalone documentation | Many markdown files |
| `/update_readme` | Update project README only | Single README.md |
| `/explain_this_codebase_simply` | Quick verbal explanation | Chat response |
| `/research_codebase` | Answer specific questions | Research document |

---

## Version History

- **v1.0** - Initial release with 6-wave architecture, 3 modes, 5 specialized agents

---

*This guide documents the `/generate_repo_docs` command. For issues or feature requests, please open an issue in the repository.*
