---
description: Create a compact-ready checkpoint (durable state) and then compact the conversation with strict retention rules.
argument-hint: "[optional: what to emphasize (e.g., 'auth bugfix', 'release prep', 'db migration')]"
allowed-tools: Bash
---

# Compact efficiently

You are preparing the chat to be compacted without losing critical project state.

Priority order:
1) Facts from repo + key files
2) Explicit decisions + constraints
3) Current task + next steps
4) Everything else

## Step 1 — Gather repo state (do not narrate)
Branch:
!`git rev-parse --abbrev-ref HEAD 2>/dev/null || true`

Status:
!`git status --porcelain=v1 2>/dev/null || true`

Recent commits (limit 8):
!`git --no-pager log -8 --oneline 2>/dev/null || true`

Staged diff (if any; limit ~200 lines):
!`git --no-pager diff --staged | sed -n '1,200p' 2>/dev/null || true`

Unstaged diff (if any; limit ~200 lines):
!`git --no-pager diff | sed -n '1,200p' 2>/dev/null || true`

## Step 2 — Read durable context (prefer these over chat history)
- @CLAUDE.md

If present and relevant, also skim (do not quote at length; extract only essentials):
- @README.md
- @docs/decisions.md
- @docs/architecture.md

## Step 3 — Produce a Compact Checkpoint (pasteable state)
Write a checkpoint in exactly this format (tight, bullet-heavy, no fluff). Include file paths.

### COMPACT CHECKPOINT
- Goal (now):
- Scope (in / out):
- Constraints (hard):
- Decisions made (with rationale):
- Current status:
- Files touched / relevant paths:
- Commands to run (install/test/lint/build):
- Risks / unknowns:
- Next steps (ordered):

## Step 4 — Perform compaction
Immediately run:
`/compact Use the COMPACT CHECKPOINT as ground truth. Preserve Goal/Scope/Constraints/Decisions/Status/Paths/Commands/Next steps/Risks. Drop resolved logs, dead ends, repetition, and long traces. If conflict exists, prefer CLAUDE.md and the checkpoint.`

