"""Module Analyzer Agent - Cross-file relationship and architecture analysis."""

import os
import json
from typing import List, Dict, Set
from agents import Agent, Runner, function_tool, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import AGENT_CONFIGS, API_KEYS, HANDOFF_DIR
from models import (
    ModuleAnalysisHandoff,
    ModuleInfo,
    DependencyEdge,
    FileAnalysisHandoff,
    DiscoveryHandoff,
)
from tools import grep_pattern, read_file, find_files


MODULE_ANALYZER_INSTRUCTIONS = """You are a Module Analyzer Agent specialized in understanding code architecture.

Your task is to analyze the relationships between files and modules:

1. **Module Identification**:
   - Group related files into logical modules
   - Identify package boundaries
   - Determine module purposes

2. **Dependency Analysis**:
   - Map import relationships between files
   - Identify circular dependencies
   - Classify dependency types (imports, extends, implements, uses)
   - Assess dependency strength (weak, normal, strong)

3. **Architecture Patterns**:
   - Identify design patterns (MVC, Repository, Factory, etc.)
   - Recognize architectural layers
   - Find abstraction boundaries

4. **Data Flow**:
   - Trace how data moves through the system
   - Identify data transformation points
   - Map API boundaries

5. **Public API Surface**:
   - Identify what each module exports
   - Document entry points
   - Catalog public interfaces

Use the provided file analyses to build a complete picture.
Be thorough in mapping ALL relationships.

Output a complete ModuleAnalysisHandoff."""


@function_tool
def tool_grep_pattern(pattern: str, path: str, file_pattern: str = None) -> str:
    """Search for a pattern in files."""
    return grep_pattern(pattern, path, file_pattern)


@function_tool
def tool_read_file(path: str, max_lines: int = None) -> str:
    """Read file contents."""
    return read_file(path, max_lines)


@function_tool
def tool_find_files(path: str, name_pattern: str = None, extension: str = None) -> str:
    """Find files matching criteria."""
    return find_files(path, name_pattern, extension)


def create_module_analyzer_agent() -> Agent:
    """Create the Module Analyzer Agent."""

    config = AGENT_CONFIGS["module_analyzer"]

    return Agent(
        name=config.name,
        instructions=MODULE_ANALYZER_INSTRUCTIONS,
        model=LitellmModel(
            model=config.model,
            api_key=API_KEYS["google"]
        ),
        model_settings=ModelSettings(
            temperature=config.temperature,
            max_tokens=8192,
        ),
        tools=[tool_grep_pattern, tool_read_file, tool_find_files],
        output_type=ModuleAnalysisHandoff,
    )


def identify_modules(
    file_analyses: List[FileAnalysisHandoff],
    repository_path: str
) -> List[ModuleInfo]:
    """
    Identify logical modules from file analyses.

    Args:
        file_analyses: List of file analysis handoffs
        repository_path: Base path of repository

    Returns:
        List of identified modules
    """
    # Group files by directory
    dir_files: Dict[str, List[FileAnalysisHandoff]] = {}

    for analysis in file_analyses:
        dir_path = os.path.dirname(analysis.path)
        if not dir_path:
            dir_path = "."
        if dir_path not in dir_files:
            dir_files[dir_path] = []
        dir_files[dir_path].append(analysis)

    modules = []

    for dir_path, files in dir_files.items():
        # Skip if only one file and it's in root
        if dir_path == "." and len(files) < 3:
            continue

        # Determine module name
        if dir_path == ".":
            module_name = "root"
        else:
            module_name = dir_path.replace('/', '.').replace('\\', '.')

        # Collect exports from all files in module
        public_api = []
        internal_components = []

        for f in files:
            for export in f.exports:
                if not export.startswith('_'):
                    public_api.append(f"{f.path}:{export}")
                else:
                    internal_components.append(f"{f.path}:{export}")

        # Determine module purpose
        purposes = [f.purpose for f in files if f.purpose and f.purpose != "Unknown"]
        if purposes:
            # Most common purpose
            from collections import Counter
            purpose = Counter(purposes).most_common(1)[0][0]
        else:
            purpose = f"Module containing {len(files)} files"

        modules.append(ModuleInfo(
            name=module_name,
            path=dir_path,
            files=[f.path for f in files],
            purpose=purpose,
            public_api=public_api[:20],  # Limit size
            internal_components=internal_components[:10]
        ))

    return modules


