"""Subagent Coordinator - Manages parallel LLM agent exploration."""

import warnings
# Must be before any pydantic imports
warnings.filterwarnings("ignore", message=".*Pydantic serializer warnings.*")
warnings.filterwarnings("ignore", message=".*PydanticSerializationUnexpectedValue.*")

import asyncio
import os
import json
from typing import List, Dict, Any, Callable, TypeVar
from dataclasses import dataclass
from agents import Agent, Runner, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel
from rich.console import Console
from doc_agents.event_logger import (
    log_subagent_spawn,
    log_subagent_result,
    log_finding,
    log_error,
    extract_key_findings,
)

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
    temperature: float = 0.5
    max_tokens: int = 4096


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

    async def run_task(self, task: SubagentTask, log_events: bool = True) -> SubagentResult:
        """
        Run a single subagent task.

        Args:
            task: The task to execute
            log_events: Whether to log start/complete events

        Returns:
            SubagentResult with output or error
        """
        async with self.semaphore:
            # Extract target from task name for logging
            target = task.name.replace("explore_", "").replace("_", "/")
            if target == "root":
                target = "."

            if log_events:
                log_subagent_spawn(task.name, target, task.model.split("/")[-1])

            try:
                agent = Agent(
                    name=task.name,
                    instructions="You are a specialized analysis agent. Provide thorough, detailed analysis based on what you observe.",
                    model=LitellmModel(model=task.model, api_key=task.api_key),
                    model_settings=ModelSettings(
                        temperature=task.temperature,
                        max_tokens=task.max_tokens
                    ),
                    tools=task.tools or [],
                    output_type=task.output_type,
                )

                result = await Runner.run(agent, task.prompt)
                output_str = str(result.final_output) if result.final_output else ""

                # Extract and log key findings
                if log_events:
                    findings = extract_key_findings(output_str)
                    log_subagent_result(task.name, success=True, key_findings=findings)

                return SubagentResult(
                    task_name=task.name,
                    success=True,
                    output=result.final_output
                )

            except Exception as e:
                if log_events:
                    log_error(task.name, str(e))
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

    async def explore_directory(
        self,
        dir_path: str,
        repository_path: str,
        model: str,
        api_key: str,
        tools: List = None
    ) -> SubagentResult:
        """
        Spawn a subagent to explore a single directory.

        Args:
            dir_path: Directory path relative to repository
            repository_path: Base repository path
            model: LLM model to use
            api_key: API key for LLM
            tools: Tools to provide to the agent

        Returns:
            SubagentResult with exploration findings
        """
        full_path = os.path.join(repository_path, dir_path) if dir_path != "." else repository_path

        prompt = f"""Explore and analyze the directory: {dir_path}

FULL PATH: {full_path}

Use the available tools to:
1. List all files in this directory using list_directory
2. Read the most important files (entry points, configs, main modules)
3. Understand what this directory/module is responsible for
4. Identify key classes, functions, and patterns
5. Note dependencies on other parts of the codebase

Provide a comprehensive analysis of:
- PURPOSE: What is this directory/module responsible for?
- KEY FILES: Which files are most important and why?
- KEY COMPONENTS: Classes, functions with their roles
- PATTERNS: Design patterns, conventions used
- DEPENDENCIES: What it imports/uses from elsewhere
- EXPORTS: What it provides to other modules
- DATA FLOW: How data enters and exits this module
- INSIGHTS: Notable observations, potential issues

Be thorough and specific. Reference actual file names and code elements you discover."""

        task = SubagentTask(
            name=f"explore_{dir_path.replace('/', '_').replace('.', 'root')}",
            prompt=prompt,
            model=model,
            api_key=api_key,
            tools=tools or [],
            temperature=0.3,
            max_tokens=4096
        )

        return await self.run_task(task)

    async def explore_directories(
        self,
        directories: List[str],
        repository_path: str,
        model: str,
        api_key: str,
        tools: List = None
    ) -> List[SubagentResult]:
        """
        Spawn subagents to explore directories in parallel.

        Args:
            directories: List of directory paths to explore
            repository_path: Base repository path
            model: LLM model to use
            api_key: API key for LLM
            tools: Tools to provide to agents

        Returns:
            List of exploration results
        """
        tasks = []
        for dir_path in directories:
            full_path = os.path.join(repository_path, dir_path) if dir_path != "." else repository_path

            prompt = f"""Explore and analyze the directory: {dir_path}

FULL PATH: {full_path}

Use the available tools to:
1. List all files in this directory
2. Read the most important files (entry points, configs, main modules)
3. Understand what this directory/module is responsible for
4. Identify key classes, functions, and patterns
5. Note dependencies on other parts of the codebase

Provide a comprehensive analysis of:
- PURPOSE: What is this directory/module responsible for?
- KEY FILES: Which files are most important and why?
- KEY COMPONENTS: Classes, functions with their roles
- PATTERNS: Design patterns, conventions used
- DEPENDENCIES: What it imports/uses from elsewhere
- EXPORTS: What it provides to other modules
- INSIGHTS: Notable observations, potential issues

Be thorough and specific. Reference actual file names and code elements you discover."""

            tasks.append(SubagentTask(
                name=f"explore_{dir_path.replace('/', '_').replace('.', 'root')}",
                prompt=prompt,
                model=model,
                api_key=api_key,
                tools=tools or [],
                temperature=0.3,
                max_tokens=4096
            ))

        # Log is handled by run_task now, so just show count
        console.print(f"    [dim]Launching {len(tasks)} parallel explorations...[/dim]")

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
                "area": result.task_name.replace("explore_", "").replace("_", "/"),
                "analysis": output
            })

            # Try to extract patterns mentioned
            pattern_keywords = ["pattern", "factory", "singleton", "observer", "mvc", "repository", "service"]
            for keyword in pattern_keywords:
                if keyword.lower() in output.lower():
                    reconciled["patterns"].add(keyword.title())

        else:
            reconciled["failed_explorations"].append({
                "area": result.task_name.replace("explore_", "").replace("_", "/"),
                "error": result.error
            })

    # Convert set to list for JSON serialization
    reconciled["patterns"] = list(reconciled["patterns"])

    # Log reconciliation findings
    successful = len(reconciled["insights"])
    failed = len(reconciled["failed_explorations"])
    patterns = reconciled["patterns"]

    if patterns:
        log_finding("Patterns detected", ", ".join(patterns))
    if failed > 0:
        log_error("Reconciliation", f"{failed} explorations failed")

    log_finding("Reconciled", f"{successful} explorations", f"patterns: {patterns if patterns else 'none'}")

    return reconciled


