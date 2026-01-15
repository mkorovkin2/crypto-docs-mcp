# docs-agent-v3 Subagent Exploration Fix - Implementation Plan

## Overview

The `docs-agent-v3` repo is fundamentally broken. It was supposed to use **multi-agent LLM exploration** to deeply analyze repositories, but instead it relies on **regex-based static analysis** and **hardcoded templates** with minimal LLM usage (1-2 calls per phase instead of per-file/per-module).

This plan fixes the system to actually use subagents to:
1. **Explore all corners of cloned repos** with actual LLM reasoning
2. **Reconcile knowledge** across multiple agent explorations
3. **Explore important paths with new subagents**
4. **Generate real examples, FAQs, and usage patterns** using LLM intelligence

## Current State Analysis

### What's Broken

| Phase | Expected Behavior | Actual Behavior |
|-------|-------------------|-----------------|
| Discovery | LLM explores every directory, understands project structure | Regex-based file classification, 1 tiny LLM call |
| File Analysis | LLM deeply analyzes each file's purpose and patterns | Static regex extraction, LLM only for top 20 files |
| Module Analysis | LLM understands relationships and architecture | String matching for patterns, 1 LLM call for insights |
| Doc Synthesis | LLM writes comprehensive, contextual documentation | ZERO LLM calls - pure template concatenation |
| Example Generation | LLM creates real working examples from understanding | Hardcoded templates, 1 LLM call that often fails |

### Key Files to Fix

- `doc_agents/discovery.py` - Lines 335-431: Needs real agent exploration
- `doc_agents/file_analyzer.py` - Lines 356-473: Needs LLM for ALL files
- `doc_agents/module_analyzer.py` - Lines 287-397: Needs real architectural understanding
- `doc_agents/doc_synthesizer.py` - Lines 369-414: Needs LLM-based synthesis
- `doc_agents/example_generator.py` - Lines 355-464: Needs real example generation
- `doc_agents/orchestrator.py` - Lines 81-186: Needs subagent coordination

## Desired End State

A working multi-agent documentation system that:

1. **Discovery Phase**: Spawns multiple subagents to explore different directories in parallel, each agent uses LLM to understand what they find and reports back
2. **File Analysis Phase**: Uses LLM for EVERY source file (batched for efficiency), not just top 20
3. **Module Analysis Phase**: Spawns subagents to trace data flow, understand dependencies, identify patterns through actual code reading
4. **Knowledge Reconciliation**: Aggregates findings from all subagents into coherent understanding
5. **Doc Synthesis Phase**: Uses LLM to write documentation based on deep understanding
6. **Example Generation Phase**: Uses LLM to create working examples based on actual API understanding
7. **FAQ Generation**: NEW - Uses LLM to generate FAQs based on common patterns it observed

### Verification

- Run on a medium-complexity repo (50-200 files)
- Documentation should contain repo-specific insights, not boilerplate
- Examples should use actual API signatures from the repo
- FAQs should reflect actual complexity points found

## What We're NOT Doing

- Building a web UI
- Automated testing of generated examples
- Git history analysis
- Authentication for private repos
- Caching/incremental updates (full regeneration each time)

## Implementation Approach

**Strategy**: Replace local/static analysis with parallel LLM-based subagent exploration at each phase.

**Key Architectural Changes**:
1. Add a `SubagentCoordinator` class that manages parallel agent execution
2. Replace `analyze_file_locally()` with `analyze_file_with_llm()` for ALL files
3. Add knowledge reconciliation step after each exploration phase
4. Add FAQ generation phase
5. Remove hardcoded template generation in favor of LLM synthesis

---

## Phase 1: Subagent Coordinator Infrastructure

### Overview
Create the core infrastructure for spawning and coordinating multiple subagents.

### Changes Required:

#### 1. New File: `doc_agents/subagent_coordinator.py`

