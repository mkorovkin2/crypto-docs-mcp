---
description: Verify code changes work in practice by creating and running standalone test scripts
argument-hint: "[optional: specific function or file to verify]"
allowed-tools: Read, Bash, Glob, Grep, Task
model: opus
---

# Verify Your Changes

You MUST check whether your recent code changes actually work by delegating to the `change-verifier` agent, which will create and execute standalone verification scripts.

## Core Philosophy

**"Talk is cheap. Show me if the code works."**

- Every change must be tested through actual execution
- The goal is to FIND problems, not confirm success
- A failing test is valuable - it caught a bug before the user did
- No unit tests - standalone scripts only
- Real data, real execution, real evidence

## Your Process

### Step 1: Identify What Changed

First, determine what needs verification:

```bash
git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --staged 2>/dev/null || git diff --name-only 2>/dev/null
```

If an argument was provided (specific function or file), focus on that instead.

### Step 2: Read the Changed Files

For each changed file, read it completely to understand:
- What functions were added or modified
- What the expected inputs/outputs are
- What dependencies the code has

Use the Read tool to get the full content of each changed file.

### Step 3: Delegate to change-verifier Agent

Spawn a Task with `subagent_type="change-verifier"` and provide ALL of this context:

```
Verify the following code changes:

## Changed Files
[List each file path]

## Functions to Verify
[List specific functions that were added/modified]

## Code Content
[Paste the relevant code sections that need verification]

## Expected Behavior
[Describe what the code should do]

## Dependencies
[List any imports or dependencies the verification script will need]
```

**CRITICAL**: The change-verifier agent does NOT have access to this conversation's context. You MUST include:
1. Full file paths
2. The actual code content (copy/paste relevant sections)
3. What the code is supposed to do
4. Any setup requirements (database connections, env vars, etc.)

### Step 4: Report Results

After the change-verifier agent completes, report to the user:

```
## Verification Results

### What Was Checked
- [File]: [Function name]

### Execution Output
[Paste the output from the verification script]

### Result
PASS: All checks passed. Code appears to work for tested cases.
OR
FAIL: [Describe what failed, expected vs actual]

### Limitations
[What was NOT tested - edge cases, scenarios, etc.]
```

**Important**: Always include the Limitations section. Be honest about what wasn't covered.

## Example Delegation

If you modified `data-getter/src/services/aggregator.ts` and added a `calculateWeightedPrice` function:

```
Verify the following code changes:

## Changed Files
- data-getter/src/services/aggregator.ts

## Functions to Verify
- calculateWeightedPrice (new function at line 45-60)

## Code Content
```typescript
// From data-getter/src/services/aggregator.ts:45-60
export function calculateWeightedPrice(prices: Array<{price: number, volume: number}>): number {
  const totalVolume = prices.reduce((sum, p) => sum + p.volume, 0);
  if (totalVolume === 0) return 0;
  const weightedSum = prices.reduce((sum, p) => sum + (p.price * p.volume), 0);
  return weightedSum / totalVolume;
}
```

## Expected Behavior
- Takes an array of price/volume objects
- Returns volume-weighted average price
- Returns 0 if total volume is 0

## Dependencies
- No external dependencies, pure function
```

## What NOT to Do

- Don't write verification scripts yourself - delegate to the agent
- Don't skip the delegation step
- Don't provide incomplete context to the agent
- Don't use Jest/Mocha/Vitest
- Don't use mocks
- Don't just say "verified" without execution output
- Don't design tests that are guaranteed to pass
- Don't omit the Limitations section
- Don't hide or downplay failures

## Handling Multiple Changes

If multiple files/functions changed:
1. Group related changes together
2. Spawn ONE change-verifier agent with all the context
3. The agent will create a single script testing everything

## Handling Failures

If the change-verifier reports a failure:
1. Show the user exactly what failed
2. Show the error output
3. The verification script is preserved for debugging
4. After fixing the code, run `/verify_changes` again
