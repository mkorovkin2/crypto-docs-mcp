"""File Analyzer Agent - Deep analysis of individual files."""

import os
import json
import asyncio
from typing import List, Optional
from agents import Agent, Runner, function_tool, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import AGENT_CONFIGS, API_KEYS, HANDOFF_DIR
from models import (
    FileAnalysisHandoff,
    FunctionInfo,
    ClassInfo,
    ImportInfo,
    DiscoveryHandoff,
    FileClassification,
    FileType,
)
from tools import read_file, grep_pattern
from doc_agents.event_logger import (
    log_info,
    log_finding,
    log_batch_progress,
    log_phase_complete,
)


FILE_ANALYZER_INSTRUCTIONS = """You are a File Analyzer Agent specialized in deep code analysis.

For each file you analyze, you must:
1. Read the entire file content
2. Identify ALL imports/dependencies
3. Extract ALL classes with their methods, attributes, and docstrings
4. Extract ALL functions with their parameters, return types, and docstrings
5. Identify exported symbols (what this file provides to others)
6. Determine the file's primary purpose
7. Assess complexity (1-10 scale)
8. Generate key insights about the code

Be extremely thorough. Every class, every function, every import matters.
If the file is large, break your analysis into sections.

For each function/method, note:
- What other functions it calls
- Its complexity level
- Any side effects

For each class, note:
- Inheritance hierarchy
- Key design patterns used
- How it relates to other classes

Output structured FileAnalysisHandoff data."""


@function_tool
def tool_read_file(path: str, max_lines: int = None) -> str:
    """
    Read the contents of a file.

    Args:
        path: Path to the file to read
        max_lines: Optional maximum number of lines to read

    Returns:
        File contents as string
    """
    return read_file(path, max_lines)


@function_tool
def tool_grep_pattern(pattern: str, path: str, file_pattern: str = None) -> str:
    """
    Search for a pattern in files.

    Args:
        pattern: Regex pattern to search
        path: Directory or file to search
        file_pattern: Optional glob pattern for files

    Returns:
        JSON with search results
    """
    return grep_pattern(pattern, path, file_pattern)


def create_file_analyzer_agent() -> Agent:
    """Create the File Analyzer Agent."""

    config = AGENT_CONFIGS["file_analyzer"]

    return Agent(
        name=config.name,
        instructions=FILE_ANALYZER_INSTRUCTIONS,
        model=LitellmModel(
            model=config.model,
            api_key=API_KEYS["google"]
        ),
        model_settings=ModelSettings(
            temperature=config.temperature,
            max_tokens=8192,  # Larger for detailed analysis
        ),
        tools=[tool_read_file, tool_grep_pattern],
        output_type=FileAnalysisHandoff,
    )