```python
"""Subagent Coordinator - Manages parallel LLM agent exploration."""

import asyncio
from typing import List, Dict, Any, Callable, TypeVar
from dataclasses import dataclass
from agents import Agent, Runner, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()

T = TypeVar('T')


@dataclass
class SubagentTask:
    """A task to be executed by a subagent."""
    name: str
    prompt: str
    model: str
    api_key: str
    output_type: Any = None
    tools: List = None


@dataclass
class SubagentResult:
    """Result from a subagent execution."""
    task_name: str
    success: bool
    output: Any
    error: str = None


class SubagentCoordinator:
    """Coordinates parallel execution of multiple LLM subagents."""

    def __init__(self, max_concurrent: int = 5):
        """
        Initialize coordinator.

        Args:
            max_concurrent: Maximum concurrent subagent executions
        """
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def run_task(self, task: SubagentTask) -> SubagentResult:
        """
        Run a single subagent task.

        Args:
            task: The task to execute

        Returns:
            SubagentResult with output or error
        """
        async with self.semaphore:
            try:
                agent = Agent(
                    name=task.name,
                    instructions="You are a specialized analysis agent. Provide thorough, detailed analysis.",
                    model=LitellmModel(model=task.model, api_key=task.api_key),
                    model_settings=ModelSettings(temperature=0.5, max_tokens=4096),
                    tools=task.tools or [],
                    output_type=task.output_type,
                )

                result = await Runner.run(agent, task.prompt)

                return SubagentResult(
                    task_name=task.name,
                    success=True,
                    output=result.final_output
                )

            except Exception as e:
                return SubagentResult(
                    task_name=task.name,
                    success=False,
                    output=None,
                    error=str(e)
                )

    async def run_parallel(
        self,
        tasks: List[SubagentTask],
        progress_callback: Callable[[int, int], None] = None
    ) -> List[SubagentResult]:
        """
        Run multiple tasks in parallel.

        Args:
            tasks: List of tasks to execute
            progress_callback: Optional callback for progress updates

        Returns:
            List of results (same order as tasks)
        """
        total = len(tasks)
        completed = 0

        async def run_with_progress(task: SubagentTask) -> SubagentResult:
            nonlocal completed
            result = await self.run_task(task)
            completed += 1
            if progress_callback:
                progress_callback(completed, total)
            return result

        # Run all tasks concurrently (semaphore limits actual parallelism)
        results = await asyncio.gather(
            *[run_with_progress(task) for task in tasks],
            return_exceptions=True
        )

        # Convert exceptions to SubagentResults
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                final_results.append(SubagentResult(
                    task_name=tasks[i].name,
                    success=False,
                    output=None,
                    error=str(result)
                ))
            else:
                final_results.append(result)

        return final_results

    async def explore_directories(
        self,
        directories: List[str],
        repository_path: str,
        model: str,
        api_key: str
    ) -> List[SubagentResult]:
        """
        Spawn subagents to explore directories in parallel.

        Args:
            directories: List of directory paths to explore
            repository_path: Base repository path
            model: LLM model to use
            api_key: API key for LLM

        Returns:
            List of exploration results
        """
        from tools import list_directory, read_file, get_file_structure

        tasks = []
        for dir_path in directories:
            full_path = f"{repository_path}/{dir_path}" if dir_path != "." else repository_path

            prompt = f"""Explore and analyze the directory: {dir_path}

Use the available tools to:
1. List all files in this directory
2. Read the most important files (entry points, configs, main modules)
3. Understand what this directory/module is responsible for
4. Identify key classes, functions, and patterns
5. Note dependencies on other parts of the codebase

Provide a comprehensive analysis of:
- The PURPOSE of this directory/module
- KEY COMPONENTS (classes, functions) with their roles
- PATTERNS used (design patterns, conventions)
- DEPENDENCIES (what it imports/uses)
- EXPORTS (what it provides to others)
- HOW IT FITS into the larger system

Be thorough and specific. Reference actual file names and code elements."""

            tasks.append(SubagentTask(
                name=f"explore_{dir_path.replace('/', '_')}",
                prompt=prompt,
                model=model,
                api_key=api_key,
                tools=[list_directory, read_file, get_file_structure]
            ))

        console.print(f"  Spawning {len(tasks)} subagents to explore directories...")
        return await self.run_parallel(tasks)


def reconcile_explorations(results: List[SubagentResult]) -> Dict[str, Any]:
    """
    Reconcile knowledge from multiple exploration results.

    Args:
        results: List of SubagentResults from parallel explorations

    Returns:
        Reconciled knowledge dictionary
    """
    reconciled = {
        "modules": [],
        "key_files": [],
        "patterns": set(),
        "dependencies": {},
        "insights": [],
        "failed_explorations": []
    }

    for result in results:
        if result.success and result.output:
            output = str(result.output)

            # Extract insights from each exploration
            reconciled["insights"].append({
                "area": result.task_name,
                "analysis": output
            })
        else:
            reconciled["failed_explorations"].append({
                "area": result.task_name,
                "error": result.error
            })

    return reconciled
```

### Success Criteria:

#### Automated Verification:
- [ ] `python -c "from doc_agents.subagent_coordinator import SubagentCoordinator; print('OK')"` works
- [ ] No import errors

#### Manual Verification:
- [ ] Run a simple parallel task test
- [ ] Verify semaphore correctly limits concurrency

---

## Phase 2: Fix Discovery Phase - Real Subagent Exploration

### Overview
Replace the current local file scanning with actual LLM-based exploration using parallel subagents.

### Changes Required:

#### 1. Update `doc_agents/discovery.py`

**Replace `run_discovery()` function** (lines 335-431) with:

