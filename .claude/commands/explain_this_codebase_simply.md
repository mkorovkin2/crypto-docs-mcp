---
description: Quick codebase orientation - how to run, test, modify, and improve
model: sonnet
---

# Explain This Codebase Simply

You are tasked with providing a practical orientation to a codebase, focusing on how to run it, test it, modify it, and improve it.

## When invoked, immediately begin analysis:

Do NOT wait for user input. Start analyzing the current working directory codebase right away.

## Steps to follow:

1. **Quick codebase survey (parallel):**

   Spawn these 3 focused sub-agents in parallel using the Task tool:

   **Agent 1 - Project Structure & Setup** (subagent_type: codebase-analyzer):
   ```
   Analyze this codebase for project setup and structure:
   1. What type of project is this? (language, framework, architecture)
   2. What are the key entry points?
   3. What package manager and dependencies are used?
   4. What config files exist (package.json, Cargo.toml, pyproject.toml, etc.)?
   5. What environment setup is needed (.env files, secrets, databases)?

   Return: Project type, key files, setup requirements
   ```

   **Agent 2 - Running & Testing** (subagent_type: codebase-analyzer):
   ```
   Analyze this codebase for how to run and test it:
   1. What scripts/commands run the project? (npm start, cargo run, python main.py, etc.)
   2. What test framework is used? How do you run tests?
   3. What build commands exist?
   4. Are there any CI/CD configs that reveal the expected workflow?
   5. What common development commands are available?

   Return: Run commands, test commands, build commands, dev workflow
   ```

   **Agent 3 - Code Patterns & Conventions** (subagent_type: codebase-pattern-finder):
   ```
   Analyze this codebase for patterns and conventions:
   1. What coding style/conventions are used?
   2. What architectural patterns are followed?
   3. Where do new features typically get added?
   4. What's the typical file/folder structure for new components?
   5. Are there example implementations to model after?

   Return: Conventions, patterns, where to add new code, examples to follow
   ```

2. **Synthesize findings into a practical guide:**

   Wait for all 3 agents to complete, then create a concise guide with this structure:

   ```markdown
   # Codebase Guide: [Project Name]

   ## Quick Start

   ### Prerequisites
   - [Required tools, versions, environment]

   ### Setup
   ```bash
   [Setup commands]
   ```

   ### Run
   ```bash
   [Run commands]
   ```

   ### Test
   ```bash
   [Test commands]
   ```

   ## Project Structure

   ```
   [Key directories and their purposes]
   ```

   ## How to Modify

   ### Adding a new [feature/component/endpoint]
   1. [Step-by-step based on existing patterns]
   2. [Where to add files]
   3. [What to import/register]

   ### Key files to understand
   - `path/to/file` - [purpose]
   - `another/file` - [purpose]

   ## Conventions
   - [Naming conventions]
   - [Code style patterns]
   - [Testing expectations]

   ## Improvement Suggestions

   ### Quick wins (low effort, high value)
   - [Suggestion 1]
   - [Suggestion 2]

   ### Consider for future
   - [Larger improvement 1]
   - [Larger improvement 2]
   ```

3. **Present the guide:**
   - Display the guide directly to the user
   - Keep it actionable and concise
   - Focus on what a developer needs to be productive immediately

## Important notes:

- This is a LIGHTWEIGHT command - use only 3 agents, keep output concise
- Focus on PRACTICAL guidance, not comprehensive documentation
- Improvement suggestions should be realistic and actionable
- Prioritize "how do I actually use this" over architectural deep-dives
- If the codebase is very simple, adjust output brevity accordingly
- Do NOT create a file - just present the guide in the response
