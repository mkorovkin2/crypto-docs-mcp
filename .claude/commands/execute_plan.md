---
description: Execute a pre-written implementation plan using coordinated subagents
argument-hint: "<path to implementation plan file>"
allowed-tools: Read, Write, Edit, Grep, Glob, Task, TodoWrite, Bash, WebSearch, WebFetch
model: opus
---

# Execute Implementation Plan

Orchestrate the execution of a pre-written implementation plan using isolated subagents. Each phase is executed by a dedicated agent, with verification and checkpointing between phases.

## How to Use

```
/execute_plan thoughts/shared/plans/2025-01-15-add-user-auth.md
/execute_plan thoughts/shared/plans/2025-01-20-refactor-api.md --continue-from=3
```

## Your Process

### Step 1: Parse and Validate the Plan

1. **Read the plan file completely**:
   ```
   Read the implementation plan file provided as argument.
   Extract:
   - Plan title and overview
   - Number of phases
   - Phase names and descriptions
   - Success criteria for each phase
   - Files affected by each phase
   ```

2. **Validate the plan structure**:
   - Must have clear phase boundaries (look for "## Phase N:" headers)
   - Each phase should have success criteria
   - Files to modify should be identifiable

3. **Check for existing execution state**:
   ```
   Look for checkpoint files at:
   thoughts/checkpoints/exec-[plan-slug]-phase-*.md

   If found, present to user:
   "Found existing execution state. Last completed: Phase N.
   Options:
   1. Continue from Phase N+1
   2. Re-execute Phase N
   3. Start fresh from Phase 1"
   ```

4. **Present execution plan to user**:
   ```markdown
   ## Implementation Plan Loaded

   **Plan**: [title]
   **Phases**: [count]

   | Phase | Name | Files Affected |
   |-------|------|----------------|
   | 1 | [name] | [files] |
   | 2 | [name] | [files] |
   ...

   Ready to execute? (yes/no/phase N only)
   ```

### Step 2: Create Execution Tracking

Use TodoWrite to create execution plan:

```
1. Parse implementation plan - [completed]
2. Phase 1: [Phase name] - [pending]
3. Verify Phase 1 - [pending]
4. Phase 2: [Phase name] - [pending]
5. Verify Phase 2 - [pending]
... (for each phase)
N. Final verification - [pending]
N+1. Generate execution report - [pending]
```

### Step 3: Execute Phases Sequentially

For each phase:

#### 3a. Prepare Phase Context

Extract from the plan:
- The full phase section (Overview, Changes Required, Success Criteria)
- Files that will be modified in this phase
- Any dependencies on previous phases

Gather from checkpoints/memory:
- Summary of what previous phases accomplished
- Files that were modified and where

#### 3b. Spawn Plan Executor Agent

```
Task with subagent_type="plan-executor":

## Your Assignment

Execute Phase [N] of the implementation plan.

### Plan Location
`[full path to plan file]`

### Phase [N]: [Phase Title]

[Paste the COMPLETE Phase N section from the plan, including:]
- Overview
- Changes Required (with all sub-sections)
- Success Criteria (both automated and manual)

### Previous Phases Completed

[If Phase 1:]
This is the first phase. No previous work to build on.

[If Phase 2+:]
**Phase 1: [Title]**
Summary: [2-3 sentences of what was done]
Files modified:
- `path/to/file1.ts:10-25` - [what changed]
- `path/to/file2.ts` (created) - [what it contains]

**Phase 2: [Title]**
...

### Files In Scope

You may modify:
- `[file1]` (create/modify)
- `[file2]` (modify lines X-Y)

Do NOT modify files outside this list without flagging it first.

### Constraints
- Follow existing code patterns in the codebase
- Run build verification after changes
- Report any blockers immediately with FLAG markers
```

#### 3c. Process Agent Response

When the executor agent returns, check the status:

**If status is COMPLETE:**
- Extract the changes made summary
- Proceed to verification