```python
async def run_discovery(repository_path: str) -> DiscoveryHandoff:
    """
    Run the discovery phase using parallel subagent exploration.

    This spawns multiple LLM agents to explore different parts of the repo
    and reconciles their findings into a coherent picture.

    Args:
        repository_path: Path to the repository to analyze

    Returns:
        DiscoveryHandoff with complete repository analysis
    """
    if not os.path.exists(repository_path):
        raise ValueError(f"Repository path does not exist: {repository_path}")

    repository_path = os.path.abspath(repository_path)
    config = AGENT_CONFIGS["discovery"]

    from doc_agents.subagent_coordinator import SubagentCoordinator, SubagentTask, reconcile_explorations

    coordinator = SubagentCoordinator(max_concurrent=5)

    # Phase 1: Quick local scan to identify directories
    print("  Scanning for directories...")
    directories = []
    for item in os.listdir(repository_path):
        if item.startswith('.') or item in SKIP_DIRECTORIES:
            continue
        full_path = os.path.join(repository_path, item)
        if os.path.isdir(full_path):
            directories.append(item)

    # Add root directory
    directories.insert(0, ".")

    # Phase 2: Spawn subagents to explore each directory
    print(f"  Spawning {len(directories)} subagents to explore directories...")

    exploration_results = await coordinator.explore_directories(
        directories[:15],  # Limit to top 15 directories for cost control
        repository_path,
        config.model,
        API_KEYS["xai"]
    )

    # Phase 3: Reconcile findings
    print("  Reconciling exploration findings...")
    reconciled = reconcile_explorations(exploration_results)

    # Phase 4: Use master agent to synthesize overall understanding
    print("  Synthesizing overall repository understanding...")

    synthesis_prompt = f"""Based on the following explorations of different parts of this repository,
provide a comprehensive analysis:

REPOSITORY: {os.path.basename(repository_path)}
PATH: {repository_path}

EXPLORATION RESULTS:
{json.dumps([{"area": i["area"], "analysis": i["analysis"][:2000]} for i in reconciled["insights"]], indent=2)}

FAILED EXPLORATIONS:
{json.dumps(reconciled["failed_explorations"], indent=2)}

Synthesize this into:
1. A 2-3 sentence summary of what this repository does
2. List of detected programming languages
3. List of detected frameworks
4. Key entry points (main files, index files)
5. Overall architecture pattern (monolith, microservices, etc.)
6. The most important directories/modules and their purposes

Be specific and reference actual file/directory names from the explorations."""

    synthesis_agent = Agent(
        name="SynthesisAgent",
        instructions="Synthesize exploration findings into a coherent repository analysis.",
        model=LitellmModel(model=config.model, api_key=API_KEYS["xai"]),
        model_settings=ModelSettings(temperature=0.3, max_tokens=4096),
    )

    synthesis_result = await Runner.run(synthesis_agent, synthesis_prompt)
    synthesis_text = str(synthesis_result.final_output)

    # Phase 5: Also do local file classification for completeness
    files = classify_files_locally(repository_path)
    languages, frameworks, entry_points = detect_languages_and_frameworks(repository_path)
    directory_structure = build_directory_structure(repository_path)

    # Create handoff
    handoff = DiscoveryHandoff(
        repository_path=repository_path,
        total_files=len(files),
        files=files,
        directory_structure=directory_structure,
        detected_languages=languages,
        detected_frameworks=frameworks,
        entry_points=entry_points,
        summary=synthesis_text
    )

    # Save handoff
    os.makedirs(HANDOFF_DIR, exist_ok=True)
    handoff_path = os.path.join(HANDOFF_DIR, "discovery_handoff.json")
    with open(handoff_path, 'w') as f:
        f.write(handoff.model_dump_json(indent=2))

    # Also save raw exploration results for later phases
    exploration_path = os.path.join(HANDOFF_DIR, "exploration_results.json")
    with open(exploration_path, 'w') as f:
        json.dump(reconciled, f, indent=2, default=str)

    return handoff
```

### Success Criteria:

#### Automated Verification:
- [ ] Discovery phase completes without errors
- [ ] `exploration_results.json` is created with subagent findings

#### Manual Verification:
- [ ] Summary contains repo-specific insights, not generic text
- [ ] Multiple directories were actually explored by subagents

---

## Phase 3: Fix File Analysis - LLM for ALL Files

### Overview
Replace static regex analysis with actual LLM analysis for every source file.

### Changes Required:

#### 1. Update `doc_agents/file_analyzer.py`

**Replace `run_file_analysis()` function** (lines 418-473) with batched LLM analysis:

