---
name: context-optimizer
description: Optimizes context window before compaction to minimize information loss. Use when context is filling up, before running /compact, when noticing repetition or confusion, or when switching between major tasks. Extracts critical decisions, patterns, and state to durable checkpoint files.
allowed-tools: Read, Write, Grep, Glob, Bash, TodoWrite
---

# Context Optimizer

Ensures auto-compaction preserves maximum relevant information by proactively extracting critical context to durable storage.

## When This Skill Activates

- User mentions "context", "compaction", "memory", or "checkpoint"
- User says context is "filling up" or "getting large"
- Before major task transitions
- When Claude notices repetition or degraded performance
- User explicitly asks to optimize or prepare for compaction

## Core Principle

**"Compaction is game over for unstructured context."** The solution is proactive extraction of critical information to files that survive compaction (CLAUDE.md and checkpoint files are reloaded from disk).

## Optimization Process

### Step 1: Assess Current State

Run `/context` to check current usage. Thresholds:
- **< 40%**: No action needed
- **40-60%**: Consider checkpointing if complex task
- **60-80%**: Checkpoint recommended before continuing
- **> 80%**: Checkpoint required, consider `/compact` after

### Step 2: Identify Critical Information

Extract these categories from the current conversation:

1. **Architectural Decisions**
   - Technology choices and rationale
   - Design patterns adopted
   - Trade-offs considered and rejected alternatives

2. **Established Patterns**
   - Naming conventions discovered
   - Code patterns to follow
   - Project-specific idioms

3. **Current State**
   - Files modified and why
   - Tests passing/failing
   - Build status

4. **Open Issues**
   - Unresolved bugs or blockers
   - Questions pending user input
   - Known limitations

5. **Task Progress**
   - What's been completed
   - What's in progress
   - What's remaining

### Step 3: Create Checkpoint File

Write to: `thoughts/checkpoints/YYYY-MM-DD-HH-MM-checkpoint.md`

Use this format:

```markdown
# Context Checkpoint - [timestamp]

## Session Summary
[1-2 sentence summary of what this session accomplished]

## Architectural Decisions
- **[Decision]**: [Rationale]
- **[Decision]**: [Rationale]

## Patterns Established
- **[Pattern name]**: [How to apply it]

## Files Modified
| File | Changes | Status |
|------|---------|--------|
| `path/to/file` | [Summary] | [done/in-progress] |

## Current Task State
- **Completed**: [list]
- **In Progress**: [list]
- **Remaining**: [list]

## Open Issues
- [ ] [Issue 1]
- [ ] [Issue 2]

## Critical Context for Next Session
[Anything Claude MUST know to continue this work effectively]

## Safe to Forget
- Debugging attempts that didn't work
- Exploratory searches
- Verbose tool outputs
```

### Step 4: Update CLAUDE.md (If Appropriate)

If discoveries are project-wide (not session-specific), consider updating CLAUDE.md:
- New patterns that should always be followed
- Important architectural constraints
- Key file locations discovered

### Step 5: Recommend Next Action

Based on context usage:
- **40-60%**: "Checkpoint created. Continue working or `/compact` if switching tasks."
- **60-80%**: "Checkpoint created. Recommend `/compact` with: 'preserve [specific items]'"
- **> 80%**: "Checkpoint created. Run `/compact` now to avoid auto-compaction."

## Compaction Instructions Template

When suggesting `/compact`, provide custom instructions:

```
/compact Preserve: [architectural decisions], [current task state], [open issues].
Summarize: debugging steps, search results, verbose outputs.
Critical files: [list key files being worked on].
```

## Subagent Delegation Pattern

For complex tasks consuming lots of context, recommend:

1. **Use Task tool** to delegate heavy lifting to subagents
2. **Subagents have isolated context** - their exploration doesn't pollute main context
3. **Only summaries return** to main context (1-2k tokens vs full exploration)

Example delegation:
```
Instead of reading 20 files directly, spawn a codebase-analyzer subagent.
It reads all 20 files in its own context and returns a summary.
Main context only grows by ~500 tokens instead of ~20,000.
```

## Anti-Patterns to Avoid

1. **Don't wait for auto-compact** - By then, critical context may be lost unpredictably
2. **Don't stuff everything in CLAUDE.md** - Keep it as a "table of contents", load details on-demand
3. **Don't read large files directly** when a grep/search would suffice
4. **Don't keep verbose error outputs** - Extract the key error message only

## Example Checkpoint

```markdown
# Context Checkpoint - 2025-12-29 18:30

## Session Summary
Implemented Polymarket API integration for market resolution tracking.

## Architectural Decisions
- **Use polling over websockets**: Simpler, sufficient for 5-min update frequency
- **Store raw API response**: Enables reprocessing without re-fetching

## Patterns Established
- **Market ID format**: Use Polymarket's condition_id as primary key
- **Error handling**: Retry 3x with exponential backoff, then log and skip

## Files Modified
| File | Changes | Status |
|------|---------|--------|
| `src/clients/polymarket.ts` | Added getMarketOutcome() | done |
| `src/db/storage.ts` | Added market_resolutions table | done |
| `src/services/aggregator.ts` | Integrated resolution check | in-progress |

## Current Task State
- **Completed**: API client, database schema
- **In Progress**: Aggregator integration
- **Remaining**: Tests, error handling edge cases

## Open Issues
- [ ] Handle markets with >2 outcomes
- [ ] Determine retry strategy for API rate limits

## Critical Context for Next Session
The aggregator needs to call checkMarketResolution() after each collection cycle.
Look at src/services/aggregator.ts:145 for the integration point.

## Safe to Forget
- Explored using websockets (rejected - too complex)
- Debugged TypeScript import issue (resolved)
- Read through 15 test files looking for patterns
```

## Success Metrics

After optimization:
- [ ] Critical decisions are in checkpoint file
- [ ] Current task state is documented
- [ ] Open issues are captured
- [ ] User knows whether to `/compact` and with what instructions