def build_dependency_graph(
    file_analyses: List[FileAnalysisHandoff]
) -> List[DependencyEdge]:
    """
    Build dependency graph from file analyses.

    Args:
        file_analyses: List of file analysis handoffs

    Returns:
        List of dependency edges
    """
    edges = []

    # Map file paths to their exports
    file_exports: Dict[str, Set[str]] = {}
    for analysis in file_analyses:
        file_exports[analysis.path] = set(analysis.exports)

    # For each file, analyze its imports
    for analysis in file_analyses:
        for imp in analysis.imports:
            # Try to resolve import to a local file
            if imp.is_relative or not imp.is_external:
                # This is a local import
                # Try to find the target file
                target_module = imp.module.replace('.', '/')

                for other_path in file_exports.keys():
                    # Check if this file could be the import target
                    other_base = os.path.splitext(other_path)[0]
                    if other_base.endswith(target_module) or target_module in other_base:
                        edges.append(DependencyEdge(
                            source=analysis.path,
                            target=other_path,
                            relationship_type="imports",
                            strength="normal"
                        ))
                        break

        # Check for class inheritance
        for cls in analysis.classes:
            for base in cls.base_classes:
                # Try to find where base class is defined
                for other in file_analyses:
                    if other.path != analysis.path:
                        for other_cls in other.classes:
                            if other_cls.name == base:
                                edges.append(DependencyEdge(
                                    source=analysis.path,
                                    target=other.path,
                                    relationship_type="extends",
                                    strength="strong"
                                ))

    return edges


def detect_architecture_patterns(
    modules: List[ModuleInfo],
    file_analyses: List[FileAnalysisHandoff]
) -> List[str]:
    """
    Detect common architecture patterns.

    Args:
        modules: List of modules
        file_analyses: List of file analyses

    Returns:
        List of detected patterns
    """
    patterns = []

    module_names = [m.name.lower() for m in modules]
    file_names = [os.path.basename(f.path).lower() for f in file_analyses]

    # Check for MVC
    has_models = any('model' in n for n in module_names + file_names)
    has_views = any('view' in n for n in module_names + file_names)
    has_controllers = any('controller' in n for n in module_names + file_names)
    if has_models and has_views and has_controllers:
        patterns.append("MVC (Model-View-Controller)")

    # Check for layered architecture
    has_api = any('api' in n or 'route' in n for n in module_names + file_names)
    has_service = any('service' in n for n in module_names + file_names)
    has_repo = any('repository' in n or 'repo' in n or 'dao' in n for n in module_names + file_names)
    if has_api and (has_service or has_repo):
        patterns.append("Layered Architecture")

    # Check for repository pattern
    if has_repo:
        patterns.append("Repository Pattern")

    # Check for factory pattern
    factory_files = [f for f in file_analyses
                     if any('factory' in fn.name.lower() for fn in f.functions + f.classes)]
    if factory_files:
        patterns.append("Factory Pattern")

    # Check for singleton pattern
    singleton_indicators = ['instance', 'get_instance', 'getInstance', '_instance']
    for f in file_analyses:
        if any(ind in str(f.functions) + str(f.classes) for ind in singleton_indicators):
            patterns.append("Singleton Pattern")
            break

    # Check for CLI structure
    if any('cli' in n or 'command' in n for n in module_names + file_names):
        patterns.append("CLI Application")

    # Check for web framework
    if any('route' in n or 'handler' in n or 'endpoint' in n for n in file_names):
        patterns.append("Web Application")

    return list(set(patterns))