```python
async def run_file_analysis(discovery: DiscoveryHandoff) -> List[FileAnalysisHandoff]:
    """
    Run file analysis using LLM for ALL source files.

    Args:
        discovery: DiscoveryHandoff from discovery phase

    Returns:
        List of FileAnalysisHandoff for all analyzed files
    """
    from doc_agents.subagent_coordinator import SubagentCoordinator, SubagentTask

    config = AGENT_CONFIGS["file_analyzer"]
    coordinator = SubagentCoordinator(max_concurrent=10)

    # Filter to analyzable files
    analyzable_files = [
        f for f in discovery.files
        if f.file_type in {FileType.SOURCE_CODE, FileType.CONFIG}
        and f.language is not None
    ]

    print(f"  Analyzing {len(analyzable_files)} files with LLM...")

    # Create analysis tasks for each file
    tasks = []
    for file_cls in analyzable_files:
        file_path = os.path.join(discovery.repository_path, file_cls.path)
        content = read_file(file_path)

        if content.startswith("Error:"):
            continue

        # Truncate large files
        if len(content) > 15000:
            content = content[:15000] + "\n\n... [truncated]"

        prompt = f"""Analyze this {file_cls.language} file in detail:

FILE: {file_cls.path}

```{file_cls.language}
{content}
```

Provide a comprehensive analysis:

1. PURPOSE: What is this file's primary responsibility? (1-2 sentences)

2. IMPORTS: List all imports with classification:
   - External libraries (from npm/pip/etc)
   - Internal modules (from this codebase)
   - Standard library

3. CLASSES: For each class:
   - Name and base classes
   - Purpose/responsibility
   - Key methods with their roles
   - Important attributes

4. FUNCTIONS: For each function:
   - Name and parameters
   - What it does
   - What it returns
   - Side effects if any

5. EXPORTS: What does this file provide to other files?

6. COMPLEXITY: Rate 1-10 with justification

7. KEY INSIGHTS:
   - Design patterns used
   - Notable implementation choices
   - Potential issues or technical debt
   - How it connects to other parts of the system

Be specific and thorough. This analysis will be used to generate documentation."""

        tasks.append(SubagentTask(
            name=f"analyze_{file_cls.path.replace('/', '_')}",
            prompt=prompt,
            model=config.model,
            api_key=API_KEYS["google"],
            output_type=FileAnalysisHandoff
        ))

    # Run analysis in parallel batches
    results = []
    batch_size = 20

    for i in range(0, len(tasks), batch_size):
        batch = tasks[i:i + batch_size]
        print(f"    Processing batch {i//batch_size + 1}/{(len(tasks) + batch_size - 1)//batch_size}...")

        batch_results = await coordinator.run_parallel(batch)

        for j, result in enumerate(batch_results):
            file_cls = analyzable_files[i + j]

            if result.success and result.output:
                if isinstance(result.output, FileAnalysisHandoff):
                    results.append(result.output)
                else:
                    # Parse from string if needed
                    results.append(parse_analysis_from_text(
                        str(result.output),
                        file_cls.path,
                        file_cls.language
                    ))
            else:
                # Fall back to local analysis on failure
                file_path = os.path.join(discovery.repository_path, file_cls.path)
                content = read_file(file_path)
                if not content.startswith("Error:"):
                    results.append(analyze_file_locally(file_cls.path, content, file_cls.language))

    # Save results
    os.makedirs(HANDOFF_DIR, exist_ok=True)
    combined_path = os.path.join(HANDOFF_DIR, "file_analysis_combined.json")
    with open(combined_path, 'w') as f:
        json.dump([a.model_dump() for a in results], f, indent=2)

    print(f"  File analysis complete. {len(results)} files analyzed with LLM.")
    return results


def parse_analysis_from_text(text: str, path: str, language: str) -> FileAnalysisHandoff:
    """Parse LLM text response into FileAnalysisHandoff."""
    # Extract purpose
    purpose_match = re.search(r'PURPOSE:?\s*(.+?)(?:\n\n|\n[A-Z])', text, re.DOTALL)
    purpose = purpose_match.group(1).strip() if purpose_match else "Unknown"

    # This is a fallback - structured output should work most of the time
    return FileAnalysisHandoff(
        path=path,
        language=language,
        purpose=purpose[:200],
        imports=[],
        exports=[],
        classes=[],
        functions=[],
        constants=[],
        key_insights=[text[:500]],  # Store raw analysis as insight
        dependencies=[],
        complexity_score=5,
        raw_summary=text[:1000]
    )
```

### Success Criteria:

#### Automated Verification:
- [ ] All source files processed by LLM (check logs)
- [ ] `file_analysis_combined.json` contains LLM-generated insights

#### Manual Verification:
- [ ] File purposes are specific and accurate, not generic
- [ ] Key insights reflect actual code understanding

---

## Phase 4: Fix Module Analysis - Deep Architectural Understanding

### Overview
Replace pattern matching with actual LLM-based architectural analysis.

### Changes Required:

#### 1. Update `doc_agents/module_analyzer.py`

**Replace `run_module_analysis()` function** (lines 287-397):