def analyze_file_locally(file_path: str, content: str, language: str) -> FileAnalysisHandoff:
    """
    Perform local static analysis of a file.

    This provides a baseline analysis without LLM calls.

    Args:
        file_path: Path to the file
        content: File content
        language: Programming language

    Returns:
        FileAnalysisHandoff with basic analysis
    """
    import re

    imports = []
    classes = []
    functions = []
    exports = []
    constants = []

    lines = content.split('\n')

    if language == 'python':
        # Extract Python imports
        for i, line in enumerate(lines):
            # import x
            match = re.match(r'^import\s+(\S+)', line)
            if match:
                imports.append(ImportInfo(
                    module=match.group(1),
                    names=[],
                    is_relative=False,
                    is_external='.' not in match.group(1)
                ))

            # from x import y
            match = re.match(r'^from\s+(\S+)\s+import\s+(.+)', line)
            if match:
                module = match.group(1)
                names = [n.strip() for n in match.group(2).split(',')]
                imports.append(ImportInfo(
                    module=module,
                    names=names,
                    is_relative=module.startswith('.'),
                    is_external=not module.startswith('.')
                ))

        # Extract Python classes
        class_pattern = re.compile(r'^class\s+(\w+)\s*(?:\(([^)]*)\))?\s*:', re.MULTILINE)
        for match in class_pattern.finditer(content):
            class_name = match.group(1)
            bases = [b.strip() for b in (match.group(2) or '').split(',') if b.strip()]
            line_num = content[:match.start()].count('\n') + 1

            classes.append(ClassInfo(
                name=class_name,
                line_number=line_num,
                base_classes=bases,
                description=f"Class {class_name}",
                methods=[],
                attributes=[]
            ))
            exports.append(class_name)

        # Extract Python functions
        func_pattern = re.compile(r'^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\S+))?\s*:', re.MULTILINE)
        for match in func_pattern.finditer(content):
            func_name = match.group(1)
            params = [p.strip().split(':')[0].strip() for p in (match.group(2) or '').split(',') if p.strip()]
            return_type = match.group(3)
            line_num = content[:match.start()].count('\n') + 1

            # Check if it's a method (indented) or standalone function
            line_start = content.rfind('\n', 0, match.start()) + 1
            indent = match.start() - line_start

            if indent == 0:  # Top-level function
                functions.append(FunctionInfo(
                    name=func_name,
                    line_number=line_num,
                    parameters=params,
                    return_type=return_type,
                    description=f"Function {func_name}",
                    complexity="low"
                ))
                if not func_name.startswith('_'):
                    exports.append(func_name)

        # Extract constants (ALL_CAPS variables)
        const_pattern = re.compile(r'^([A-Z][A-Z0-9_]+)\s*=', re.MULTILINE)
        for match in const_pattern.finditer(content):
            constants.append(match.group(1))

    elif language in ['javascript', 'typescript']:
        # Extract JS/TS imports
        import_pattern = re.compile(r"import\s+(?:{([^}]+)}|(\w+))\s+from\s+['\"]([^'\"]+)['\"]")
        for match in import_pattern.finditer(content):
            names = []
            if match.group(1):
                names = [n.strip() for n in match.group(1).split(',')]
            elif match.group(2):
                names = [match.group(2)]

            imports.append(ImportInfo(
                module=match.group(3),
                names=names,
                is_relative=match.group(3).startswith('.'),
                is_external=not match.group(3).startswith('.')
            ))

        # Extract classes
        class_pattern = re.compile(r'class\s+(\w+)\s*(?:extends\s+(\w+))?\s*{')
        for match in class_pattern.finditer(content):
            line_num = content[:match.start()].count('\n') + 1
            classes.append(ClassInfo(
                name=match.group(1),
                line_number=line_num,
                base_classes=[match.group(2)] if match.group(2) else [],
                description=f"Class {match.group(1)}",
                methods=[],
                attributes=[]
            ))

        # Extract functions
        func_patterns = [
            re.compile(r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)'),
            re.compile(r'(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>'),
        ]
        for pattern in func_patterns:
            for match in pattern.finditer(content):
                func_name = match.group(1)
                line_num = content[:match.start()].count('\n') + 1
                functions.append(FunctionInfo(
                    name=func_name,
                    line_number=line_num,
                    parameters=[],
                    description=f"Function {func_name}",
                    complexity="low"
                ))

        # Extract exports
        export_pattern = re.compile(r'export\s+(?:default\s+)?(?:const|let|var|function|class|async function)\s+(\w+)')
        for match in export_pattern.finditer(content):
            exports.append(match.group(1))

    # Calculate complexity score based on various factors
    complexity_score = 5
    if len(classes) > 5:
        complexity_score += 1
    if len(functions) > 10:
        complexity_score += 1
    if len(imports) > 15:
        complexity_score += 1
    if len(lines) > 500:
        complexity_score += 1
    if len(lines) < 50:
        complexity_score -= 1
    complexity_score = max(1, min(10, complexity_score))

    # Determine purpose
    purpose = "Unknown"
    file_name = os.path.basename(file_path).lower()
    if 'test' in file_name:
        purpose = "Test file"
    elif 'config' in file_name or 'settings' in file_name:
        purpose = "Configuration"
    elif 'model' in file_name:
        purpose = "Data models"
    elif 'util' in file_name or 'helper' in file_name:
        purpose = "Utility functions"
    elif 'main' in file_name or 'app' in file_name or 'index' in file_name:
        purpose = "Application entry point"
    elif 'api' in file_name or 'route' in file_name:
        purpose = "API endpoints"
    elif classes:
        purpose = f"Defines {len(classes)} class(es)"
    elif functions:
        purpose = f"Defines {len(functions)} function(s)"

    return FileAnalysisHandoff(
        path=file_path,
        language=language or "unknown",
        purpose=purpose,
        imports=imports,
        exports=exports,
        classes=classes,
        functions=functions,
        constants=constants,
        key_insights=[],
        dependencies=[imp.module for imp in imports if imp.is_external],
        complexity_score=complexity_score,
        raw_summary=f"File with {len(classes)} classes and {len(functions)} functions"
    )


