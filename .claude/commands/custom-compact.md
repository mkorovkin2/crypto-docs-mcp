# Context Checkpoint

Create a checkpoint before compaction to preserve critical context.

## Instructions

1. **Check context usage** - Run `/context` to see current usage percentage

2. **Extract and document these categories**:

   ### Architectural Decisions
   - Technology choices and rationale
   - Design patterns adopted
   - Trade-offs considered

   ### Established Patterns
   - Naming conventions
   - Code patterns to follow
   - Project-specific idioms

   ### Current State
   - Files modified and why
   - What's completed vs in-progress
   - Open issues or blockers

3. **Write checkpoint file** to `thoughts/checkpoints/YYYY-MM-DD-HH-MM-checkpoint.md` using this format:

```markdown
# Context Checkpoint - [timestamp]

## Session Summary
[1-2 sentence summary]

## Architectural Decisions
- **[Decision]**: [Rationale]

## Files Modified
| File | Changes | Status |
|------|---------|--------|
| `path` | [Summary] | done/in-progress |

## Task State
- **Completed**: [list]
- **In Progress**: [list]
- **Remaining**: [list]

## Open Issues
- [ ] [Issue]

## Critical Context for Next Session
[What Claude MUST know to continue]
```

4. **Recommend next action** based on context usage:
   - **< 60%**: "Checkpoint saved. Safe to continue."
   - **60-80%**: "Checkpoint saved. Consider `/compact preserve [key items]`"
   - **> 80%**: "Checkpoint saved. Run `/compact` now."