**If status is PARTIAL:**
- Note what was completed vs what remains
- Check for flags
- Decide whether to continue or pause

**If status is BLOCKED:**
- Extract all FLAG entries
- Handle each flag (see Step 4)
- Re-spawn agent with resolution OR ask user

#### 3d. Verify Phase Completion

Run automated verification from the plan's success criteria:

```bash
# Standard verifications (adjust based on project type)
npm run build 2>&1 | tail -30
npm run lint 2>&1 | tail -20

# If the plan specifies specific verification commands, run them:
[commands from plan's "Automated Verification" section]
```

Report results:
```markdown
### Phase [N] Verification

| Check | Result | Notes |
|-------|--------|-------|
| Build | PASS/FAIL | [output summary] |
| Lint | PASS/FAIL | [output summary] |
| [Plan-specific] | PASS/FAIL | [output summary] |
```

**If verification fails:**
```
Phase [N] verification failed:
[Error details]

Options:
1. Have executor retry with error context
2. Fix manually and continue
3. Stop execution
```

#### 3e. Write Checkpoint

After successful verification, create checkpoint file:

**File**: `thoughts/checkpoints/exec-[plan-slug]-phase-[N].md`

```markdown
---
plan: [full plan file path]
plan_title: [plan title]
phase: [N]
phase_title: [phase title]
status: complete
timestamp: [YYYY-MM-DDTHH:MM:SS]
---

# Phase [N] Checkpoint: [Phase Title]

## Summary
[2-3 sentence summary from executor's report]

## Changes Made

| File | Lines | Type | Description |
|------|-------|------|-------------|
| [from executor report] |

## Verification Results
- Build: PASS
- Lint: PASS
- [Other checks from plan]: [result]

## Context for Next Phase
[Key information the next phase executor needs to know]
- [Important detail 1]
- [Important detail 2]
```

#### 3f. Manual Verification Gate

If the plan's phase has "Manual Verification" items:

```markdown
## Phase [N] Complete - Manual Verification Required

Automated checks passed. Please verify manually:

- [ ] [Manual check 1 from plan]
- [ ] [Manual check 2 from plan]

Respond with:
- **continue** - All manual checks pass, proceed to Phase [N+1]
- **redo [feedback]** - Re-execute Phase [N] with your feedback
- **stop** - Pause execution here
```

**WAIT for user response before proceeding to next phase.**

### Step 4: Handle Flags and Research

When an executor agent returns with flags:

#### FLAG: SPEC_UNCLEAR

```markdown
## Clarification Needed

The executor needs more detail:

**Issue**: [from flag]
**What's needed**: [from flag]

Options:
1. Provide clarification: [your clarification here]
2. Update the plan with more detail, then retry
3. Skip this part and continue with rest of phase
```

If user provides clarification, re-spawn executor with:
```
[Previous prompt]

### Additional Clarification
[User's clarification]
```

#### FLAG: RESEARCH_NEEDED

Spawn appropriate research agent:

```
Task with subagent_type="technical-researcher":

Research: [topic from flag]

Context: Implementing [plan overview]. Need to understand [specific question].

Find:
- Best practices and recommendations
- Code examples
- Common pitfalls to avoid

Return actionable findings in 500 words or less.
```

Or for web documentation:
```
Task with subagent_type="web-search-researcher":

Find official documentation for [library/API/framework].
Focus on: [specific feature or question]

Return key findings with source URLs.
```

Pass research results to executor on retry:
```
[Previous prompt]

### Research Results
[Findings from research agent]
```

#### FLAG: ASSUMPTION_WRONG

```markdown
## Plan Assumption Incorrect

The plan assumed: [assumption]
But the code actually: [reality]

Options:
1. Adjust approach for this phase: [describe adjustment]
2. This affects earlier phases - need to revisit
3. Update the plan document and restart execution
```

#### FLAG: SCOPE_CREEP