```python
async def run_module_analysis(
    discovery: DiscoveryHandoff,
    file_analyses: List[FileAnalysisHandoff]
) -> ModuleAnalysisHandoff:
    """
    Run module analysis using LLM for deep architectural understanding.
    """
    from doc_agents.subagent_coordinator import SubagentCoordinator, SubagentTask

    config = AGENT_CONFIGS["module_analyzer"]
    coordinator = SubagentCoordinator(max_concurrent=5)

    # Load exploration results from discovery phase
    exploration_path = os.path.join(HANDOFF_DIR, "exploration_results.json")
    exploration_data = {}
    if os.path.exists(exploration_path):
        with open(exploration_path) as f:
            exploration_data = json.load(f)

    # Group file analyses by directory (module)
    modules_by_dir = identify_modules(file_analyses, discovery.repository_path)

    print(f"  Analyzing {len(modules_by_dir)} modules with LLM...")

    # Spawn subagents to analyze each module's architecture
    module_tasks = []
    for module in modules_by_dir[:10]:  # Limit for cost
        # Gather file analysis summaries for this module
        module_files_analysis = [
            {"path": f.path, "purpose": f.purpose, "classes": [c.name for c in f.classes], "functions": [fn.name for fn in f.functions]}
            for f in file_analyses
            if f.path.startswith(module.path) or (module.path == "." and "/" not in f.path)
        ]

        prompt = f"""Analyze the architecture of this module:

MODULE: {module.name}
PATH: {module.path}

FILES IN MODULE:
{json.dumps(module_files_analysis, indent=2)}

EXPLORATION INSIGHTS (from discovery):
{json.dumps([i for i in exploration_data.get("insights", []) if module.path in i.get("area", "")], indent=2)}

Analyze:
1. MODULE PURPOSE: What is this module's responsibility in the system?
2. PUBLIC API: What does this module expose to other modules?
3. DEPENDENCIES: What other modules/libraries does it depend on?
4. DESIGN PATTERNS: What patterns are used (Factory, Singleton, Observer, etc.)?
5. DATA FLOW: How does data enter and exit this module?
6. COUPLING: How tightly coupled is it to other modules?
7. COHESION: How focused is the module on a single responsibility?
8. POTENTIAL ISSUES: Technical debt, complexity, or design concerns

Be specific and reference actual files/classes/functions."""

        module_tasks.append(SubagentTask(
            name=f"module_{module.name}",
            prompt=prompt,
            model=config.model,
            api_key=API_KEYS["google"]
        ))

    module_results = await coordinator.run_parallel(module_tasks)

    # Spawn subagent to analyze overall architecture
    print("  Analyzing overall system architecture...")

    arch_prompt = f"""Analyze the overall architecture of this repository:

REPOSITORY: {os.path.basename(discovery.repository_path)}
LANGUAGES: {', '.join(discovery.detected_languages)}
FRAMEWORKS: {', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else 'None'}

MODULES:
{json.dumps([{"name": m.name, "files": len(m.files), "purpose": m.purpose} for m in modules_by_dir], indent=2)}

MODULE ANALYSIS RESULTS:
{json.dumps([{"module": r.task_name, "analysis": str(r.output)[:1500]} for r in module_results if r.success], indent=2)}

Provide:
1. ARCHITECTURE PATTERN: Is this MVC, microservices, monolith, layered, etc.?
2. DATA FLOW: How does data flow through the system? (Entry points -> processing -> output)
3. KEY ABSTRACTIONS: What are the main interfaces/contracts?
4. COUPLING ANALYSIS: Which modules are tightly coupled?
5. ENTRY POINTS: How do users/clients interact with the system?
6. EXTENSION POINTS: Where can the system be extended?
7. ARCHITECTURAL INSIGHTS: Key observations about design quality
8. RECOMMENDATIONS: Suggested improvements

Be thorough and specific."""

    arch_result = await coordinator.run_task(SubagentTask(
        name="architecture_analysis",
        prompt=arch_prompt,
        model=config.model,
        api_key=API_KEYS["google"]
    ))

    # Build dependency graph
    dependency_graph = build_dependency_graph(file_analyses)

    # Detect patterns
    architecture_patterns = detect_architecture_patterns(modules_by_dir, file_analyses)

    # Extract insights from LLM results
    architectural_insights = []
    if arch_result.success:
        # Parse insights from architecture analysis
        arch_text = str(arch_result.output)
        lines = arch_text.split('\n')
        for line in lines:
            line = line.strip()
            if line and len(line) > 20:
                architectural_insights.append(line)

    handoff = ModuleAnalysisHandoff(
        modules=modules_by_dir,
        dependency_graph=dependency_graph,
        architecture_patterns=architecture_patterns,
        data_flow=["See architectural insights for data flow analysis"],
        entry_points=discovery.entry_points,
        public_apis={m.name: m.public_api for m in modules_by_dir},
        key_relationships=[f"{e.source} -> {e.target}" for e in dependency_graph[:30]],
        architectural_insights=architectural_insights[:20]
    )

    # Save
    handoff_path = os.path.join(HANDOFF_DIR, "module_analysis_handoff.json")
    with open(handoff_path, 'w') as f:
        f.write(handoff.model_dump_json(indent=2))

    # Save detailed module analysis
    detailed_path = os.path.join(HANDOFF_DIR, "module_analysis_detailed.json")
    with open(detailed_path, 'w') as f:
        json.dump({
            "modules": [{"name": r.task_name, "analysis": str(r.output)} for r in module_results],
            "architecture": str(arch_result.output) if arch_result.success else None
        }, f, indent=2)

    return handoff
```

### Success Criteria:

#### Automated Verification:
- [ ] Module analysis completes with LLM insights
- [ ] `module_analysis_detailed.json` contains per-module LLM analysis

#### Manual Verification:
- [ ] Architectural insights are specific to the repo, not generic
- [ ] Design patterns are accurately identified

---

## Phase 5: Fix Documentation Synthesis - LLM-Based Writing

### Overview
Replace template concatenation with actual LLM-written documentation.

### Changes Required:

#### 1. Update `doc_agents/doc_synthesizer.py`

**Replace `run_doc_synthesis()` function** (lines 369-414):