async def synthesize_explorations(
    reconciled: Dict[str, Any],
    repository_path: str,
    model: str,
    api_key: str
) -> str:
    """
    Use an LLM to synthesize exploration results into a coherent summary.

    Args:
        reconciled: Reconciled exploration data
        repository_path: Path to repository
        model: LLM model to use
        api_key: API key

    Returns:
        Synthesized summary string
    """
    # Truncate insights to fit context
    insights_summary = []
    for insight in reconciled["insights"][:15]:
        truncated = insight["analysis"][:2000] if len(insight["analysis"]) > 2000 else insight["analysis"]
        insights_summary.append({
            "area": insight["area"],
            "analysis": truncated
        })

    synthesis_prompt = f"""Based on the following explorations of different parts of this repository,
provide a comprehensive synthesis:

REPOSITORY: {os.path.basename(repository_path)}
PATH: {repository_path}

EXPLORATION RESULTS:
{json.dumps(insights_summary, indent=2)}

DETECTED PATTERNS:
{reconciled["patterns"]}

FAILED EXPLORATIONS:
{json.dumps(reconciled["failed_explorations"], indent=2)}

Synthesize this into:
1. A 2-3 sentence summary of what this repository does and its purpose
2. The primary programming languages used
3. Frameworks and libraries detected
4. Key entry points (main files, index files, CLI entry points)
5. Overall architecture pattern (monolith, microservices, layered, etc.)
6. The most important directories/modules and their responsibilities
7. How the different parts connect and interact
8. Notable observations about code quality or design

Be specific and reference actual file/directory names from the explorations.
Write in a clear, informative style suitable for documentation."""

    coordinator = SubagentCoordinator(max_concurrent=1)
    result = await coordinator.run_task(SubagentTask(
        name="synthesis",
        prompt=synthesis_prompt,
        model=model,
        api_key=api_key,
        temperature=0.3,
        max_tokens=4096
    ))

    if result.success:
        return str(result.output)
    else:
        return f"Synthesis failed: {result.error}"
