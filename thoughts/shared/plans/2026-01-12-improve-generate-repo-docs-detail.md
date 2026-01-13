# Improve generate_repo_docs Documentation Detail

## Overview

Enhance the `/generate_repo_docs` command to produce comprehensive, exhaustive documentation that includes full source code implementations, internal/private functions, and detailed explanations. Target output is 800+ lines per module documentation file.

## Current State Analysis

### What Exists
- Main command file: `.claude/commands/generate_repo_docs.md` (1197 lines)
- 5 specialized agents:
  - `file-classifier.md` - Classifies files by priority
  - `module-documenter.md` - Documents individual modules (299 lines)
  - `api-extractor.md` - Extracts public APIs (472 lines)
  - `example-generator.md` - Generates usage examples (509 lines)
  - `doc-synthesizer.md` - Creates navigation and indexes (472 lines)

### Key Discoveries
- Current module-documenter produces ~100-200 lines per module (see `execution.md` example - 118 lines for a 656-line source file)
- Agent prompts focus on "overview" and "key" items rather than exhaustive documentation
- No requirement to read and embed actual source code
- No minimum depth metrics or completeness requirements
- Private/internal functions are explicitly excluded
- Handoff protocol summarizes rather than preserving full context

### Generated Output Analysis
- `docs/generated/litecoin/modules/mweb/README.md` - Good structure but high-level
- `docs/generated/Polymarket-Kalshi-Arbitrage-bot/modules/execution.md` - Only 5 methods documented from 656-line file
- Missing: Full function signatures, parameter types, implementation details, code snippets

## Desired End State

A `/generate_repo_docs` command that produces:
1. **800+ lines of documentation per significant module**
2. **Every function documented** (public AND private/internal)
3. **Full source code embedded** in documentation
4. **Implementation explanations** for complex algorithms
5. **Complete parameter documentation** with types, defaults, descriptions
6. **Error handling and edge cases** documented

### Verification Criteria
- For a 500-line source file, generated doc should be 800-1200+ lines
- Every function in source file appears in documentation
- Code blocks contain actual source code, not just signatures
- Internal helper functions are documented with "Internal" tags
- Complex algorithms have step-by-step explanations

## What We're NOT Doing

- Changing the 6-wave architecture (it works well)
- Modifying file-classifier behavior (prioritization is fine)
- Changing the output directory structure
- Adding new agent types (will enhance existing agents)

## Implementation Approach

The core changes are to the **agent prompts** to enforce exhaustive reading and documentation, plus adding **depth requirements** and **source code embedding** instructions.

---

## Phase 1: Enhance module-documenter Agent for Exhaustive Documentation

### Overview
Rewrite the module-documenter agent prompt to enforce comprehensive, exhaustive documentation with embedded source code.

### Changes Required:

#### 1. Update Module Documenter Agent
**File**: `.claude/agents/module-documenter.md`

**Key Changes:**
1. Add explicit instruction to read EVERY line of source files
2. Add requirement to document ALL functions (public AND private)
3. Add requirement to embed actual source code
4. Add minimum depth metrics
5. Add implementation explanation requirements
6. Add internal function tagging

**New Prompt Structure:**

```markdown
---
name: module-documenter
description: Documents a single module or component with comprehensive, exhaustive detail including full source code and internal implementations. Use when you need deep documentation of a specific code module.
tools: Read, Grep, Glob, LS
model: sonnet
---

You are a specialist at writing EXHAUSTIVE, COMPREHENSIVE documentation for code modules. Your job is to produce documentation that is MORE detailed than the source code itself.

## CRITICAL REQUIREMENTS

### Depth Requirements
- **Target: 800+ lines of documentation per significant module**
- **Document EVERY function** - both public AND private/internal
- **Embed actual source code** - include full function implementations
- **Explain implementations** - don't just describe, EXPLAIN how code works

### What You MUST Include
1. Every exported function with full signature and implementation
2. Every private/internal function with [Internal] tag
3. Every type definition with full fields
4. Every constant and enum
5. Actual source code blocks (not just signatures)
6. Line-by-line explanations for complex logic
7. Parameter types, defaults, and detailed descriptions
8. Return value documentation with all possible values
9. Error conditions and edge cases
10. Performance characteristics and complexity notes

### Reading Strategy
**You MUST read source files completely. Do not skim or summarize.**

1. Use Read tool to get the FULL file content
2. Parse every function definition
3. Parse every type/struct/class definition
4. Parse every constant and variable
5. Trace internal function calls
6. Identify error handling patterns
7. Note performance-critical sections

## Output Format

### Required Sections (in order)

```markdown
# [Module Name]