async def analyze_single_file_with_llm(
    file_path: str,
    content: str,
    language: str,
    agent: Agent
) -> FileAnalysisHandoff:
    """
    Analyze a single file using LLM for deep insights.

    Args:
        file_path: Full path to the file
        content: File content
        language: Programming language
        agent: Pre-created agent

    Returns:
        FileAnalysisHandoff with complete analysis
    """
    # First do local analysis
    local_analysis = analyze_file_locally(file_path, content, language)

    # Prepare prompt for LLM enhancement
    prompt = f"""Analyze this {language} file and provide insights:

FILE: {file_path}

CONTENT:
```{language}
{content[:8000]}  # Truncate for context limits
```

LOCAL ANALYSIS FOUND:
- Classes: {[c.name for c in local_analysis.classes]}
- Functions: {[f.name for f in local_analysis.functions]}
- Imports: {[i.module for i in local_analysis.imports]}

Please provide:
1. A clear description of the file's purpose (1-2 sentences)
2. Key insights about the code (design patterns, notable features, potential issues)
3. Any additional classes, functions, or exports I may have missed
4. Complexity assessment (1-10)

Return a FileAnalysisHandoff with your enhanced analysis."""

    try:
        result = await Runner.run(agent, prompt)
        return result.final_output
    except Exception as e:
        # Fall back to local analysis
        local_analysis.key_insights = [f"LLM analysis failed: {str(e)}"]
        return local_analysis


async def analyze_files_batch(
    files: List[FileClassification],
    repository_path: str,
    batch_size: int = 5,
    progress_callback=None
) -> List[FileAnalysisHandoff]:
    """
    Analyze multiple files in batches.

    Args:
        files: List of file classifications to analyze
        repository_path: Base path of repository
        batch_size: Number of files to analyze in parallel
        progress_callback: Optional callback for progress updates

    Returns:
        List of FileAnalysisHandoff for each file
    """
    results = []

    # Filter to only source code and config files
    analyzable = [
        f for f in files
        if f.file_type in {FileType.SOURCE_CODE, FileType.CONFIG}
        and f.language is not None
    ]

    total = len(analyzable)
    print(f"  Analyzing {total} source files...")

    for i, file_cls in enumerate(analyzable):
        file_path = os.path.join(repository_path, file_cls.path)

        # Read file content
        content = read_file(file_path)
        if content.startswith("Error:"):
            results.append(FileAnalysisHandoff(
                path=file_cls.path,
                language=file_cls.language or "unknown",
                purpose=f"Could not read: {content}",
                imports=[],
                exports=[],
                classes=[],
                functions=[],
                constants=[],
                key_insights=[content],
                dependencies=[],
                complexity_score=1,
                raw_summary="File read error"
            ))
            continue

        # Perform local analysis (no LLM for speed)
        analysis = analyze_file_locally(file_cls.path, content, file_cls.language)
        results.append(analysis)

        if progress_callback and (i + 1) % 10 == 0:
            progress_callback(i + 1, total)

    return results


async def run_file_analysis(discovery: DiscoveryHandoff) -> List[FileAnalysisHandoff]:
    """
    Run file analysis using LLM for ALL source files.

    This spawns parallel subagents to analyze each file with actual
    LLM reasoning, not just regex parsing.

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

    log_info(f"Analyzing {len(analyzable_files)} source files with LLM...")

    # Create analysis tasks for each file
    tasks = []
    file_contents = {}  # Cache file contents

    for file_cls in analyzable_files:
        file_path = os.path.join(discovery.repository_path, file_cls.path)
        content = read_file(file_path)

        if content.startswith("Error:"):
            continue

        file_contents[file_cls.path] = content

        # Truncate large files
        if len(content) > 12000:
            content = content[:12000] + "\n\n... [truncated - file continues]"

        prompt = f"""Analyze this {file_cls.language} file in detail:

FILE: {file_cls.path}
LANGUAGE: {file_cls.language}

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

