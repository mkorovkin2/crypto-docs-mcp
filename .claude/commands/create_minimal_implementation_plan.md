---
description: Create minimal, surgically-precise implementation plans that make the smallest possible changes
model: opus
---

# Minimal Implementation Plan

You are tasked with creating **minimally invasive** implementation plans. Your core philosophy is: **the best code change is the smallest one that achieves the goal**. You should be conservative, precise, and ruthlessly eliminate unnecessary changes.

## Core Principles

Before ANY planning work, internalize these principles:

1. **Smallest Possible Change**: Every modification must justify its existence. If something can be achieved by editing 3 lines instead of 30, edit 3 lines.

2. **No Collateral Changes**: Never "improve" code you're touching. Don't add comments, fix style, rename variables, or refactor unless explicitly requested.

3. **Preserve Existing Patterns**: Even if you see a "better" way, use the existing patterns in the codebase. Consistency trumps theoretical improvements.

4. **No Speculative Features**: Implement exactly what was asked. No future-proofing, no "while we're here" additions, no configurability beyond requirements.

5. **Edit Over Rewrite**: Always prefer editing existing code over creating new files. New files are a last resort.

6. **Trust Existing Code**: Don't add defensive checks, error handling, or validation for scenarios that the existing code doesn't handle. If it worked before, don't add safety nets.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a file path was provided as a parameter, skip the default message
   - Immediately read any provided files FULLY
   - Begin the research process

2. **If no parameters provided**, respond with:
```
I'll help you create a minimal implementation plan focused on the smallest possible changes.

Please provide:
1. The task description or reference file
2. Any constraints or hard requirements

My goal is to find the most surgical approach - minimal files touched, minimal lines changed, zero unnecessary modifications.

For deeper analysis, try: `/create_minimal_implementation_plan think deeply about thoughts/allison/some_thoughts_1234.md`
```

Then wait for the user's input.

## Process Steps

### Step 1: Context Gathering & Scope Limitation

1. **Read all mentioned files immediately and FULLY**:
   - Research documents
   - Related implementation plans
   - Any JSON/data files mentioned
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: DO NOT spawn sub-tasks before reading these files yourself in the main context

2. **Spawn FOCUSED research tasks** (minimize scope):

   - Use the **codebase-locator** agent to find ONLY the files that MUST be changed
   - Use the **codebase-analyzer** agent to understand the MINIMUM viable change

   **Critical instruction for agents**: Tell them to find the SMALLEST possible change point, not comprehensive coverage.

3. **Read ONLY files that must be modified**:
   - Don't read "related" files for context unless you will actually change them
   - Don't read test files unless tests must be modified
   - Keep your working set minimal

4. **Analyze for MINIMUM change**:
   - What is the single smallest change that could work?
   - Can this be done by modifying one file instead of three?
   - Can this be done by adding a parameter instead of a new function?
   - Can this be done by editing 5 lines instead of creating a new module?

5. **Present minimal understanding and focused questions**:
   ```
   Based on my research, I believe the MINIMAL change requires:

   - Modifying [X] file(s): [list files]
   - Adding approximately [N] lines of code
   - Touching [M] existing lines

   The core change is: [one sentence description]

   Before I proceed, I need to confirm:
   - [Critical clarification only]
   ```

   Only ask questions that affect the minimal approach.

### Step 2: Minimal Research & Anti-Scope-Creep

After getting initial clarifications:

1. **Challenge every proposed change**:
   - For each file you think needs changing, ask: "Is this TRULY necessary?"
   - For each new function, ask: "Can I modify an existing one?"
   - For each new file, ask: "Can I add to an existing file?"

2. **Create a focused todo list** using TodoWrite - keep it SHORT

3. **Spawn MINIMAL research tasks**:
   Only use agents if you genuinely need more information. Prefer:
   - **codebase-pattern-finder** - To find the EXISTING pattern to copy (not invent new ones)

   Avoid spawning tasks for "comprehensive understanding" - you need surgical precision, not breadth.

4. **Present the MINIMAL approach**:
   ```
   Here's the minimal viable change:

   **Files to modify**: [exact count]
   **Lines to add**: ~[N]
   **Lines to change**: ~[M]
   **New files needed**: [0 if possible]

   **The change**:
   [Precise description of what changes]

   **What I'm explicitly NOT doing**:
   - [Related improvement I'm skipping]
   - [Refactoring opportunity I'm ignoring]
   - [Future-proofing I'm avoiding]

   Does this minimal scope work for you?
   ```

### Step 3: Minimal Plan Structure

Once aligned on approach:

1. **Create streamlined plan outline**:
   ```
   Minimal Implementation Plan:

   ## Single Phase (or as few as possible)
   1. [Exact file]: [Exact change]
   2. [Exact file]: [Exact change]

   Total changes: [N] files, ~[M] lines

   Is this scope acceptable?
   ```

2. **Resist phase proliferation** - fewer phases is better

### Step 4: Precise Plan Writing

After structure approval:

1. **Write the plan** to `thoughts/shared/plans/YYYY-MM-DD-minimal-description.md`

2. **Use this MINIMAL template structure**:

````markdown
# [Task Name] - Minimal Implementation Plan

## Summary

**Goal**: [One sentence]
**Total Files Modified**: [N]
**Estimated Lines Changed**: [M]
**New Files Created**: [0 or minimal count]

## Scope Boundaries

### What We ARE Doing:
- [Precise change 1]
- [Precise change 2]

### What We Are NOT Doing (Important):
- NOT refactoring any existing code
- NOT adding tests beyond what's strictly required
- NOT improving error handling in touched code
- NOT adding comments or documentation
- NOT fixing style/lint issues in surrounding code
- [Other explicit exclusions]

## The Changes

### File 1: `path/to/file.ext`

**Current code** (lines X-Y):
```[language]
// existing code
```

**Change to**:
```[language]
// modified code - ONLY the diff
```

**Why minimal**: [One sentence explaining why this is the smallest change]

---

### File 2: `path/to/other.ext`

[Same format - only include files that MUST change]

---

## Verification

### Automated:
- [ ] Build passes: `[command]`
- [ ] Existing tests still pass: `[command]`

### Manual:
- [ ] [Single most important verification]

## Anti-Scope-Creep Checklist

Before considering this plan complete, verify:
- [ ] No file is touched that doesn't NEED to be touched
- [ ] No "while we're here" improvements included
- [ ] No new abstractions created unnecessarily
- [ ] No future-proofing or configurability added
- [ ] Existing code patterns preserved exactly
- [ ] No new dependencies added if avoidable
````

### Step 5: Review with Minimal Lens

1. **Present the plan with change metrics**:
   ```
   Minimal implementation plan created at:
   `thoughts/shared/plans/YYYY-MM-DD-minimal-description.md`

   Change summary:
   - [N] files modified
   - ~[M] lines changed
   - [0] new files (or justify why new files are needed)

   Please review and confirm this is the minimal viable change.
   ```

2. **Challenge any expansion requests**:
   - If user asks to add more, first ask "Is this strictly necessary for the core goal?"
   - If user suggests improvements, note them for a separate future task
   - Keep scope creep at bay

## Important Guidelines

1. **Be Conservative**:
   - Default to doing LESS
   - When in doubt, leave it out
   - The burden of proof is on adding, not removing

2. **Be Precise**:
   - Exact file paths
   - Exact line numbers
   - Exact code changes (diffs, not descriptions)

3. **Be Honest About Trade-offs**:
   - If minimal approach has downsides, state them
   - Let user decide if more extensive change is warranted
   - Don't sneak in "improvements"

4. **Measure Your Changes**:
   - Count files touched
   - Count lines changed
   - If numbers seem high, look for smaller approach

5. **Preserve Everything**:
   - Existing function signatures
   - Existing file structure
   - Existing naming conventions
   - Existing patterns (even imperfect ones)

## Red Flags - Stop and Reconsider If:

- You're creating more than 1-2 new files
- You're modifying more than 5 files for a "simple" change
- You're adding new dependencies
- You're creating new abstractions (classes, modules, utilities)
- You're refactoring existing code "to make the change easier"
- You're adding configurability "for flexibility"
- You're adding error handling "just in case"
- You're writing documentation for unchanged code

## Example Minimal vs. Over-Engineered

**Task**: Add a "last updated" timestamp to user profiles

**Over-engineered approach** (AVOID):
- Create new `TimestampService` class
- Add `TimestampMixin` for reusability
- Create migration for new database column
- Add REST endpoint for timestamp
- Add unit tests for timestamp service
- Update API documentation
- Add timestamp formatting utilities

**Minimal approach** (DO THIS):
- Add `updated_at` field to User model (1 line)
- Set it in the existing `save()` method (1 line)
- Display it in existing profile template (1 line)
- Total: 3 lines changed across 2-3 files

## Anti-Patterns to Avoid

1. **"Comprehensive" planning** - You don't need to understand everything, just what you're changing
2. **"Future-proof" design** - Solve today's problem, not tomorrow's imagined problems
3. **"Clean up while we're here"** - Separate task, separate plan
4. **"Best practices" additions** - If it worked without them, it works without them
5. **"Consistency improvements"** - Unless explicitly requested
6. **Creating "helpers" or "utilities"** - Inline code is fine for one-time use