```python
async def run_doc_synthesis(
    discovery: DiscoveryHandoff,
    file_analyses: List[FileAnalysisHandoff],
    module_analysis: ModuleAnalysisHandoff,
) -> FinalDocumentation:
    """
    Generate documentation using LLM synthesis.
    """
    from doc_agents.subagent_coordinator import SubagentCoordinator, SubagentTask

    config = AGENT_CONFIGS["doc_synthesizer"]
    coordinator = SubagentCoordinator(max_concurrent=5)

    repo_name = os.path.basename(discovery.repository_path)

    # Load detailed analysis from previous phases
    detailed_path = os.path.join(HANDOFF_DIR, "module_analysis_detailed.json")
    detailed_analysis = {}
    if os.path.exists(detailed_path):
        with open(detailed_path) as f:
            detailed_analysis = json.load(f)

    print("  Generating documentation sections with LLM...")

    # Generate each section with dedicated LLM calls

    # 1. Overview section
    overview_prompt = f"""Write a comprehensive overview section for documentation of: {repo_name}

SUMMARY: {discovery.summary}
LANGUAGES: {', '.join(discovery.detected_languages)}
FRAMEWORKS: {', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else 'None'}
TOTAL FILES: {discovery.total_files}
MODULES: {len(module_analysis.modules)}

ARCHITECTURAL INSIGHTS:
{chr(10).join(module_analysis.architectural_insights[:10])}

Write a clear, comprehensive overview that:
1. Explains what this project does and why it exists
2. Describes the target audience and use cases
3. Highlights key features and capabilities
4. Provides context for the architecture
5. Lists prerequisites and requirements

Write in clear, professional markdown. Be specific about THIS project, not generic documentation."""

    overview_result = await coordinator.run_task(SubagentTask(
        name="overview",
        prompt=overview_prompt,
        model=config.model,
        api_key=API_KEYS["google"]
    ))

    # 2. Architecture section
    arch_prompt = f"""Write a detailed architecture documentation section for: {repo_name}

ARCHITECTURE PATTERNS: {', '.join(module_analysis.architecture_patterns)}

MODULES:
{json.dumps([{"name": m.name, "purpose": m.purpose, "files": len(m.files)} for m in module_analysis.modules], indent=2)}

DEPENDENCIES:
{json.dumps([{"from": e.source, "to": e.target, "type": e.relationship_type} for e in module_analysis.dependency_graph[:20]], indent=2)}

DETAILED ANALYSIS:
{json.dumps(detailed_analysis.get("architecture", ""), indent=2)[:3000]}

Write architecture documentation that:
1. Explains the overall system design
2. Describes each major component/module
3. Shows how components interact (with ASCII diagrams if helpful)
4. Explains key design decisions
5. Documents the dependency structure

Include ASCII diagrams where helpful. Be specific and technical."""

    arch_result = await coordinator.run_task(SubagentTask(
        name="architecture",
        prompt=arch_prompt,
        model=config.model,
        api_key=API_KEYS["google"]
    ))

    # 3. Module documentation (parallel for each module)
    module_tasks = []
    for module in module_analysis.modules[:10]:
        module_files = [f for f in file_analyses if f.path.startswith(module.path) or (module.path == "." and "/" not in f.path)]

        prompt = f"""Write detailed documentation for the {module.name} module:

PATH: {module.path}
PURPOSE: {module.purpose}

FILES:
{json.dumps([{"path": f.path, "purpose": f.purpose, "classes": [c.name for c in f.classes], "functions": [fn.name for fn in f.functions]} for f in module_files[:10]], indent=2)}

PUBLIC API:
{json.dumps(module.public_api[:15], indent=2)}

Write module documentation that:
1. Explains the module's responsibility
2. Documents the public API with examples
3. Describes key classes and functions
4. Shows usage patterns
5. Notes dependencies and requirements

Be specific and include code examples where helpful."""

        module_tasks.append(SubagentTask(
            name=f"module_{module.name}",
            prompt=prompt,
            model=config.model,
            api_key=API_KEYS["google"]
        ))

    module_results = await coordinator.run_parallel(module_tasks)

    # 4. API Reference section
    api_prompt = f"""Write an API reference section for: {repo_name}

KEY CLASSES:
{json.dumps([{"file": f.path, "classes": [{"name": c.name, "methods": [m.name for m in c.methods]} for c in f.classes]} for f in file_analyses if f.classes][:15], indent=2)}

KEY FUNCTIONS:
{json.dumps([{"file": f.path, "functions": [{"name": fn.name, "params": fn.parameters} for fn in f.functions if fn.name in f.exports]} for f in file_analyses if f.functions][:15], indent=2)}

Write API reference documentation that:
1. Documents each public class with methods
2. Documents each public function with parameters
3. Includes type information where available
4. Shows example usage for complex APIs
5. Notes return values and exceptions

Format as clean, scannable markdown."""

    api_result = await coordinator.run_task(SubagentTask(
        name="api_reference",
        prompt=api_prompt,
        model=config.model,
        api_key=API_KEYS["google"]
    ))

    # 5. Getting Started section
    getting_started_prompt = f"""Write a Getting Started guide for: {repo_name}

LANGUAGES: {', '.join(discovery.detected_languages)}
FRAMEWORKS: {', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else 'None'}
ENTRY POINTS: {', '.join(discovery.entry_points)}

Write a getting started guide that:
1. Lists prerequisites
2. Explains installation steps
3. Shows basic usage example
4. Explains configuration
5. Points to next steps

Make it practical and actionable. Include actual commands and code examples."""

    getting_started_result = await coordinator.run_task(SubagentTask(
        name="getting_started",
        prompt=getting_started_prompt,
        model=config.model,
        api_key=API_KEYS["google"]
    ))

    # Assemble documentation
    documentation = FinalDocumentation(
        repository_name=repo_name,
        overview=str(overview_result.output) if overview_result.success else discovery.summary,
        architecture=DocumentationSection(
            title="Architecture",
            content=str(arch_result.output) if arch_result.success else "See module documentation.",
            subsections=[]
        ),
        modules=[
            DocumentationSection(
                title=r.task_name.replace("module_", ""),
                content=str(r.output) if r.success else "Documentation generation failed.",
                subsections=[]
            )
            for r in module_results
        ],
        api_reference=DocumentationSection(
            title="API Reference",
            content=str(api_result.output) if api_result.success else "See module documentation.",
            subsections=[]
        ),
        examples=[],  # Filled by example generator
        getting_started=DocumentationSection(
            title="Getting Started",
            content=str(getting_started_result.output) if getting_started_result.success else "See README.",
            subsections=[]
        ),
        configuration=None
    )

    return documentation
```

### Success Criteria:

#### Automated Verification:
- [ ] Doc synthesis completes with LLM-generated content
- [ ] README.md contains substantive, specific content

#### Manual Verification:
- [ ] Documentation reads naturally, not templated
- [ ] Architecture section includes actual diagrams
- [ ] Examples are specific to the codebase

---

## Phase 6: Add FAQ Generation

### Overview
Add a new phase that generates FAQs based on code patterns and complexity points.