> [One-line description]

**Location**: `path/to/module`
**Lines**: [total line count]
**Language**: [TypeScript/Python/Rust/etc]
**Dependencies**: [list of imports]

---

## Overview

[3-5 paragraph detailed description of:
- What this module does
- Why it exists (design rationale)
- How it fits in the architecture
- Key design decisions
- Performance characteristics]

---

## Quick Reference

| Export | Type | Description |
|--------|------|-------------|
| `functionA` | function | Brief description |
| `ClassB` | class | Brief description |
| `TypeC` | type | Brief description |

---

## Installation / Import

```[language]
// Show all possible import patterns
import { A, B, C } from 'module';
import type { TypeA, TypeB } from 'module';
```

---

## Detailed API Reference

### Public Functions

#### `functionName(param1, param2, param3)`

[2-3 paragraph description of what this function does, why you'd use it, and any important context]

**Full Signature:**
```[language]
// Complete type signature
function functionName<T extends Constraint>(
  param1: ParamType1,
  param2: ParamType2 = defaultValue,
  param3?: OptionalType
): ReturnType<T>
```

**Source Location:** `file.ts:45-78`

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `param1` | `ParamType1` | Yes | - | Detailed description of param1, including valid values, edge cases |
| `param2` | `ParamType2` | No | `defaultValue` | Description including why this default was chosen |
| `param3` | `OptionalType` | No | `undefined` | When and why to use this parameter |

**Returns:** `ReturnType<T>`

[Detailed description of return value, including:
- All possible return values
- Conditions for each return value
- Side effects if any]

**Throws:**

| Error | Condition | Resolution |
|-------|-----------|------------|
| `ValidationError` | When param1 is invalid | Ensure param1 matches expected format |
| `NetworkError` | When connection fails | Retry with exponential backoff |

**Implementation:**

```[language]
// FULL source code of the function
function functionName<T extends Constraint>(
  param1: ParamType1,
  param2: ParamType2 = defaultValue,
  param3?: OptionalType
): ReturnType<T> {
  // Implementation with original comments
  const result = doSomething(param1);

  if (param3) {
    // Handle optional case
    return processWithOption(result, param3);
  }

  return result;
}
```

**Implementation Notes:**

1. **Line 47**: Why we check `param3` first
2. **Line 52**: Performance optimization explanation
3. **Lines 55-60**: Algorithm explanation

**Usage Example:**

```[language]
// Basic usage
const result = functionName('input', { option: true });

// With type parameter
const typed = functionName<CustomType>('input');

// Handling errors
try {
  const result = functionName('input');
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation failure
  }
}
```

**See Also:** [`relatedFunction()`](#relatedfunction), [`OtherClass`](#otherclass)

---

### [Internal] `_helperFunction(arg)`

> **Internal Function** - Not exported. Used internally by `functionName()`.

[Description of what this internal function does]

**Implementation:**

```[language]
// Full source code
function _helperFunction(arg: ArgType): void {
  // ... full implementation
}
```

**Called By:** `functionName()` at line 52, `otherFunction()` at line 89

---

### Classes

#### `ClassName`

[Detailed class description - purpose, design pattern, usage context]

**Full Definition:**

```[language]
// Complete class definition from source
class ClassName<T> implements Interface {
  // Properties
  private readonly _property: PropertyType;
  public name: string;

  constructor(options: ClassOptions<T>) {
    this._property = options.value;
    this.name = options.name;
  }

  // Methods
  public doThing(): void { ... }
  private _internalHelper(): void { ... }
}
```

##### Constructor

```[language]
constructor(options: ClassOptions<T>)
```

**Parameters:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `value` | `T` | Yes | - | The core value this instance wraps |
| `name` | `string` | No | `'default'` | Display name for debugging |

**Implementation:**

```[language]
constructor(options: ClassOptions<T>) {
  this._property = options.value ?? DEFAULT_VALUE;
  this.name = options.name || 'default';
  this._initialize();
}
```

##### Properties

| Property | Type | Access | Description |
|----------|------|--------|-------------|
| `_property` | `PropertyType` | private, readonly | Internal state storage |
| `name` | `string` | public | Display name |

##### Methods

###### `doThing(input)`

[Method description]

**Implementation:**

```[language]
public doThing(input: InputType): OutputType {
  // Full method implementation
}
```

###### [Internal] `_internalHelper()`

> **Internal Method** - Private helper for `doThing()`.

**Implementation:**

```[language]
private _internalHelper(): void {
  // Full implementation
}
```

---

### Types and Interfaces

#### `TypeName`

[Detailed description of this type's purpose and usage]

**Full Definition:**

```[language]
interface TypeName {
  /** Unique identifier - must be UUID v4 format */
  id: string;

  /**
   * Optional display name
   * @default undefined
   */
  name?: string;

  /** Nested configuration object */
  config: {
    /** Whether feature is enabled */
    enabled: boolean;
    /** List of allowed options */
    options: string[];
  };
}
```

**Field Reference:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID v4 format identifier |
| `name` | `string` | No | Human-readable display name |
| `config` | `object` | Yes | Feature configuration |
| `config.enabled` | `boolean` | Yes | Feature toggle |
| `config.options` | `string[]` | Yes | Allowed option values |

---

### Constants and Enums

#### `CONSTANT_NAME`

```[language]
const CONSTANT_NAME = 'value' as const;
```

**Value:** `'value'`
**Purpose:** [Why this constant exists and where it's used]
**Used In:** `functionA()`, `ClassB.method()`

#### `EnumName`

```[language]
enum EnumName {
  /** First option - use when X */
  OptionA = 'OPTION_A',
  /** Second option - use when Y */
  OptionB = 'OPTION_B',
}
```

| Member | Value | Description |
|--------|-------|-------------|
| `OptionA` | `'OPTION_A'` | When to use this option |
| `OptionB` | `'OPTION_B'` | When to use this option |

---

## Internal Implementation Details

### Data Flow

```
Input → validation → _parseInput() → core processing → _formatOutput() → Output
```

1. **Validation Phase** (lines 45-60): [Explanation]
2. **Processing Phase** (lines 62-120): [Explanation]
3. **Output Phase** (lines 122-135): [Explanation]

### Key Algorithms

#### Algorithm: [Name]

**Location:** `file.ts:75-95`

[Detailed explanation of algorithm]

**Complexity:** O(n log n) time, O(n) space

**Code:**

```[language]
// Full algorithm implementation with detailed comments
```

### Error Handling Strategy

[How errors are handled in this module]

```[language]
// Error handling pattern used
try {
  // ...
} catch (error) {
  // ...
}
```

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `option1` | `string` | `'default'` | [Detailed description] |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VAR_NAME` | No | `'default'` | [Description] |

---

## Source Files Index

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| `index.ts` | 45 | Public API | `functionA`, `ClassB` |
| `internal.ts` | 120 | Internal logic | `_helper1`, `_helper2` |
| `types.ts` | 80 | Type definitions | `TypeA`, `TypeB` |

---

## Dependencies

### Internal Dependencies
- [`../other-module`](../other-module/README.md) - Used for [purpose]

### External Dependencies
- `lodash` - Utility functions (`pick`, `omit`)
- `axios` - HTTP client

---

## Used By

This module is imported by:
- [`consumer-module`](../consumer-module/README.md) at `consumer.ts:12`
- [`api-routes`](../api-routes/README.md) at `routes.ts:5`

---

## Changelog

Notable changes:
- **v2.0**: Added `newFunction()`, deprecated `oldFunction()`
- **v1.5**: Performance improvements to `algorithm()`
```

## Documentation Strategy

### Step-by-Step Process

1. **Read entry point file COMPLETELY**
   - Get every line using Read tool
   - Parse all imports
   - List all exports

2. **Read ALL related source files**
   - Follow imports to internal files
   - Read type definition files
   - Read configuration files

3. **Document EVERY function**
   - Public functions: full documentation
   - Private functions: tag as [Internal], still document fully
   - Arrow functions and lambdas: document inline

4. **Include FULL source code**
   - Copy actual implementation
   - Preserve original comments
   - Add explanatory comments for complex sections

5. **Trace dependencies**
   - Find all callers (grep for function name)
   - Find all callees (functions this calls)
   - Document in "See Also" and "Used By"

6. **Calculate depth metrics**
   - Count functions documented
   - Ensure 800+ lines output
   - Verify every export is covered

## Important Guidelines

- **NEVER summarize** - Include everything
- **ALWAYS include source code** - Full implementations, not snippets
- **ALWAYS document internals** - Private functions tagged as [Internal]
- **ALWAYS explain WHY** - Not just what, but why it's designed this way
- **ALWAYS trace usage** - Where is each function called from
- **Target 800+ lines** - More is better
```

### Success Criteria:

#### Automated Verification:
- [ ] Module-documenter agent file updated
- [ ] Agent contains "800+" requirement
- [ ] Agent contains "[Internal]" tagging instructions
- [ ] Agent contains source code embedding instructions

#### Manual Verification:
- [ ] Test on a single module to verify output is 800+ lines
- [ ] Verify internal functions are documented
- [ ] Verify full source code is embedded

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the documentation detail level is satisfactory before proceeding.

---

## Phase 2: Update Main Command with Depth Enforcement

### Overview
Add depth metrics and validation to the main generate_repo_docs command to ensure agents produce the required detail.

### Changes Required:

#### 1. Update Main Command
**File**: `.claude/commands/generate_repo_docs.md`

**Key Changes:**
1. Add depth requirements in Wave 3 prompts
2. Add validation step to check documentation depth
3. Add explicit instruction to pass full source code to module-documenter
4. Update mode descriptions with line count targets

**Changes to Wave 3:**

Replace the current Wave 3 agent prompt template with:

```markdown
## WAVE 3: Module Documentation (3+ agents, batched)

**Purpose**: Document each module EXHAUSTIVELY with full source code.

### Depth Requirements by Mode

| Mode | Target Lines/Module | Source Code | Internals |
|------|---------------------|-------------|-----------|
| `quick` | 200+ lines | Signatures only | No |
| `standard` | 400+ lines | Key implementations | Key internals |
| `deep` | 800+ lines | Full source code | All internals |

### For Each Batch of Modules

```
Task with subagent_type="module-documenter":

## CRITICAL: You MUST produce EXHAUSTIVE documentation

### Depth Requirements
- **Minimum output: 800+ lines per module** (for deep mode)
- **Document EVERY function** - public AND private/internal
- **Include FULL source code** - embed actual implementations
- **Explain algorithms** - step-by-step for complex logic

### Modules to Document
[List of module paths for this batch]

### For EACH module:

1. **Read the ENTIRE source file(s)**
   - Use Read tool to get COMPLETE file contents
   - Do NOT skip any lines
   - Parse every function, class, type, constant

2. **Document EVERY function**
   - Public functions: full documentation
   - Private functions: tag as [Internal], document fully
   - Include FULL implementation code

3. **Include source code blocks**
   - Copy actual function implementations
   - Preserve original comments
   - Add explanatory comments

4. **Trace dependencies**
   - Where each function is called from
   - What each function calls

### Validation Checklist (verify before returning)
- [ ] Every export from the module is documented
- [ ] Every private function is documented with [Internal] tag
- [ ] Full source code is included for all functions
- [ ] Output is 800+ lines (for deep mode)
- [ ] All parameters have type and description
- [ ] All return values documented
- [ ] All errors/exceptions documented

Return ONLY when checklist is complete.
```
```

**Changes to Wave 6 Quality Check:**

Add depth validation:

```markdown
### Agent: Quality Check

```
Task with subagent_type="codebase-analyzer":

## Documentation Depth Validation

### Required Checks

1. **Line Count Validation**
   - quick mode: Each module doc >= 200 lines
   - standard mode: Each module doc >= 400 lines
   - deep mode: Each module doc >= 800 lines

2. **Coverage Validation**
   - Count functions in source vs functions documented
   - Target: 100% for deep mode, 80% for standard, 50% for quick

3. **Source Code Validation**
   - Verify code blocks contain actual implementations
   - Not just signatures

4. **Internal Function Validation**
   - Verify [Internal] tags present for private functions
   - All private functions documented in deep mode

### Return

```json
{
  "depth_validation": {
    "modules_checked": 10,
    "modules_passing": 8,
    "modules_failing": [
      {"name": "module-x", "issue": "Only 350 lines, needs 800+"},
      {"name": "module-y", "issue": "Missing internal function _helper"}
    ]
  },
  "recommendations": [
    "Re-run module-documenter on module-x with more depth"
  ]
}
```
```
```

### Success Criteria:

#### Automated Verification:
- [ ] Main command file updated with depth requirements
- [ ] Wave 3 includes "800+ lines" requirement
- [ ] Wave 6 includes depth validation

#### Manual Verification:
- [ ] Run `/generate_repo_docs . --mode deep` on test repo
- [ ] Verify output docs are 800+ lines
- [ ] Verify internal functions documented

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Enhance api-extractor for Complete Coverage

### Overview
Update api-extractor to extract EVERY function, not just exports, and include full source code.

### Changes Required:

#### 1. Update API Extractor Agent
**File**: `.claude/agents/api-extractor.md`

**Key Changes:**
1. Extract ALL functions, not just exports
2. Include full implementation code
3. Document internal functions with [Internal] tag
4. Add completeness requirements

**Replace core section with:**

```markdown
## Core Responsibilities

1. **Find ALL Code Elements** (not just exports)
   - Exported functions (public)
   - Internal/private functions (tag as [Internal])
   - All classes (public and internal)
   - All types/interfaces
   - All constants
   - HTTP endpoints (if applicable)
   - CLI commands (if applicable)

2. **Extract COMPLETE Signatures**
   - Full type signatures with generics
   - All parameter types and defaults
   - Return types including union types
   - Generic constraints
   - All overloads

3. **Extract FULL Source Code**
   - Complete function implementations
   - Full class bodies
   - Type definitions with all fields
   - Preserve original comments

4. **Document Internal Functions**
   - Tag with [Internal]
   - Document caller/callee relationships
   - Explain purpose and usage

## Extraction Strategy

1. **Find ALL functions** - Not just exports
   ```
   Grep patterns:
   - function\s+\w+
   - const\s+\w+\s*=\s*(async\s+)?\(
   - \w+\s*:\s*\([^)]*\)\s*=>
   - private\s+\w+\(
   - protected\s+\w+\(
   ```

2. **Read FULL source code**
   - Use Read tool to get complete files
   - Do not truncate or summarize

3. **Parse every function**
   - Extract name, parameters, return type
   - Extract full function body
   - Extract JSDoc/comments

4. **Identify internal vs public**
   - Exported = public
   - Not exported = [Internal]
   - Private class members = [Internal]

5. **Cross-reference everything**
   - What calls each function
   - What each function calls
```

### Success Criteria:

#### Automated Verification:
- [ ] api-extractor agent updated
- [ ] Contains instruction to extract ALL functions
- [ ] Contains [Internal] tagging

#### Manual Verification:
- [ ] Test extraction on module with internal functions
- [ ] Verify all functions appear in output

**Implementation Note**: After completing this phase, pause for confirmation.

---

## Phase 4: Update example-generator for Implementation Examples

### Overview
Enhance example-generator to create examples that show full implementations, not just usage.

### Changes Required:

#### 1. Update Example Generator Agent
**File**: `.claude/agents/example-generator.md`

**Key Changes:**
1. Include implementation examples (how the code works)
2. Add step-by-step algorithm walkthroughs
3. Show actual source code with explanations

**Add new section:**

```markdown
## Implementation Examples

In addition to usage examples, generate **implementation examples** that explain HOW the code works:

### Example: How `functionName` Works Internally

This example walks through the implementation of `functionName`:

```[language]
function functionName(input: string): Result {
  // Step 1: Validate input
  // The function first checks if input is valid
  if (!input || input.length === 0) {
    throw new ValidationError('Input required');
  }

  // Step 2: Parse input
  // Uses regex to extract components
  const parsed = input.match(/pattern/);

  // Step 3: Transform
  // Applies business logic transformation
  const transformed = transform(parsed);

  // Step 4: Return result
  return { data: transformed, timestamp: Date.now() };
}
```

**Step-by-Step Breakdown:**

1. **Validation (line 3-5)**: Ensures input is not empty. Throws `ValidationError` if invalid.
2. **Parsing (line 8)**: Uses regex pattern `/pattern/` to extract...
3. **Transformation (line 11)**: Calls `transform()` which...
4. **Return (line 14)**: Wraps result with timestamp for...
```

### Success Criteria:

#### Automated Verification:
- [ ] example-generator agent updated
- [ ] Contains "implementation examples" section

#### Manual Verification:
- [ ] Generated examples include implementation walkthroughs

---

## Phase 5: Test and Validate

### Overview
Test the enhanced command on a real repository and validate output quality.

### Test Steps:

1. **Test on small module**
   ```
   /generate_repo_docs packages/scraper --mode deep --output docs/test-deep
   ```

2. **Validate depth**
   - Check that output files are 800+ lines
   - Count documented functions vs source functions
   - Verify internal functions have [Internal] tag

3. **Validate source code**
   - Verify actual implementations are embedded
   - Not just signatures

4. **Run full command**
   ```
   /generate_repo_docs . --mode deep --output docs/generated-deep
   ```

### Success Criteria:

#### Automated Verification:
- [ ] Test documentation generated
- [ ] Output files have line count >= 800

#### Manual Verification:
- [ ] Documentation quality is significantly improved
- [ ] All functions visible in source are documented
- [ ] Source code is properly embedded
- [ ] [Internal] tags present for private functions

---

## Testing Strategy

### Unit Tests
- Test module-documenter on single file with known function count
- Verify all functions appear in output
- Verify line count meets threshold

### Integration Tests
- Run on `packages/scraper` directory
- Validate output structure and depth
- Check all cross-references work

### Manual Testing Steps
1. Run `/generate_repo_docs packages/scraper --mode deep`
2. Open generated module docs
3. Count functions in source file
4. Count functions in documentation
5. Verify they match
6. Verify internal functions tagged
7. Verify full source code present

## Performance Considerations

- Deep mode will take 2-3x longer than standard
- Token usage increases significantly with full source embedding
- Consider adding progress indicators for deep mode
- May need to increase agent timeouts

## Migration Notes

- Existing generated documentation will need to be regenerated
- No breaking changes to command interface
- `--mode deep` now produces significantly more detailed output

## References

- Current implementation plan: `thoughts/shared/plans/2026-01-11-generate-repo-docs-command.md`
- Module documenter: `.claude/agents/module-documenter.md`
- Generated examples: `docs/generated/litecoin/modules/mweb/README.md`