4. FUNCTIONS: For each standalone function:
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
            temperature=0.3,
            max_tokens=4096
        ))

    # Run analysis in parallel batches
    results = []
    batch_size = 15

    for i in range(0, len(tasks), batch_size):
        batch = tasks[i:i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(tasks) + batch_size - 1) // batch_size
        # Log batch with first file as sample
        first_file = analyzable_files[i].path if i < len(analyzable_files) else ""
        log_batch_progress("File Analysis", batch_num, total_batches, first_file)

        batch_results = await coordinator.run_parallel(batch)

        for j, result in enumerate(batch_results):
            file_idx = i + j
            if file_idx >= len(analyzable_files):
                break

            file_cls = analyzable_files[file_idx]

            if result.success and result.output:
                # Parse LLM output into structured format
                analysis = parse_llm_analysis(
                    str(result.output),
                    file_cls.path,
                    file_cls.language,
                    file_contents.get(file_cls.path, "")
                )
                results.append(analysis)
            else:
                # Fall back to local analysis on failure
                content = file_contents.get(file_cls.path, "")
                if content:
                    fallback = analyze_file_locally(file_cls.path, content, file_cls.language)
                    fallback.key_insights.append(f"LLM analysis failed: {result.error}")
                    results.append(fallback)

    # Save results
    os.makedirs(HANDOFF_DIR, exist_ok=True)
    combined_path = os.path.join(HANDOFF_DIR, "file_analysis_combined.json")
    with open(combined_path, 'w') as f:
        json.dump([a.model_dump() for a in results], f, indent=2)

    successful = len([r for r in results if r.key_insights and "failed" not in str(r.key_insights)])

    # Log completion with stats
    total_classes = sum(len(r.classes) for r in results)
    total_functions = sum(len(r.functions) for r in results)
    log_finding("Analysis summary", f"{total_classes} classes, {total_functions} functions found")
    log_phase_complete("File Analysis", {
        "analyzed": f"{successful}/{len(results)}",
        "classes": total_classes,
        "functions": total_functions
    })

    return results


def parse_llm_analysis(llm_output: str, path: str, language: str, content: str) -> FileAnalysisHandoff:
    """
    Parse LLM text response into FileAnalysisHandoff.

    Combines LLM insights with local parsing for structured data.
    """
    import re

    # Do local analysis for structured data
    local = analyze_file_locally(path, content, language)

    # Extract purpose from LLM output
    purpose_match = re.search(r'PURPOSE:?\s*(.+?)(?:\n\n|\n\d\.|\n[A-Z])', llm_output, re.DOTALL | re.IGNORECASE)
    if purpose_match:
        purpose = purpose_match.group(1).strip()
        # Clean up the purpose
        purpose = re.sub(r'^[\s\-\*]+', '', purpose)
        purpose = purpose.split('\n')[0][:200]
    else:
        purpose = local.purpose

    # Extract complexity from LLM output
    complexity_match = re.search(r'COMPLEXITY:?\s*(\d+)', llm_output, re.IGNORECASE)
    if complexity_match:
        try:
            complexity = int(complexity_match.group(1))
            complexity = max(1, min(10, complexity))
        except:
            complexity = local.complexity_score
    else:
        complexity = local.complexity_score

    # Extract key insights from LLM output
    insights = []
    insights_match = re.search(r'KEY INSIGHTS:?\s*(.+?)(?:\n\n\d\.|\Z)', llm_output, re.DOTALL | re.IGNORECASE)
    if insights_match:
        insights_text = insights_match.group(1)
        # Parse bullet points
        for line in insights_text.split('\n'):
            line = line.strip()
            if line and (line.startswith('-') or line.startswith('*') or line.startswith('•')):
                insight = line.lstrip('-*• ').strip()
                if insight and len(insight) > 10:
                    insights.append(insight[:200])

    # Use local analysis for structured data, LLM for insights
    return FileAnalysisHandoff(
        path=path,
        language=language,
        purpose=purpose,
        imports=local.imports,
        exports=local.exports,
        classes=local.classes,
        functions=local.functions,
        constants=local.constants,
        key_insights=insights if insights else [llm_output[:500]],
        dependencies=local.dependencies,
        complexity_score=complexity,
        raw_summary=llm_output[:2000]
    )