### Changes Required:

#### 1. New File: `doc_agents/faq_generator.py`

```python
"""FAQ Generator Agent - Creates FAQs based on code analysis."""

import os
from typing import List
from agents import Agent, Runner, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

from config import AGENT_CONFIGS, API_KEYS, OUTPUT_DIR, HANDOFF_DIR
from models import FileAnalysisHandoff, ModuleAnalysisHandoff


async def generate_faqs(
    discovery,
    file_analyses: List[FileAnalysisHandoff],
    module_analysis: ModuleAnalysisHandoff
) -> List[dict]:
    """
    Generate FAQs based on code analysis.
    """
    from doc_agents.subagent_coordinator import SubagentCoordinator, SubagentTask

    config = AGENT_CONFIGS["doc_synthesizer"]
    coordinator = SubagentCoordinator(max_concurrent=3)

    repo_name = os.path.basename(discovery.repository_path)

    # Identify complexity points and common patterns
    complex_files = [f for f in file_analyses if f.complexity_score >= 7]
    pattern_files = [f for f in file_analyses if f.key_insights]

    prompt = f"""Generate a comprehensive FAQ section for: {repo_name}

REPOSITORY OVERVIEW:
{discovery.summary}

LANGUAGES: {', '.join(discovery.detected_languages)}
FRAMEWORKS: {', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else 'None'}

COMPLEX AREAS (likely to confuse users):
{[{"file": f.path, "purpose": f.purpose, "complexity": f.complexity_score} for f in complex_files[:10]]}

ARCHITECTURAL INSIGHTS:
{module_analysis.architectural_insights[:10]}

KEY PATTERNS:
{module_analysis.architecture_patterns}

Generate 10-15 FAQs that address:

1. GETTING STARTED questions:
   - How do I install this?
   - What are the prerequisites?
   - How do I run it?

2. USAGE questions:
   - How do I perform common tasks?
   - What are the main entry points?
   - How do I configure it?

3. ARCHITECTURE questions:
   - How is the code organized?
   - What patterns are used?
   - How do modules interact?

4. TROUBLESHOOTING questions:
   - What are common errors?
   - How do I debug issues?
   - Where are logs?

5. ADVANCED questions:
   - How do I extend it?
   - How do I customize behavior?
   - What are the performance considerations?

Format each FAQ as:
## Q: [Question]
**A:** [Detailed answer with code examples if relevant]

Be specific to THIS codebase, not generic."""

    result = await coordinator.run_task(SubagentTask(
        name="faq_generation",
        prompt=prompt,
        model=config.model,
        api_key=API_KEYS["google"]
    ))

    # Write FAQ file
    faq_path = os.path.join(OUTPUT_DIR, "FAQ.md")
    faq_content = f"""# Frequently Asked Questions - {repo_name}

{str(result.output) if result.success else "FAQ generation failed. Please refer to other documentation."}
"""

    with open(faq_path, 'w') as f:
        f.write(faq_content)

    print(f"  FAQs written to {faq_path}")

    return []  # Return empty list, actual FAQs are in file
```

#### 2. Update `doc_agents/orchestrator.py` to include FAQ generation:

Add after Phase 5 (Example Generation):

```python
        # Phase 6: FAQ Generation
        console.print("\n[bold cyan]Phase 6: FAQ Generation[/bold cyan]")
        try:
            from doc_agents.faq_generator import generate_faqs
            await self.run_phase(
                "FAQ Generation",
                generate_faqs(self.discovery, self.file_analyses, self.module_analysis),
                "Generating FAQs"
            )
            console.print(f"  [green]✓[/green] Generated FAQ.md")
        except Exception as e:
            console.print(f"  [yellow]![/yellow] FAQ generation failed: {e}")
```

### Success Criteria:

#### Automated Verification:
- [ ] FAQ.md is generated
- [ ] FAQs are repo-specific

#### Manual Verification:
- [ ] FAQs address actual complexity points in the code
- [ ] Answers are helpful and accurate

---

## Phase 7: Update Orchestrator for Full Subagent Flow

### Overview
Update the orchestrator to properly coordinate all phases with subagent exploration.

### Changes Required:

#### 1. Update `doc_agents/orchestrator.py`

Full replacement of `DocumentationOrchestrator.run()` method:

