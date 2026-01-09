---
description: Evaluate whether a specific concern about code behavior is valid
argument-hint: "<your concern in quotes>"
allowed-tools: Read, Grep, Glob, Task, TodoWrite
model: opus
---

# Check Concern

Objectively evaluate whether a specific concern about code behavior is valid. This command traces through the actual code to determine if the issue you're worried about will or won't occur.

## How to Use

```
/check_concern "Will the rate limiter prevent concurrent requests from the same user?"
/check_concern "Does the authentication flow check token expiration before making API calls?"
/check_concern "Can a race condition occur when two users update the same record?"
```

## Your Process

### Step 1: Parse the Concern

Extract from the user's input:
1. **The specific behavior being questioned** (what might happen)
2. **Any mentioned files or components** (where to look)
3. **Implicit assumptions** (what context is assumed)

If the concern is vague, ask for clarification:
- "Could you specify which component you're asking about?"
- "What specific scenario are you concerned about?"

### Step 2: Initial Code Discovery

Before delegating, use codebase-locator to find relevant files:

Spawn a Task with `subagent_type="codebase-locator"`:
```
Find all files related to: [the concern topic]

Focus on:
- Implementation files that handle [relevant behavior]
- Configuration files that might affect [behavior]
- Tests that verify [behavior]
```

### Step 3: Web Research (When Relevant)

**Determine if web research would help.** Spawn web research agents when the concern involves:
- **External libraries/APIs**: Need to check official docs for expected behavior, known bugs, or gotchas
- **Framework behavior**: How does Express/React/etc. actually handle this scenario?
- **Security concerns**: Are there known CVEs or security advisories?
- **Best practices**: What's the documented correct way to handle this?
- **Known issues**: Has anyone else reported this problem?

**If web research is needed**, spawn in parallel with code discovery:

```
Spawn Task with `subagent_type="technical-task-researcher"`:

Research the following for evaluating a code concern:

## The Concern
[User's concern]

## Libraries/APIs Involved
[List relevant packages from package.json or imports]

## What to Research
1. Official documentation for [library] regarding [behavior]
2. Known issues or bugs related to [topic]
3. Common pitfalls or gotchas
4. Expected behavior according to docs

## Focus Areas
- Does the library/API actually work the way the code assumes?
- Are there documented edge cases?
- Any version-specific behaviors to be aware of?
```

**Alternative: Use `technical-researcher`** for simpler lookups (official docs, code snippets).
**Alternative: Use `web-search-researcher`** for broader research (blog posts, community discussions).

### Step 4: Delegate to concern-evaluator

Spawn a Task with `subagent_type="concern-evaluator"` and provide:

```
## The Concern
[Exact user concern, clearly stated]

## Context Files
[List of files found by codebase-locator that are most relevant]

## Additional Context
[Any context you gathered from the user or codebase]

## External Research (if performed)
[Include findings from web research agents:]
- Official documentation says: [relevant info]
- Known issues: [any reported problems]
- Expected behavior: [what docs say should happen]
- Gotchas/pitfalls: [common mistakes]

## What to Evaluate
Determine whether: [restate the specific behavior to evaluate]
```

### Step 5: Present Results

After receiving the evaluation, present to the user:

```markdown
## Concern Evaluation Results

### Your Concern
> [Original concern]

### Verdict: [VERDICT]
**Confidence**: [CONFIDENCE]

### Summary
[2-3 sentence summary from evaluator]

### Key Evidence
[Most important evidence points with file:line references]

### Reasoning
[Logical chain that led to verdict]

### Caveats
[Important edge cases or assumptions]

### External Sources (if web research was performed)
[Links to documentation, GitHub issues, or other sources that informed the verdict]

---
*To dig deeper into any file, ask me to analyze it.*
*To verify this behavior in practice, run `/verify_changes`.*
```

## When to Ask for Clarification

Ask the user to clarify if:
- The concern could apply to multiple different systems
- The concern is too broad (e.g., "Is the code buggy?")
- You can't determine what "success" vs "failure" means
- The concern requires runtime context you don't have

Example:
```
Your concern mentions "the API" - this codebase has several APIs:
1. The public REST API (`api/public/`)
2. The internal service API (`api/internal/`)
3. The WebSocket API (`api/ws/`)

Which one are you asking about?
```

## Example Session (Code-Only)

**User**: `/check_concern "Will users lose their session if the server restarts?"`

**You**:
1. Parse: Concern is about session persistence across server restarts
2. Locate: Find session management files using codebase-locator
3. Web research: Not needed (session storage is code-specific, not library behavior)
4. Delegate: Send to concern-evaluator with:
   - Concern: "Will users lose their session if the server restarts?"
   - Context files: `auth/session.ts`, `config/session.js`, `middleware/auth.ts`
5. Present: Format the evaluator's findings

**Output**:
```markdown
## Concern Evaluation Results

### Your Concern
> Will users lose their session if the server restarts?

### Verdict: WON'T HAPPEN
**Confidence**: HIGH

### Summary
Sessions are stored in Redis (`config/session.js:12`), not in-memory. Server restarts will not affect existing sessions as Redis persists independently.

### Key Evidence
- `config/session.js:12-18`: Session store configured as RedisStore with connection to `REDIS_URL`
- `docker-compose.yml:45`: Redis container is separate from app container
- `auth/session.ts:34`: Session lookup queries Redis, not local memory

### Reasoning
1. Session configuration at `config/session.js:12` uses `connect-redis` package
2. Redis connection is to external service, not embedded
3. On server restart, new process connects to same Redis instance
4. Redis retains session data across app restarts

### Caveats
- **Redis restart**: If Redis itself restarts, sessions WILL be lost (no persistence configured)
- **Cluster mode**: In Kubernetes, ensure all pods use same Redis instance
```

## Example Session (With Web Research)

**User**: `/check_concern "Will axios automatically retry failed requests?"`

**You**:
1. Parse: Concern is about axios retry behavior
2. Locate: Find files using axios
3. Web research: YES - this is about library default behavior
   - Spawn `technical-task-researcher` to research axios retry behavior
4. Delegate: Send to concern-evaluator with code files AND research findings
5. Present: Format the evaluator's findings with documentation sources

**Output**:
```markdown
## Concern Evaluation Results

### Your Concern
> Will axios automatically retry failed requests?

### Verdict: WON'T HAPPEN
**Confidence**: HIGH

### Summary
Axios does NOT retry failed requests by default. The codebase uses axios without the axios-retry plugin or custom retry interceptors, so failed requests will not be retried.

### Key Evidence
- `package.json`: No `axios-retry` package installed
- `services/api.ts:12-25`: Axios instance created without retry interceptors
- `services/api.ts:30-45`: Error interceptor logs errors but does not retry

### Reasoning
1. Axios documentation confirms no built-in retry mechanism
2. No retry plugin installed in dependencies
3. Custom axios instance has no retry logic implemented
4. Error handling catches and logs but does not re-attempt

### Caveats
- **Network timeouts**: Axios may appear to "retry" if the underlying HTTP client retries at TCP level
- **Browser behavior**: Some browsers may retry idempotent requests on connection reset

### External Sources
- [Axios GitHub - No built-in retry](https://github.com/axios/axios/issues/164)
- [axios-retry documentation](https://www.npmjs.com/package/axios-retry)
```

## What NOT to Do

- Don't suggest fixes - only evaluate
- Don't identify unrelated issues
- Don't make assumptions without evidence
- Don't skip the delegation to concern-evaluator
- Don't give a verdict without file:line references
- Don't skip web research when the concern involves external library behavior