async def run_module_analysis(
    discovery: DiscoveryHandoff,
    file_analyses: List[FileAnalysisHandoff]
) -> ModuleAnalysisHandoff:
    """
    Run module analysis using LLM for deep architectural understanding.

    This spawns subagents to analyze each module and the overall architecture,
    not just pattern matching.

    Args:
        discovery: Discovery handoff
        file_analyses: List of file analysis handoffs

    Returns:
        ModuleAnalysisHandoff with complete architecture analysis
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
    print("  Identifying modules...")
    modules = identify_modules(file_analyses, discovery.repository_path)

    print("  Building dependency graph...")
    dependency_graph = build_dependency_graph(file_analyses)

    print("  Detecting architecture patterns...")
    architecture_patterns = detect_architecture_patterns(modules, file_analyses)

    print(f"  Analyzing {len(modules)} modules with LLM...")

    # Spawn subagents to analyze each module's architecture
    module_tasks = []
    for module in modules[:12]:  # Limit for cost
        # Gather file analysis summaries for this module
        module_files_analysis = [
            {
                "path": f.path,
                "purpose": f.purpose,
                "classes": [c.name for c in f.classes],
                "functions": [fn.name for fn in f.functions],
                "insights": f.key_insights[:3] if f.key_insights else []
            }
            for f in file_analyses
            if f.path.startswith(module.path + "/") or (module.path == "." and "/" not in f.path)
        ]

        # Find relevant exploration insights
        relevant_exploration = [
            i for i in exploration_data.get("insights", [])
            if module.path.replace(".", "root") in i.get("area", "") or module.name in i.get("area", "")
        ]

        prompt = f"""Analyze the architecture of this module in detail:

MODULE: {module.name}
PATH: {module.path}
PURPOSE: {module.purpose}

FILES IN MODULE ({len(module_files_analysis)} files):
{json.dumps(module_files_analysis[:10], indent=2)}

EXPLORATION INSIGHTS (from discovery phase):
{json.dumps([{"area": i["area"], "analysis": i["analysis"][:1000]} for i in relevant_exploration[:3]], indent=2) if relevant_exploration else "None available"}

Analyze and provide:

1. MODULE RESPONSIBILITY: What is this module's core responsibility in the system?

2. PUBLIC API: What does this module expose to other modules?
   - Key classes/functions
   - Entry points
   - Configuration options

3. DEPENDENCIES: What does it depend on?
   - External libraries
   - Other internal modules
   - Why these dependencies exist

4. DESIGN PATTERNS: What patterns are used?
   - Creational patterns (Factory, Singleton, Builder)
   - Structural patterns (Adapter, Facade, Decorator)
   - Behavioral patterns (Observer, Strategy, Command)

5. DATA FLOW: How does data move through this module?
   - Input sources
   - Transformations
   - Output destinations

6. COUPLING ASSESSMENT: How tightly coupled is this module?
   - To which other modules?
   - Is this appropriate?

7. COHESION ASSESSMENT: How focused is this module?
   - Single responsibility?
   - Mixed concerns?

8. POTENTIAL ISSUES: Technical debt or concerns
   - Complexity
   - Missing abstractions
   - Suggested improvements

Be specific and reference actual files, classes, and functions."""

        module_tasks.append(SubagentTask(
            name=f"module_{module.name.replace('.', '_').replace('/', '_')}",
            prompt=prompt,
            model=config.model,
            api_key=API_KEYS["google"],
            temperature=0.4,
            max_tokens=4096
        ))

    module_results = await coordinator.run_parallel(module_tasks)

    # Spawn subagent to analyze overall architecture
    print("  Analyzing overall system architecture with LLM...")

    module_summaries = []
    for i, result in enumerate(module_results):
        if result.success and i < len(modules):
            module_summaries.append({
                "module": modules[i].name,
                "analysis": str(result.output)[:1500]
            })

    arch_prompt = f"""Analyze the overall architecture of this repository:

