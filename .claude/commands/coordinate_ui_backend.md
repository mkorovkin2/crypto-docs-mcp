---
description: Coordinate changes that span frontend and backend boundaries
argument-hint: "<description of the change needed>"
allowed-tools: Read, Grep, Glob, Task, TodoWrite, Bash
model: opus
---

# Coordinate UI-Backend Changes

Coordinate changes that affect both frontend and backend code. This command ensures changes are made in the correct dependency order and verifies they work together.

## How to Use

```
/coordinate_ui_backend "Add a 'volume24h' field to market data that displays in the CLI"
/coordinate_ui_backend "Update the price format from cents to dollars across the system"
/coordinate_ui_backend "Add support for a new 'confidence' field from the API"
```

## Your Process

### Step 1: Parse the Change Request

Extract from the user's input:
1. **What is changing** - The specific data, field, or behavior
2. **Where it originates** - Backend source (API, database, service)
3. **Where it's consumed** - Frontend destination (component, display, page)
4. **Any constraints** - Performance, backwards compatibility, etc.

If the request is vague, ask for clarification:
- "What's the source of this data - database, external API, or computed?"
- "Where should this be displayed - which component or page?"
- "Should this be backwards compatible with existing data?"

### Step 2: Initial Discovery

Before delegating, do quick discovery to provide context.

Spawn a Task with `subagent_type="codebase-locator"`:
```
Find the frontend and backend structure of this codebase.

Look for:
- Backend: services, API handlers, database layer, storage files
- Frontend: components, pages, display code, UI layer, CLI output
- Shared: types, interfaces, schemas
- Integration points: how frontend gets data from backend

Focus on understanding:
1. Where is data produced? (backend)
2. Where is data consumed/displayed? (frontend)
3. What shared contracts exist? (types)

Return the directory structure and key files for each layer.
```

### Step 3: Delegate to Coordinator

Spawn a Task with `subagent_type="ui-backend-coordinator"` and provide:

```
## Change Request
[Exact user request, clearly stated]

## Architecture Context
[Results from codebase-locator discovery]

### Backend
- Location: [discovered path]
- Key files: [list of relevant backend files]
- Data layer: [how data is stored/retrieved]

### Frontend
- Location: [discovered path]
- Key files: [list of relevant frontend files]
- Data consumption: [how frontend gets data]

### Shared Types
- Location: [discovered path]
- Key files: [type definition files]

## Specific Focus Areas
Based on the change request, focus on:
- Backend files: [specific files likely affected]
- Frontend files: [specific files likely affected]
- Type files: [specific type definitions]

## Constraints
[Any constraints mentioned by user or discovered]

## Expected Outcome
After this change:
- [What should be different in the backend]
- [What should be different in the frontend]
- [How to verify it works]
```

**CRITICAL**: The coordinator agent does NOT have access to this conversation's context. You MUST include:
1. Complete architecture discovery results
2. Specific file paths to focus on
3. Clear description of what the change should accomplish
4. Any constraints or requirements

### Step 4: Present Results

After the coordinator completes, present to the user:

```markdown
## UI-Backend Coordination Results

### Change Request
> [Original request]

### What Was Coordinated

#### Backend Changes
| File | Change | Lines |
|------|--------|-------|
| `path/to/file.ts` | [description] | [X-Y] |

#### Frontend Changes
| File | Change | Lines |
|------|--------|-------|
| `path/to/display.ts` | [description] | [X-Y] |

#### Shared/Type Changes
| File | Change | Lines |
|------|--------|-------|
| `path/to/types.ts` | [description] | [X-Y] |

### Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| Build | PASS/FAIL | [output summary] |
| Types | PASS/FAIL | [any type errors] |
| Integration | PASS/FAIL | [verification output] |

### Manual Testing Needed
- [ ] [Specific thing to test manually]
- [ ] [Another manual verification]

---
*Run `/verify_changes` for additional runtime verification.*
*Run `/check_concern "..."` if you have concerns about the changes.*
```

## When to Ask for Clarification

Ask the user if:
- The change could affect multiple different systems
- You can't determine the source or destination of the data
- There are backwards compatibility concerns
- The change seems to require database migration
- Multiple valid implementation approaches exist

Example:
```
This change could be implemented in two ways:

1. **Computed field**: Calculate `volume24h` on-the-fly from trade history
   - Pros: No schema change, always accurate
   - Cons: Slower queries

2. **Stored field**: Add column to database, update during collection
   - Pros: Fast queries
   - Cons: Requires schema change, may be stale

Which approach do you prefer?
```

## Example Session

**User**: `/coordinate_ui_backend "Add a 'lastUpdated' timestamp to market displays"`

**You**:
1. **Parse**: Need timestamp field from database, display in CLI table
2. **Discover**: Use codebase-locator to find:
   - Backend: `data-getter/src/db/storage.ts`, `data-getter/src/types/index.ts`
   - Frontend: `data-getter/src/cli/display.ts`
3. **Delegate**: Send to ui-backend-coordinator with full context
4. **Present**: Format the coordination results with verification status

**Expected Changes**:
1. `types/index.ts`: Add `lastUpdated: Date` to Market interface
2. `db/storage.ts`: Include `last_updated` in SELECT, map to interface
3. `cli/display.ts`: Add column to table output

## Handling Edge Cases

### No Frontend Exists
If discovery finds no frontend code:
```
I found backend code at `data-getter/src/` but no frontend code exists.

Options:
1. Add CLI display in `data-getter/src/cli/display.ts` (terminal output)
2. Skip frontend - only make backend changes
3. Create new frontend (requires separate planning)

Which would you prefer?
```

### Ambiguous Boundaries
If it's unclear what's "frontend" vs "backend":
```
This codebase has an unusual structure. I found:
- `src/services/` - Could be backend
- `src/cli/` - Could be frontend (terminal)
- `src/index.ts` - Main entry, uses both

Please clarify: When you say "frontend", do you mean:
1. The CLI/terminal output (`src/cli/`)
2. A web UI (doesn't exist yet)
3. Something else?
```

### Database Schema Changes Required
If the change requires schema modification:
```
This change requires a database schema modification:

The `markets` table needs a new column: `volume_24h REAL`

**Warning**: This is a manual step. The schema file is at:
`data-getter/src/db/schema.sql`

Options:
1. I'll update schema.sql, but you'll need to reset the database or run migration
2. Skip schema change - compute value at query time instead
3. Proceed with schema change understanding data will need reload

How would you like to proceed?
```

## What NOT to Do

- Don't make changes without understanding the architecture first
- Don't skip the dependency order (schema → types → backend → frontend)
- Don't assume frontend/backend structure - discover it
- Don't make partial changes (all layers or none)
- Don't skip verification steps
- Don't present results without build verification
- Don't proceed with ambiguous requests - ask for clarification
