---
description: Deep, skeptical audit of code paths and logic to determine if code will ACTUALLY work
argument-hint: "<what to audit and what question to answer>"
allowed-tools: Read, Grep, Glob, Task, TodoWrite
model: opus
---

# Audit Logic

Perform a deep, skeptical audit of code paths to determine if code will actually work. This command actively distrusts comments, documentation, and inferred information - it traces actual execution to gather empirical evidence.

## How to Use

```
/audit_logic "Does the retry logic in api-client.ts actually retry on network failures?"
/audit_logic "Will the authentication flow correctly reject expired tokens?"
/audit_logic "Audit the entire payment processing flow for failure modes"
/audit_logic "Does the caching layer actually invalidate on updates?"
```

## Your Process

### Step 1: Parse the Audit Request

Extract:
1. **The target**: What code/feature/path to audit (specific function OR broad flow)
2. **The question**: What behavior needs to be verified
3. **Scope**: Narrow (single path) or Broad (feature-wide)

If the request is vague, ask for clarification:
- "Which specific function handles retry logic?"
- "What does 'working correctly' mean for this feature?"

### Step 2: Locate Relevant Code

Spawn a `codebase-locator` task to find all relevant files:

```
Task with subagent_type="codebase-locator":

Find all files related to: [audit target]

Focus on:
- Implementation files (not just types/interfaces)
- Error handling and edge case code
- Configuration that affects behavior
- Tests that might reveal expected behavior
```

### Step 3: Research External Dependencies (ALWAYS)

Identify external libraries/APIs involved and spawn research:

```
Task with subagent_type="technical-task-researcher":

Research the behavior of [library/API] regarding:

## Context
[What the code appears to be doing with this library]

## Questions to Answer
1. What is the documented behavior for [specific method/feature]?
2. Are there known gotchas, edge cases, or version-specific behaviors?
3. What errors/exceptions does it throw and under what conditions?
4. Does it have any implicit behavior (retries, caching, etc.)?

## Why This Matters
The code assumes [behavior]. Need to verify this matches reality.
```

Run this in parallel with code location if possible.

### Step 4: Gather Code Context

Read the key files identified. For each file:
- Note imports and dependencies
- Identify the specific functions related to the audit
- Look for comments that make claims (these will be verified, not trusted)

### Step 5: Delegate to Logic Auditor

Spawn the main audit task:

```
Task with subagent_type="logic-auditor":

## Audit Target
[Specific files/functions to audit]

## Audit Question
[The exact question to answer]

## Context Files
[List of files to focus on with brief descriptions]

## External Research Findings
[Include all findings from technical-task-researcher]:
- Library X: [behavior details]
- API Y: [behavior details]
- Known issues: [any gotchas discovered]

## Scope
[NARROW: single function/path OR BROAD: feature-wide audit]

## Special Instructions
- Create verification script if the verdict would benefit from empirical proof
- [Any specific aspects to focus on]
```

### Step 6: Review and Enhance Findings

When the logic-auditor returns:

1. **Verify the evidence chain** - Do the file:line references support the claims?
2. **Check for gaps** - Were any obvious paths not audited?
3. **Consider verification** - If no verification script was created but would help, request one

### Step 7: Execute Verification (If Created)

If the auditor created a verification script:

```
Task with subagent_type="change-verifier":

Execute the verification script created by the logic auditor:
- Script location: [path]
- What it tests: [description]
- Expected behavior: [what should happen]

Report the actual execution output.
```

### Step 8: Present Results

Format the final report for the user:

```markdown
## Logic Audit Results

### What Was Audited
> [Original request]

### Verdict: [VERDICT]
**Confidence**: [CONFIDENCE]

### Summary
[2-3 sentence summary of findings]

### Key Evidence
[Most important evidence points with file:line]

### Path Trace
[Simplified execution flow]

### External Dependencies
[Library behaviors that affect the verdict]

### Failure Modes Found
[If any - table of issues]

### Verification Results
[If verification script was executed]

### What Was NOT Audited
[Transparency about scope limits]

---
*Audit methodology: Traced actual execution paths, distrusted comments/docs, verified external library behaviors.*
*To verify a specific finding, ask me to create a targeted test.*
```

## When to Ask for Clarification

Ask the user if:
- The audit target could refer to multiple different code paths
- "Working correctly" is ambiguous for this context
- The scope is unclear (audit one function vs entire feature)
- You need to know specific edge cases they care about

## Example Session

**User**: `/audit_logic "Does our rate limiter actually limit rates?"`

**You**:
1. **Parse**: Audit the rate limiting implementation, verify it limits requests
2. **Locate**: Find rate limiter files with codebase-locator
3. **Research**: Research the rate limiting library being used (if any)
4. **Context**: Read the rate limiter implementation
5. **Delegate**: Send to logic-auditor with research findings
6. **Verify**: Execute verification script that makes rapid requests
7. **Present**: Format findings showing whether rate limiting works

**Output**:
```markdown
## Logic Audit Results

### What Was Audited
> Does our rate limiter actually limit rates?

### Verdict: PARTIALLY WORKS
**Confidence**: HIGH

### Summary
The rate limiter correctly limits individual IP addresses but fails to limit authenticated users who switch IPs. The per-user limit is configured but never applied because the middleware checks IP before checking user identity.

### Key Evidence
- `middleware/rate-limit.ts:34`: IP check happens at line 34
- `middleware/rate-limit.ts:45`: User check is AFTER the IP check returns
- `middleware/rate-limit.ts:52`: Comment says "check user limit" but code is unreachable

### Verification Results
**Script**: `temp-verify/audit-rate-limiter.ts`
**Result**: CONFIRMED
- 100 requests from same IP: Blocked after 10 (correct)
- 100 requests from same user, different IPs: All succeeded (bug)

### What Was NOT Audited
- Distributed rate limiting across multiple server instances
- Rate limit header correctness
```

## What NOT to Do

- Don't accept comments as evidence
- Don't skip external library research
- Don't give verdicts without file:line evidence
- Don't assume "obvious" code works
- Don't skip verification when it would strengthen the finding
- Don't audit and then suggest fixes (unless asked)