```python
async def run(self) -> str:
    """
    Run the complete documentation generation workflow with subagent exploration.
    """
    console.print(Panel.fit(
        "[bold blue]Repository Documentation Generator[/bold blue]\n"
        "[dim]Powered by multi-agent LLM exploration[/dim]\n\n"
        f"Repository: {self.repository_path}",
        border_style="blue"
    ))

    total_phases = 6

    # Phase 1: Discovery with subagent exploration
    console.print(f"\n[bold cyan]Phase 1/{total_phases}: Discovery & Exploration[/bold cyan]")
    try:
        self.discovery = await self.run_phase(
            "Discovery",
            run_discovery(self.repository_path),
            "Spawning subagents to explore repository"
        )
        console.print(f"  [green]✓[/green] Explored {len([d for d in os.listdir(self.repository_path) if os.path.isdir(os.path.join(self.repository_path, d))])} directories")
        console.print(f"  [green]✓[/green] Found {self.discovery.total_files} files")
        console.print(f"  [green]✓[/green] Languages: {', '.join(self.discovery.detected_languages) or 'Unknown'}")
    except Exception as e:
        console.print(f"  [red]✗[/red] Discovery failed: {e}")
        raise

    # Phase 2: File Analysis with LLM for ALL files
    console.print(f"\n[bold cyan]Phase 2/{total_phases}: Deep File Analysis[/bold cyan]")
    try:
        analyzable = len([f for f in self.discovery.files if f.language])
        console.print(f"  [dim]Analyzing {analyzable} files with LLM...[/dim]")
        self.file_analyses = await self.run_phase(
            "File Analysis",
            run_file_analysis(self.discovery),
            "Running LLM analysis on all source files"
        )
        console.print(f"  [green]✓[/green] Analyzed {len(self.file_analyses)} files")
    except Exception as e:
        console.print(f"  [red]✗[/red] File analysis failed: {e}")
        raise

    # Phase 3: Module Analysis with architectural understanding
    console.print(f"\n[bold cyan]Phase 3/{total_phases}: Architectural Analysis[/bold cyan]")
    try:
        self.module_analysis = await self.run_phase(
            "Module Analysis",
            run_module_analysis(self.discovery, self.file_analyses),
            "Analyzing architecture with subagents"
        )
        console.print(f"  [green]✓[/green] Identified {len(self.module_analysis.modules)} modules")
        console.print(f"  [green]✓[/green] Patterns: {', '.join(self.module_analysis.architecture_patterns) or 'None detected'}")
    except Exception as e:
        console.print(f"  [red]✗[/red] Module analysis failed: {e}")
        raise

    # Phase 4: Documentation Synthesis with LLM
    console.print(f"\n[bold cyan]Phase 4/{total_phases}: Documentation Generation[/bold cyan]")
    try:
        self.documentation = await self.run_phase(
            "Documentation Synthesis",
            run_doc_synthesis(self.discovery, self.file_analyses, self.module_analysis),
            "Generating documentation with LLM"
        )
        write_documentation_files(self.documentation)
        console.print(f"  [green]✓[/green] Generated comprehensive documentation")
    except Exception as e:
        console.print(f"  [red]✗[/red] Documentation synthesis failed: {e}")
        raise

    # Phase 5: Example Generation
    console.print(f"\n[bold cyan]Phase 5/{total_phases}: Example Generation[/bold cyan]")
    try:
        primary_lang = self.discovery.detected_languages[0] if self.discovery.detected_languages else "python"
        examples = await self.run_phase(
            "Example Generation",
            generate_examples(self.module_analysis, self.file_analyses, primary_lang),
            "Generating code examples"
        )
        self.documentation.examples = examples
        write_examples_file(examples)
        console.print(f"  [green]✓[/green] Generated {len(examples)} examples")
    except Exception as e:
        console.print(f"  [yellow]![/yellow] Example generation failed: {e}")

    # Phase 6: FAQ Generation
    console.print(f"\n[bold cyan]Phase 6/{total_phases}: FAQ Generation[/bold cyan]")
    try:
        from doc_agents.faq_generator import generate_faqs
        await self.run_phase(
            "FAQ Generation",
            generate_faqs(self.discovery, self.file_analyses, self.module_analysis),
            "Generating FAQs"
        )
        console.print(f"  [green]✓[/green] Generated FAQ.md")
    except Exception as e:
        console.print(f"  [yellow]![/yellow] FAQ generation failed: {e}")

    # Summary
    console.print(Panel.fit(
        "[bold green]Documentation Complete![/bold green]\n\n"
        f"Output: [cyan]{OUTPUT_DIR}/[/cyan]\n\n"
        "Generated files:\n"
        "  • README.md - Main documentation\n"
        "  • API_REFERENCE.md - API docs\n"
        "  • EXAMPLES.md - Code examples\n"
        "  • FAQ.md - Frequently asked questions\n"
        f"  • modules/ - {len(self.documentation.modules)} module docs\n\n"
        f"[dim]All documentation generated using LLM analysis[/dim]",
        border_style="green"
    ))

    return OUTPUT_DIR
```

### Success Criteria:

#### Automated Verification:
- [ ] All 6 phases complete
- [ ] All output files generated

#### Manual Verification:
- [ ] Documentation quality is notably better than template-based
- [ ] Insights are specific to the analyzed repository

---

## Testing Strategy

### Unit Tests:
- Test SubagentCoordinator with mock tasks
- Test knowledge reconciliation logic
- Test LLM response parsing

### Integration Tests:
- Run on a small Python repo (5-10 files)
- Run on a medium TypeScript repo (20-50 files)
- Verify output quality

### Manual Testing Steps:
1. Clone a public repository (e.g., `requests`, `express`)
2. Run `python main.py /path/to/repo`
3. Verify:
   - Discovery explores multiple directories
   - File analysis covers all source files
   - Documentation contains repo-specific insights
   - Examples use actual API signatures
   - FAQs address real complexity points

## Performance Considerations

- **Cost Control**: Limit parallel agents to 5-10 concurrent
- **Token Limits**: Truncate file contents at 15k chars
- **Batch Processing**: Process files in batches of 20
- **Caching**: Save intermediate results to `.handoffs/`
- **Timeout**: Add 60-second timeout per agent call

## Migration Notes

No migration needed - this is a complete rewrite of the analysis logic.
Existing handoff models remain compatible.

## References

- IMPLEMENTATION_PLAN.md - Original spec (not followed)
- OpenAI Agents SDK: https://openai.github.io/openai-agents-python/
- LiteLLM: https://docs.litellm.ai/docs/