```markdown
## Out-of-Scope Changes Needed

To complete Phase [N], the executor needs to modify:
- `[file outside scope]` - [why]

Options:
1. Approve - Add to scope and continue
2. Defer - Skip this change, handle separately
3. Rethink - Adjust the approach to stay in scope
```

### Step 5: Final Verification

After all phases complete:

1. **Run comprehensive verification**:
   ```bash
   # Full build
   npm run build

   # Full test suite (if available)
   npm test 2>&1 | tail -50

   # Any final verification from plan
   [commands from plan's "Testing Strategy" section]
   ```

2. **Check all success criteria** from the plan's final section

3. **Report any remaining manual testing** needed

### Step 6: Generate Execution Report

```markdown
## Plan Execution Complete

### Plan
**File**: `[plan file path]`
**Title**: [plan title]

### Execution Summary

| Phase | Name | Status | Files Changed |
|-------|------|--------|---------------|
| 1 | [name] | COMPLETE | [count] |
| 2 | [name] | COMPLETE | [count] |
...

### Total Changes

| File | Lines Modified | Phases |
|------|----------------|--------|
| [file] | [count] | [1, 3] |
...

### Verification Results

| Check | Result |
|-------|--------|
| Build | PASS |
| Lint | PASS |
| Tests | [result] |

### Checkpoints Created
- `thoughts/checkpoints/exec-[plan]-phase-1.md`
- `thoughts/checkpoints/exec-[plan]-phase-2.md`
...

### Issues Resolved During Execution
[List any flags that were raised and how they were resolved]

### Manual Testing Still Needed
[From plan's manual verification sections that weren't done yet]

---
*Execution completed at [timestamp]*
```

## Handling Edge Cases

### Plan File Not Found
```
Could not find implementation plan at: [path]

Please provide the correct path, or create a plan first using:
/create_implementation_plan
```

### Invalid Plan Structure
```
The plan at [path] doesn't have the expected structure.

Missing:
- [ ] Clear phase boundaries (## Phase N: headers)
- [ ] Success criteria sections
- [ ] File change specifications

Would you like me to:
1. Attempt to execute anyway (best effort)
2. Help restructure the plan
3. Cancel
```

### Build/Verification Fails
```
## Phase [N] Verification Failed

**Failed check**: [which check]
**Error output**:
```
[error details]
```

Options:
1. **Retry** - Have executor attempt to fix
2. **Manual fix** - You fix it, then I'll continue
3. **Skip** - Mark phase as partial, continue to next
4. **Stop** - Pause execution for investigation
```

### Executor Timeout or Crash
```
Phase [N] executor did not complete successfully.

Progress is saved in checkpoint for Phase [N-1].

Options:
1. Retry Phase [N]
2. Resume with manual intervention
3. Stop and investigate
```

### User Requests Phase Skip
```
Skipping Phase [N] as requested.

⚠️ Warning: Later phases may depend on Phase [N].

I'll inform subsequent executors that Phase [N] was skipped.
They may flag DEPENDENCY_MISSING if they need something from it.

Proceed? (yes/no)
```

## Execution Modes

### Default Mode (Interactive)
- Presents plan summary before starting
- Pauses for manual verification when plan requires it
- Asks before retrying on failures
- Confirms before proceeding past warnings

### Continuous Mode
If user says "run all" or "don't pause":
- Only pause on BLOCKED status or verification failures
- Log manual verification items for later review
- Continue through phases automatically

### Resume Mode
If `--continue-from=N` is specified or user chooses to resume:
- Read checkpoints for phases 1 through N-1
- Build context summary from checkpoint files
- Start execution at phase N

## What NOT to Do

- **Don't execute without reading the full plan first**
- **Don't skip verification between phases** - Catch issues early
- **Don't proceed past BLOCKED status** without resolution
- **Don't modify the plan file during execution** - It's the source of truth
- **Don't delete checkpoint files** mid-execution
- **Don't run phases in parallel** - Sequential only, dependencies matter
- **Don't hide failures** - Report everything to the user