REPOSITORY: {os.path.basename(discovery.repository_path)}
LANGUAGES: {', '.join(discovery.detected_languages)}
FRAMEWORKS: {', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else 'None'}
TOTAL FILES: {discovery.total_files}

MODULES ({len(modules)} total):
{json.dumps([{"name": m.name, "files": len(m.files), "purpose": m.purpose} for m in modules], indent=2)}

DEPENDENCY GRAPH ({len(dependency_graph)} edges):
{json.dumps([{"from": e.source, "to": e.target, "type": e.relationship_type} for e in dependency_graph[:25]], indent=2)}

MODULE ANALYSIS RESULTS:
{json.dumps(module_summaries[:8], indent=2)}

Provide comprehensive architectural analysis:

1. ARCHITECTURE PATTERN: What is the overall architecture?
   - Monolith, microservices, modular monolith, layered, etc.
   - Justification for this classification

2. LAYER ANALYSIS: What are the architectural layers?
   - Presentation/UI layer
   - Business logic layer
   - Data access layer
   - Infrastructure layer

3. DATA FLOW: How does data flow through the system?
   - Entry points (CLI, API, events)
   - Processing pipeline
   - Output/persistence

4. KEY ABSTRACTIONS: What are the main interfaces/contracts?
   - Core abstractions
   - Extension points
   - Integration boundaries

5. COUPLING ANALYSIS: How coupled are the modules?
   - Tightly coupled pairs
   - Loosely coupled areas
   - Recommended changes

6. QUALITY ASSESSMENT:
   - Strengths of the architecture
   - Weaknesses or concerns
   - Technical debt indicators

7. RECOMMENDATIONS:
   - Suggested improvements
   - Refactoring opportunities
   - Missing patterns that would help

Be thorough, specific, and actionable."""

    arch_result = await coordinator.run_task(SubagentTask(
        name="architecture_analysis",
        prompt=arch_prompt,
        model=config.model,
        api_key=API_KEYS["google"],
        temperature=0.4,
        max_tokens=4096
    ))

    # Extract architectural insights from LLM results
    architectural_insights = []
    if arch_result.success:
        arch_text = str(arch_result.output)
        # Parse key points
        for line in arch_text.split('\n'):
            line = line.strip()
            if line and len(line) > 30 and (
                line.startswith('-') or line.startswith('*') or line.startswith('•') or
                (len(line) > 50 and ':' in line[:50])
            ):
                insight = line.lstrip('-*• ').strip()
                if insight and len(insight) > 20:
                    architectural_insights.append(insight[:300])

    # Ensure we have some insights
    if not architectural_insights:
        architectural_insights = [str(arch_result.output)[:500] if arch_result.success else "Architecture analysis pending"]

    # Build public APIs map
    public_apis: Dict[str, List[str]] = {}
    for module in modules:
        public_apis[module.name] = module.public_api

    # Data flow from analysis
    data_flow = []
    if discovery.entry_points:
        data_flow.append(f"Entry points: {', '.join(discovery.entry_points[:5])}")
    data_flow.append("See architectural insights for detailed data flow analysis")

    # Key relationships
    key_relationships = []
    for edge in dependency_graph[:30]:
        key_relationships.append(f"{edge.source} -> {edge.target} ({edge.relationship_type})")

    handoff = ModuleAnalysisHandoff(
        modules=modules,
        dependency_graph=dependency_graph,
        architecture_patterns=architecture_patterns,
        data_flow=data_flow,
        entry_points=discovery.entry_points,
        public_apis=public_apis,
        key_relationships=key_relationships,
        architectural_insights=architectural_insights[:20]
    )

    # Save handoff
    handoff_path = os.path.join(HANDOFF_DIR, "module_analysis_handoff.json")
    with open(handoff_path, 'w') as f:
        f.write(handoff.model_dump_json(indent=2))

    # Save detailed module analysis for doc synthesis
    detailed_path = os.path.join(HANDOFF_DIR, "module_analysis_detailed.json")
    with open(detailed_path, 'w') as f:
        json.dump({
            "modules": [
                {"name": modules[i].name if i < len(modules) else r.task_name, "analysis": str(r.output)}
                for i, r in enumerate(module_results) if r.success
            ],
            "architecture": str(arch_result.output) if arch_result.success else None
        }, f, indent=2)

    successful = len([r for r in module_results if r.success])
    print(f"  Module analysis complete. {successful}/{len(module_results)} modules analyzed with LLM.")
    return handoff
