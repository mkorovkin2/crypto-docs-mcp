# Repository Documentation Agent - Implementation Plan

## Overview

Build a multi-agent system using the OpenAI Agents SDK that deeply analyzes GitHub repositories and generates comprehensive documentation. The system uses a hierarchical orchestrator-subagent architecture with multiple LLM providers for specialized tasks.

## Current State Analysis

- **Working Directory**: `/Users/mkorovkin/Desktop/crypto-docs-mcp/docs-agent-v3/`
- **Existing Files**: Only `.env` with API keys for Anthropic, Google, and xAI
- **Dependencies**: None installed yet

### Key Discoveries:
- OpenAI Agents SDK supports LiteLLM for 100+ providers via `pip install "openai-agents[litellm]"`
- Agents can be used as tools (`agent.as_tool()`) for orchestrator patterns
- Handoffs enable hierarchical agent workflows
- Non-OpenAI providers require `set_default_openai_api("chat_completions")`

## Desired End State

A fully functional multi-agent system that:
1. Takes a GitHub repository path as input
2. Exhaustively analyzes every file with deep LLM reasoning
3. Generates comprehensive markdown documentation
4. Produces code examples for common integrations
5. Outputs organized documentation in `./output/` directory

### Verification:
- Run `python main.py /path/to/repo` successfully
- Documentation generated in `./output/` with all modules documented
- Code examples compile/run correctly

## What We're NOT Doing

- Incremental documentation updates (full regeneration only)
- Web-based UI or API server
- Git history analysis (only current state)
- Automated testing of generated examples
- Support for private repositories requiring auth (can be added later)

## Implementation Approach

**Architecture Pattern**: Orchestrator with Agents-as-Tools

The orchestrator agent coordinates specialized sub-agents, each running on the optimal LLM for their task:
- **Grok 4 Fast**: Discovery, classification, extraction (speed-optimized)
- **Gemini Flash**: Per-file analysis, basic documentation (balanced)
- **Gemini Pro**: Complex reasoning, architecture analysis (depth-optimized)
- **Claude Haiku 4.5**: Code generation, examples (code-optimized)

**Data Flow**: Each phase produces handoff documents (JSON) consumed by the next phase.

---

## Phase 1: Project Setup & Core Infrastructure

### Overview
Set up project structure, install dependencies, configure multi-provider LLM access, and implement core tools.

### Changes Required:

#### 1. Project Structure
Create the following directory structure:

```
docs-agent-v3/
├── .env                          # API keys (exists)
├── main.py                       # Entry point
├── config.py                     # Configuration and model definitions
├── requirements.txt              # Dependencies
├── agents/
│   ├── __init__.py
│   ├── orchestrator.py           # Main orchestrator agent
│   ├── discovery.py              # Discovery agent
│   ├── file_analyzer.py          # File analysis agent
│   ├── module_analyzer.py        # Module/relationship analysis
│   ├── doc_synthesizer.py        # Documentation synthesis
│   └── example_generator.py      # Code example generation
├── tools/
│   ├── __init__.py
│   ├── file_tools.py             # File reading, listing
│   ├── search_tools.py           # Grep, pattern matching
│   └── bash_tools.py             # Shell command execution
├── models/
│   ├── __init__.py
│   └── handoff.py                # Pydantic models for handoff docs
└── output/                       # Generated documentation
```

#### 2. Requirements File
**File**: `requirements.txt`

```
openai-agents[litellm]>=0.1.0
litellm>=1.55.0
pydantic>=2.0.0
python-dotenv>=1.0.0
rich>=13.0.0
aiofiles>=24.1.0
```

#### 3. Configuration Module
**File**: `config.py`

```python
"""Configuration for multi-provider LLM access and agent settings."""

import os
from dataclasses import dataclass
from typing import Literal
from dotenv import load_dotenv

load_dotenv()

# Model identifiers for each provider
MODELS = {
    "grok_fast": "xai/grok-3-fast-beta",           # Fast extraction/classification
    "gemini_flash": "gemini/gemini-2.0-flash-exp", # Standard tasks
    "gemini_pro": "gemini/gemini-1.5-pro",         # Complex reasoning
    "claude_haiku": "anthropic/claude-3-5-haiku-20241022",  # Code generation
    "claude_sonnet": "anthropic/claude-sonnet-4-5-20250929", # Fallback for complex
}

# API Keys
API_KEYS = {
    "anthropic": os.getenv("ANTHROPIC_API_KEY"),
    "google": os.getenv("GOOGLE_API_KEY"),
    "xai": os.getenv("XAI_API_KEY"),
}

@dataclass
class AgentConfig:
    """Configuration for an agent."""
    name: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 4096

# Agent configurations
AGENT_CONFIGS = {
    "orchestrator": AgentConfig(
        name="Orchestrator",
        model=MODELS["gemini_pro"],
        temperature=0.5,
    ),
    "discovery": AgentConfig(
        name="DiscoveryAgent",
        model=MODELS["grok_fast"],
        temperature=0.3,
    ),
    "file_analyzer": AgentConfig(
        name="FileAnalyzer",
        model=MODELS["gemini_flash"],
        temperature=0.5,
    ),
    "module_analyzer": AgentConfig(
        name="ModuleAnalyzer",
        model=MODELS["gemini_pro"],
        temperature=0.7,
    ),
    "doc_synthesizer": AgentConfig(
        name="DocSynthesizer",
        model=MODELS["gemini_pro"],
        temperature=0.6,
    ),
    "example_generator": AgentConfig(
        name="ExampleGenerator",
        model=MODELS["claude_haiku"],
        temperature=0.4,
    ),
}

# Output settings
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./output")
HANDOFF_DIR = os.path.join(OUTPUT_DIR, ".handoffs")

# Analysis settings
MAX_FILE_SIZE_KB = 500  # Skip files larger than this
SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go", ".rs",
    ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".hpp", ".swift",
    ".kt", ".scala", ".md", ".json", ".yaml", ".yml", ".toml",
    ".sql", ".sh", ".bash", ".zsh", ".dockerfile", ".tf",
}
SKIP_DIRECTORIES = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".nuxt", "coverage", ".pytest_cache",
    ".mypy_cache", ".tox", "eggs", "*.egg-info",
}
```

#### 4. Handoff Document Models
**File**: `models/handoff.py`

```python
"""Pydantic models for handoff documents between agents."""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum


class FileType(str, Enum):
    SOURCE_CODE = "source_code"
    CONFIG = "config"
    DOCUMENTATION = "documentation"
    TEST = "test"
    BUILD = "build"
    DATA = "data"
    OTHER = "other"


class FileClassification(BaseModel):
    """Classification of a single file."""
    path: str
    file_type: FileType
    language: Optional[str] = None
    importance: int = Field(ge=1, le=10, description="1=low, 10=critical")
    description: str = ""


class DiscoveryHandoff(BaseModel):
    """Handoff document from Discovery Agent."""
    repository_path: str
    total_files: int
    files: List[FileClassification]
    directory_structure: Dict[str, Any]
    detected_languages: List[str]
    detected_frameworks: List[str]
    entry_points: List[str]
    summary: str


class FunctionInfo(BaseModel):
    """Information about a function/method."""
    name: str
    line_number: int
    parameters: List[str]
    return_type: Optional[str] = None
    docstring: Optional[str] = None
    description: str
    complexity: str = "low"  # low, medium, high
    calls: List[str] = Field(default_factory=list)


class ClassInfo(BaseModel):
    """Information about a class."""
    name: str
    line_number: int
    base_classes: List[str] = Field(default_factory=list)
    docstring: Optional[str] = None
    description: str
    methods: List[FunctionInfo] = Field(default_factory=list)
    attributes: List[str] = Field(default_factory=list)


class ImportInfo(BaseModel):
    """Information about an import."""
    module: str
    names: List[str] = Field(default_factory=list)
    is_relative: bool = False
    is_external: bool = False


class FileAnalysisHandoff(BaseModel):
    """Handoff document from File Analyzer Agent for a single file."""
    path: str
    language: str
    purpose: str
    imports: List[ImportInfo]
    exports: List[str]
    classes: List[ClassInfo]
    functions: List[FunctionInfo]
    constants: List[str]
    key_insights: List[str]
    dependencies: List[str]
    complexity_score: int = Field(ge=1, le=10)
    raw_summary: str


class ModuleInfo(BaseModel):
    """Information about a module/package."""
    name: str
    path: str
    files: List[str]
    purpose: str
    public_api: List[str]
    internal_components: List[str]


class DependencyEdge(BaseModel):
    """A dependency relationship between two files/modules."""
    source: str
    target: str
    relationship_type: str  # imports, extends, implements, uses, etc.
    strength: str = "normal"  # weak, normal, strong


class ModuleAnalysisHandoff(BaseModel):
    """Handoff document from Module Analyzer Agent."""
    modules: List[ModuleInfo]
    dependency_graph: List[DependencyEdge]
    architecture_patterns: List[str]
    data_flow: List[str]
    entry_points: List[str]
    public_apis: Dict[str, List[str]]
    key_relationships: List[str]
    architectural_insights: List[str]


class DocumentationSection(BaseModel):
    """A section of documentation."""
    title: str
    content: str
    subsections: List["DocumentationSection"] = Field(default_factory=list)


class CodeExample(BaseModel):
    """A code example."""
    title: str
    description: str
    code: str
    language: str
    file_references: List[str] = Field(default_factory=list)
    prerequisites: List[str] = Field(default_factory=list)


class FinalDocumentation(BaseModel):
    """Final synthesized documentation."""
    repository_name: str
    overview: str
    architecture: DocumentationSection
    modules: List[DocumentationSection]
    api_reference: DocumentationSection
    examples: List[CodeExample]
    getting_started: DocumentationSection
    configuration: Optional[DocumentationSection] = None
```

#### 5. Core Tools - File Operations
**File**: `tools/file_tools.py`

```python
"""File operation tools for agents."""

import os
import aiofiles
from typing import List, Optional
from agents import function_tool
from config import SUPPORTED_EXTENSIONS, SKIP_DIRECTORIES, MAX_FILE_SIZE_KB


@function_tool
async def list_directory(path: str, recursive: bool = False) -> str:
    """
    List files and directories at the given path.

    Args:
        path: Directory path to list
        recursive: If True, list all files recursively

    Returns:
        JSON string with file listing
    """
    import json

    if not os.path.exists(path):
        return json.dumps({"error": f"Path does not exist: {path}"})

    if not os.path.isdir(path):
        return json.dumps({"error": f"Path is not a directory: {path}"})

    results = []

    if recursive:
        for root, dirs, files in os.walk(path):
            # Skip unwanted directories
            dirs[:] = [d for d in dirs if d not in SKIP_DIRECTORIES and not d.startswith('.')]

            rel_root = os.path.relpath(root, path)
            if rel_root == '.':
                rel_root = ''

            for file in files:
                file_path = os.path.join(rel_root, file) if rel_root else file
                full_path = os.path.join(root, file)

                try:
                    size_kb = os.path.getsize(full_path) / 1024
                    ext = os.path.splitext(file)[1].lower()
                    results.append({
                        "path": file_path,
                        "size_kb": round(size_kb, 2),
                        "extension": ext,
                        "supported": ext in SUPPORTED_EXTENSIONS
                    })
                except OSError:
                    continue
    else:
        for item in os.listdir(path):
            full_path = os.path.join(path, item)
            is_dir = os.path.isdir(full_path)

            if is_dir and item in SKIP_DIRECTORIES:
                continue

            results.append({
                "name": item,
                "is_directory": is_dir,
                "size_kb": round(os.path.getsize(full_path) / 1024, 2) if not is_dir else None
            })

    return json.dumps({"path": path, "items": results, "count": len(results)})


@function_tool
async def read_file(path: str, max_lines: Optional[int] = None) -> str:
    """
    Read the contents of a file.

    Args:
        path: Path to the file to read
        max_lines: Optional maximum number of lines to read

    Returns:
        File contents as string, or error message
    """
    if not os.path.exists(path):
        return f"Error: File does not exist: {path}"

    if not os.path.isfile(path):
        return f"Error: Path is not a file: {path}"

    size_kb = os.path.getsize(path) / 1024
    if size_kb > MAX_FILE_SIZE_KB:
        return f"Error: File too large ({size_kb:.1f}KB > {MAX_FILE_SIZE_KB}KB limit): {path}"

    try:
        async with aiofiles.open(path, 'r', encoding='utf-8', errors='replace') as f:
            if max_lines:
                lines = []
                async for i, line in enumerate(f):
                    if i >= max_lines:
                        break
                    lines.append(line)
                content = ''.join(lines)
            else:
                content = await f.read()

        return content
    except Exception as e:
        return f"Error reading file {path}: {str(e)}"


@function_tool
async def get_file_info(path: str) -> str:
    """
    Get metadata about a file without reading its contents.

    Args:
        path: Path to the file

    Returns:
        JSON string with file metadata
    """
    import json

    if not os.path.exists(path):
        return json.dumps({"error": f"Path does not exist: {path}"})

    stat = os.stat(path)
    ext = os.path.splitext(path)[1].lower()

    return json.dumps({
        "path": path,
        "name": os.path.basename(path),
        "extension": ext,
        "size_bytes": stat.st_size,
        "size_kb": round(stat.st_size / 1024, 2),
        "is_supported": ext in SUPPORTED_EXTENSIONS,
        "is_too_large": stat.st_size / 1024 > MAX_FILE_SIZE_KB
    })


@function_tool
async def read_multiple_files(paths: List[str]) -> str:
    """
    Read multiple files and return their contents.

    Args:
        paths: List of file paths to read

    Returns:
        JSON string with file contents keyed by path
    """
    import json

    results = {}
    for path in paths:
        content = await read_file.func(path)
        results[path] = content

    return json.dumps(results)
```

#### 6. Core Tools - Search Operations
**File**: `tools/search_tools.py`

```python
"""Search tools for pattern matching in files."""

import os
import re
import subprocess
from typing import Optional, List
from agents import function_tool


@function_tool
async def grep_pattern(
    pattern: str,
    path: str,
    file_pattern: Optional[str] = None,
    case_insensitive: bool = False,
    max_results: int = 100
) -> str:
    """
    Search for a pattern in files using grep-like functionality.

    Args:
        pattern: Regex pattern to search for
        path: Directory or file to search in
        file_pattern: Optional glob pattern to filter files (e.g., "*.py")
        case_insensitive: Whether to ignore case
        max_results: Maximum number of results to return

    Returns:
        JSON string with search results
    """
    import json

    if not os.path.exists(path):
        return json.dumps({"error": f"Path does not exist: {path}"})

    results = []
    flags = re.IGNORECASE if case_insensitive else 0

    try:
        compiled_pattern = re.compile(pattern, flags)
    except re.error as e:
        return json.dumps({"error": f"Invalid regex pattern: {e}"})

    def search_file(file_path: str):
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                for line_num, line in enumerate(f, 1):
                    if compiled_pattern.search(line):
                        results.append({
                            "file": file_path,
                            "line": line_num,
                            "content": line.strip()[:200]  # Truncate long lines
                        })
                        if len(results) >= max_results:
                            return True
        except Exception:
            pass
        return False

    if os.path.isfile(path):
        search_file(path)
    else:
        import fnmatch
        for root, dirs, files in os.walk(path):
            # Skip unwanted directories
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in {
                'node_modules', '__pycache__', '.git', 'venv', '.venv'
            }]

            for file in files:
                if file_pattern and not fnmatch.fnmatch(file, file_pattern):
                    continue

                file_path = os.path.join(root, file)
                if search_file(file_path):
                    break

            if len(results) >= max_results:
                break

    return json.dumps({
        "pattern": pattern,
        "path": path,
        "results": results,
        "count": len(results),
        "truncated": len(results) >= max_results
    })


@function_tool
async def find_files(
    path: str,
    name_pattern: Optional[str] = None,
    extension: Optional[str] = None,
    contains_text: Optional[str] = None,
    max_results: int = 100
) -> str:
    """
    Find files matching criteria.

    Args:
        path: Directory to search in
        name_pattern: Glob pattern for file names (e.g., "test_*")
        extension: File extension to filter by (e.g., ".py")
        contains_text: Only include files containing this text
        max_results: Maximum number of results

    Returns:
        JSON string with matching files
    """
    import json
    import fnmatch

    if not os.path.exists(path):
        return json.dumps({"error": f"Path does not exist: {path}"})

    results = []

    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in {
            'node_modules', '__pycache__', '.git', 'venv', '.venv'
        }]

        for file in files:
            if name_pattern and not fnmatch.fnmatch(file, name_pattern):
                continue

            if extension and not file.endswith(extension):
                continue

            file_path = os.path.join(root, file)

            if contains_text:
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                        content = f.read()
                        if contains_text not in content:
                            continue
                except Exception:
                    continue

            results.append(os.path.relpath(file_path, path))

            if len(results) >= max_results:
                break

        if len(results) >= max_results:
            break

    return json.dumps({
        "path": path,
        "files": results,
        "count": len(results)
    })


@function_tool
async def get_file_structure(path: str, max_depth: int = 4) -> str:
    """
    Get a tree-like structure of the directory.

    Args:
        path: Root directory
        max_depth: Maximum depth to traverse

    Returns:
        String representation of directory tree
    """
    if not os.path.exists(path):
        return f"Error: Path does not exist: {path}"

    lines = []

    def add_tree(current_path: str, prefix: str = "", depth: int = 0):
        if depth > max_depth:
            return

        try:
            items = sorted(os.listdir(current_path))
        except PermissionError:
            return

        # Filter out hidden and unwanted directories
        items = [i for i in items if not i.startswith('.') and i not in {
            'node_modules', '__pycache__', 'venv', '.venv', 'dist', 'build'
        }]

        dirs = [i for i in items if os.path.isdir(os.path.join(current_path, i))]
        files = [i for i in items if os.path.isfile(os.path.join(current_path, i))]

        # Add directories first
        for i, dir_name in enumerate(dirs):
            is_last_dir = (i == len(dirs) - 1) and len(files) == 0
            connector = "└── " if is_last_dir else "├── "
            lines.append(f"{prefix}{connector}{dir_name}/")

            extension = "    " if is_last_dir else "│   "
            add_tree(
                os.path.join(current_path, dir_name),
                prefix + extension,
                depth + 1
            )

        # Add files
        for i, file_name in enumerate(files):
            is_last = i == len(files) - 1
            connector = "└── " if is_last else "├── "
            lines.append(f"{prefix}{connector}{file_name}")

    lines.append(os.path.basename(path) + "/")
    add_tree(path)

    return "\n".join(lines)
```

#### 7. Core Tools - Bash Execution
**File**: `tools/bash_tools.py`

```python
"""Bash command execution tools for agents."""

import subprocess
import asyncio
from typing import Optional
from agents import function_tool


@function_tool
async def run_command(
    command: str,
    cwd: Optional[str] = None,
    timeout: int = 30
) -> str:
    """
    Run a shell command and return output.

    Args:
        command: Shell command to run
        cwd: Working directory for the command
        timeout: Timeout in seconds

    Returns:
        JSON string with command output
    """
    import json

    # Security: Block dangerous commands
    dangerous_patterns = [
        'rm -rf', 'sudo', 'chmod', 'chown', 'mkfs',
        'dd if=', '> /dev/', 'curl | sh', 'wget | sh'
    ]

    for pattern in dangerous_patterns:
        if pattern in command.lower():
            return json.dumps({
                "error": f"Command blocked for safety: contains '{pattern}'"
            })

    try:
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=timeout
        )

        return json.dumps({
            "command": command,
            "returncode": process.returncode,
            "stdout": stdout.decode('utf-8', errors='replace')[:10000],
            "stderr": stderr.decode('utf-8', errors='replace')[:2000]
        })

    except asyncio.TimeoutError:
        return json.dumps({
            "error": f"Command timed out after {timeout} seconds",
            "command": command
        })
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "command": command
        })


@function_tool
async def check_language_tools(path: str) -> str:
    """
    Check what language/build tools are available in the repository.

    Args:
        path: Repository path

    Returns:
        JSON string with detected tools and configurations
    """
    import json
    import os

    tools = {
        "package_managers": [],
        "build_tools": [],
        "config_files": [],
        "detected_languages": []
    }

    # Check for common files
    file_checks = {
        "package.json": ("npm/yarn", "javascript"),
        "requirements.txt": ("pip", "python"),
        "Pipfile": ("pipenv", "python"),
        "pyproject.toml": ("poetry/pip", "python"),
        "setup.py": ("setuptools", "python"),
        "Cargo.toml": ("cargo", "rust"),
        "go.mod": ("go modules", "go"),
        "pom.xml": ("maven", "java"),
        "build.gradle": ("gradle", "java"),
        "Gemfile": ("bundler", "ruby"),
        "composer.json": ("composer", "php"),
        "Makefile": ("make", None),
        "CMakeLists.txt": ("cmake", "c/c++"),
        "Dockerfile": ("docker", None),
        "docker-compose.yml": ("docker-compose", None),
        ".github/workflows": ("github-actions", None),
    }

    for file, (tool, lang) in file_checks.items():
        check_path = os.path.join(path, file)
        if os.path.exists(check_path):
            tools["config_files"].append(file)
            tools["build_tools"].append(tool)
            if lang and lang not in tools["detected_languages"]:
                tools["detected_languages"].append(lang)

    # Deduplicate
    tools["build_tools"] = list(set(tools["build_tools"]))

    return json.dumps(tools)
```

#### 8. Tools Package Init
**File**: `tools/__init__.py`

```python
"""Tools package for repository analysis agents."""

from .file_tools import list_directory, read_file, get_file_info, read_multiple_files
from .search_tools import grep_pattern, find_files, get_file_structure
from .bash_tools import run_command, check_language_tools

__all__ = [
    'list_directory',
    'read_file',
    'get_file_info',
    'read_multiple_files',
    'grep_pattern',
    'find_files',
    'get_file_structure',
    'run_command',
    'check_language_tools',
]
```

#### 9. Models Package Init
**File**: `models/__init__.py`

```python
"""Models package for handoff documents."""

from .handoff import (
    FileType,
    FileClassification,
    DiscoveryHandoff,
    FunctionInfo,
    ClassInfo,
    ImportInfo,
    FileAnalysisHandoff,
    ModuleInfo,
    DependencyEdge,
    ModuleAnalysisHandoff,
    DocumentationSection,
    CodeExample,
    FinalDocumentation,
)

__all__ = [
    'FileType',
    'FileClassification',
    'DiscoveryHandoff',
    'FunctionInfo',
    'ClassInfo',
    'ImportInfo',
    'FileAnalysisHandoff',
    'ModuleInfo',
    'DependencyEdge',
    'ModuleAnalysisHandoff',
    'DocumentationSection',
    'CodeExample',
    'FinalDocumentation',
]
```

#### 10. Agents Package Init
**File**: `agents/__init__.py`

```python
"""Agents package for repository documentation system."""

# Imports will be added as agents are implemented
```

### Success Criteria:

#### Automated Verification:
- [ ] All files created in correct locations
- [ ] `pip install -r requirements.txt` succeeds
- [ ] `python -c "from config import MODELS; print(MODELS)"` prints model config
- [ ] `python -c "from tools import read_file; print(read_file)"` imports successfully
- [ ] `python -c "from models import DiscoveryHandoff; print(DiscoveryHandoff)"` works

#### Manual Verification:
- [ ] .env file has valid API keys for all providers
- [ ] Directory structure matches specification

---

## Phase 2: Discovery Agent

### Overview
Implement the Discovery Agent that scans the repository, classifies files, and produces the initial handoff document for downstream agents.

### Changes Required:

#### 1. Discovery Agent Implementation
**File**: `agents/discovery.py`

```python
"""Discovery Agent - Scans and classifies repository contents."""

import os
import json
from typing import List
from agents import Agent, Runner, function_tool, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

from config import AGENT_CONFIGS, API_KEYS, HANDOFF_DIR
from models import DiscoveryHandoff, FileClassification, FileType
from tools import list_directory, get_file_structure, check_language_tools, read_file


# Instructions for the discovery agent
DISCOVERY_INSTRUCTIONS = """You are a Discovery Agent specialized in analyzing repository structures.

Your task is to:
1. Scan the repository directory structure completely
2. Classify every file by its type and importance
3. Identify the programming languages and frameworks used
4. Find entry points (main files, index files, etc.)
5. Create a comprehensive map of the repository

For each file, determine:
- File type: source_code, config, documentation, test, build, data, or other
- Programming language (if applicable)
- Importance (1-10 scale): 10 = critical entry point, 1 = boilerplate/generated

Be thorough and methodical. Use the tools to explore every directory.
Output your findings as structured data.

IMPORTANT: You must analyze EVERY file in the repository. Do not skip files.
Make multiple tool calls to ensure complete coverage.
"""


def create_discovery_agent() -> Agent:
    """Create and configure the Discovery Agent."""

    config = AGENT_CONFIGS["discovery"]

    agent = Agent(
        name=config.name,
        instructions=DISCOVERY_INSTRUCTIONS,
        model=LitellmModel(
            model=config.model,
            api_key=API_KEYS["xai"]
        ),
        model_settings=ModelSettings(
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        ),
        tools=[
            list_directory,
            get_file_structure,
            check_language_tools,
            read_file,
        ],
        output_type=DiscoveryHandoff,
    )

    return agent


async def run_discovery(repository_path: str) -> DiscoveryHandoff:
    """
    Run the discovery phase on a repository.

    Args:
        repository_path: Path to the repository to analyze

    Returns:
        DiscoveryHandoff with complete repository analysis
    """
    if not os.path.exists(repository_path):
        raise ValueError(f"Repository path does not exist: {repository_path}")

    agent = create_discovery_agent()

    prompt = f"""Analyze the repository at: {repository_path}

Please perform a complete discovery:
1. First, get the directory structure using get_file_structure
2. Check what language tools and configs exist using check_language_tools
3. List all files recursively using list_directory with recursive=True
4. For each file, classify its type, language, and importance
5. Identify entry points (main.py, index.js, etc.)
6. Detect frameworks from config files (read package.json, requirements.txt, etc.)

Be exhaustive - analyze EVERY file. This is critical for downstream agents.

Return a complete DiscoveryHandoff with all files classified."""

    result = await Runner.run(agent, prompt)

    handoff = result.final_output

    # Save handoff document
    os.makedirs(HANDOFF_DIR, exist_ok=True)
    handoff_path = os.path.join(HANDOFF_DIR, "discovery_handoff.json")

    with open(handoff_path, 'w') as f:
        f.write(handoff.model_dump_json(indent=2))

    return handoff


# Additional helper for classifying a single file
@function_tool
async def classify_file_batch(files_json: str) -> str:
    """
    Classify a batch of files by examining their names and extensions.

    Args:
        files_json: JSON string with list of file paths

    Returns:
        JSON string with classifications
    """
    files = json.loads(files_json)
    classifications = []

    for file_path in files:
        ext = os.path.splitext(file_path)[1].lower()
        name = os.path.basename(file_path).lower()

        # Determine file type
        if ext in {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs', '.rb', '.php', '.cs', '.cpp', '.c', '.swift', '.kt'}:
            file_type = FileType.SOURCE_CODE
        elif ext in {'.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.env'}:
            file_type = FileType.CONFIG
        elif ext in {'.md', '.rst', '.txt'} or name in {'readme', 'changelog', 'license'}:
            file_type = FileType.DOCUMENTATION
        elif 'test' in name or 'spec' in name or file_path.startswith('test'):
            file_type = FileType.TEST
        elif ext in {'.sql', '.csv', '.parquet'}:
            file_type = FileType.DATA
        elif name in {'makefile', 'dockerfile', 'jenkinsfile'} or ext in {'.mk', '.cmake'}:
            file_type = FileType.BUILD
        else:
            file_type = FileType.OTHER

        # Determine language
        lang_map = {
            '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
            '.jsx': 'javascript', '.tsx': 'typescript', '.java': 'java',
            '.go': 'go', '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
            '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c', '.swift': 'swift',
            '.kt': 'kotlin', '.scala': 'scala'
        }
        language = lang_map.get(ext)

        # Determine importance
        importance = 5  # Default
        if name in {'main', 'index', 'app', 'server', '__init__'}:
            importance = 9
        elif name in {'setup', 'config', 'settings'}:
            importance = 8
        elif 'test' in name:
            importance = 4
        elif file_type == FileType.DOCUMENTATION:
            importance = 6

        classifications.append({
            "path": file_path,
            "file_type": file_type.value,
            "language": language,
            "importance": importance
        })

    return json.dumps(classifications)
```

### Success Criteria:

#### Automated Verification:
- [ ] `python -c "from agents.discovery import create_discovery_agent; print(create_discovery_agent())"` works
- [ ] Agent can be created without errors

#### Manual Verification:
- [ ] Test on a small repository - all files classified
- [ ] Handoff JSON is written to `.handoffs/discovery_handoff.json`

---

## Phase 3: File Analyzer Agent

### Overview
Implement the File Analyzer Agent that performs deep analysis on each individual file, extracting classes, functions, imports, and generating insights.

### Changes Required:

#### 1. File Analyzer Agent Implementation
**File**: `agents/file_analyzer.py`

```python
"""File Analyzer Agent - Deep analysis of individual files."""

import os
import json
import asyncio
from typing import List, Optional
from agents import Agent, Runner, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

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
        tools=[read_file, grep_pattern],
        output_type=FileAnalysisHandoff,
    )


async def analyze_single_file(
    file_path: str,
    classification: FileClassification,
    agent: Optional[Agent] = None
) -> FileAnalysisHandoff:
    """
    Analyze a single file in depth.

    Args:
        file_path: Full path to the file
        classification: File classification from discovery
        agent: Optional pre-created agent (for reuse)

    Returns:
        FileAnalysisHandoff with complete analysis
    """
    if agent is None:
        agent = create_file_analyzer_agent()

    prompt = f"""Analyze this file in complete detail:

File: {file_path}
Type: {classification.file_type}
Language: {classification.language or 'unknown'}
Importance: {classification.importance}/10

Instructions:
1. Read the file using read_file tool
2. Identify every import statement
3. Extract every class definition with all methods
4. Extract every standalone function
5. Note all exported/public symbols
6. Determine the file's purpose
7. List key insights

Be thorough - this analysis feeds into documentation generation.
Return a complete FileAnalysisHandoff."""

    result = await Runner.run(agent, prompt)
    return result.final_output


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
    agent = create_file_analyzer_agent()

    # Filter to only source code and config files
    analyzable = [
        f for f in files
        if f.file_type in {FileType.SOURCE_CODE, FileType.CONFIG}
    ]

    total = len(analyzable)

    for i in range(0, total, batch_size):
        batch = analyzable[i:i + batch_size]

        # Analyze batch in parallel
        tasks = [
            analyze_single_file(
                os.path.join(repository_path, f.path),
                f,
                agent
            )
            for f in batch
        ]

        batch_results = await asyncio.gather(*tasks, return_exceptions=True)

        for j, result in enumerate(batch_results):
            if isinstance(result, Exception):
                # Create a minimal handoff for failed files
                file_cls = batch[j]
                results.append(FileAnalysisHandoff(
                    path=file_cls.path,
                    language=file_cls.language or "unknown",
                    purpose=f"Analysis failed: {str(result)}",
                    imports=[],
                    exports=[],
                    classes=[],
                    functions=[],
                    constants=[],
                    key_insights=[f"Error during analysis: {str(result)}"],
                    dependencies=[],
                    complexity_score=1,
                    raw_summary="Analysis failed"
                ))
            else:
                results.append(result)

        if progress_callback:
            progress_callback(min(i + batch_size, total), total)

    return results


async def run_file_analysis(discovery: DiscoveryHandoff) -> List[FileAnalysisHandoff]:
    """
    Run file analysis phase using discovery results.

    Args:
        discovery: DiscoveryHandoff from discovery phase

    Returns:
        List of FileAnalysisHandoff for all analyzed files
    """
    print(f"Analyzing {len(discovery.files)} files...")

    def progress(current, total):
        print(f"  Progress: {current}/{total} files analyzed")

    results = await analyze_files_batch(
        discovery.files,
        discovery.repository_path,
        batch_size=5,
        progress_callback=progress
    )

    # Save handoff documents
    os.makedirs(HANDOFF_DIR, exist_ok=True)

    # Save individual file analyses
    for analysis in results:
        safe_name = analysis.path.replace('/', '_').replace('\\', '_')
        handoff_path = os.path.join(HANDOFF_DIR, f"file_{safe_name}.json")
        with open(handoff_path, 'w') as f:
            f.write(analysis.model_dump_json(indent=2))

    # Save combined analysis
    combined_path = os.path.join(HANDOFF_DIR, "file_analysis_combined.json")
    with open(combined_path, 'w') as f:
        json.dump([a.model_dump() for a in results], f, indent=2)

    print(f"File analysis complete. {len(results)} files analyzed.")
    return results
```

### Success Criteria:

#### Automated Verification:
- [ ] `python -c "from agents.file_analyzer import create_file_analyzer_agent; print('OK')"` works
- [ ] Agent imports without errors

#### Manual Verification:
- [ ] Test on a single Python file - extracts classes and functions correctly
- [ ] Handoff JSON contains accurate import information

---

## Phase 4: Module Analyzer Agent

### Overview
Implement the Module Analyzer Agent that discovers cross-file relationships, builds dependency graphs, and identifies architectural patterns.

### Changes Required:

#### 1. Module Analyzer Agent Implementation
**File**: `agents/module_analyzer.py`

```python
"""Module Analyzer Agent - Cross-file relationship and architecture analysis."""

import os
import json
from typing import List, Dict
from agents import Agent, Runner, ModelSettings, function_tool
from agents.extensions.models.litellm_model import LitellmModel

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

Use the provided file analyses and search tools to build a complete picture.
Be thorough in mapping ALL relationships.

Output a complete ModuleAnalysisHandoff."""


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
        tools=[grep_pattern, read_file, find_files],
        output_type=ModuleAnalysisHandoff,
    )


@function_tool
def get_file_analyses_summary(handoff_dir: str) -> str:
    """
    Load and summarize all file analysis handoffs.

    Args:
        handoff_dir: Directory containing handoff files

    Returns:
        JSON summary of all file analyses
    """
    combined_path = os.path.join(handoff_dir, "file_analysis_combined.json")

    if not os.path.exists(combined_path):
        return json.dumps({"error": "No file analyses found"})

    with open(combined_path, 'r') as f:
        analyses = json.load(f)

    # Create summary for module analysis
    summary = {
        "total_files": len(analyses),
        "files": []
    }

    for analysis in analyses:
        file_summary = {
            "path": analysis["path"],
            "language": analysis["language"],
            "purpose": analysis["purpose"],
            "imports": [imp["module"] for imp in analysis.get("imports", [])],
            "exports": analysis.get("exports", []),
            "classes": [cls["name"] for cls in analysis.get("classes", [])],
            "functions": [fn["name"] for fn in analysis.get("functions", [])],
            "complexity": analysis.get("complexity_score", 5)
        }
        summary["files"].append(file_summary)

    return json.dumps(summary, indent=2)


async def run_module_analysis(
    discovery: DiscoveryHandoff,
    file_analyses: List[FileAnalysisHandoff]
) -> ModuleAnalysisHandoff:
    """
    Run module analysis phase.

    Args:
        discovery: Discovery handoff
        file_analyses: List of file analysis handoffs

    Returns:
        ModuleAnalysisHandoff with complete architecture analysis
    """
    agent = create_module_analyzer_agent()

    # Prepare context about the repository
    languages = ", ".join(discovery.detected_languages)
    frameworks = ", ".join(discovery.detected_frameworks) if discovery.detected_frameworks else "none detected"

    # Create imports summary
    all_imports = {}
    for analysis in file_analyses:
        for imp in analysis.imports:
            if imp.module not in all_imports:
                all_imports[imp.module] = []
            all_imports[imp.module].append(analysis.path)

    imports_summary = json.dumps(all_imports, indent=2)

    # Create file relationships summary
    file_summaries = []
    for analysis in file_analyses:
        file_summaries.append({
            "path": analysis.path,
            "imports": [i.module for i in analysis.imports],
            "exports": analysis.exports,
            "classes": [c.name for c in analysis.classes],
            "functions": [f.name for f in analysis.functions],
        })

    prompt = f"""Analyze the architecture and module relationships for this repository:

Repository: {discovery.repository_path}
Total Files: {discovery.total_files}
Languages: {languages}
Frameworks: {frameworks}
Entry Points: {', '.join(discovery.entry_points)}

FILE SUMMARIES:
{json.dumps(file_summaries, indent=2)}

IMPORT RELATIONSHIPS:
{imports_summary}

Your tasks:
1. Group files into logical modules based on directory structure and imports
2. Build a dependency graph showing all relationships
3. Identify architectural patterns (MVC, layered, microservices, etc.)
4. Trace data flow through the system
5. Document the public API surface of each module
6. Provide architectural insights and observations

Use grep_pattern to search for patterns if needed.
Be thorough - this analysis drives the final documentation.

Return a complete ModuleAnalysisHandoff."""

    result = await Runner.run(agent, prompt)
    handoff = result.final_output

    # Save handoff
    handoff_path = os.path.join(HANDOFF_DIR, "module_analysis_handoff.json")
    with open(handoff_path, 'w') as f:
        f.write(handoff.model_dump_json(indent=2))

    return handoff
```

### Success Criteria:

#### Automated Verification:
- [ ] `python -c "from agents.module_analyzer import create_module_analyzer_agent; print('OK')"` works

#### Manual Verification:
- [ ] Dependency graph correctly maps import relationships
- [ ] Modules are grouped logically

---

## Phase 5: Documentation Synthesizer Agent

### Overview
Implement the Documentation Synthesizer Agent that combines all analysis results into comprehensive markdown documentation.

### Changes Required:

#### 1. Documentation Synthesizer Implementation
**File**: `agents/doc_synthesizer.py`

```python
"""Documentation Synthesizer Agent - Generates comprehensive documentation."""

import os
from typing import List
from agents import Agent, Runner, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

from config import AGENT_CONFIGS, API_KEYS, OUTPUT_DIR
from models import (
    FinalDocumentation,
    DocumentationSection,
    DiscoveryHandoff,
    FileAnalysisHandoff,
    ModuleAnalysisHandoff,
)


DOC_SYNTHESIZER_INSTRUCTIONS = """You are a Documentation Synthesizer Agent specialized in creating comprehensive technical documentation.

Your task is to synthesize all analysis data into clear, well-organized documentation.

Documentation Structure:
1. **Overview** - What the project does, why it exists
2. **Architecture** - How the system is structured, design decisions
3. **Modules** - Each module with its purpose, API, and usage
4. **API Reference** - Complete API documentation
5. **Getting Started** - How to install, configure, run
6. **Configuration** - Available options and settings

Writing Guidelines:
- Be clear and concise
- Use code examples liberally
- Include diagrams (ASCII/text-based)
- Cross-reference related sections
- Write for developers who are new to the codebase
- Explain the "why" not just the "what"

For each module section:
- Purpose and responsibility
- Key classes/functions with descriptions
- Dependencies (what it needs)
- Dependents (what uses it)
- Common usage patterns
- Configuration options

Make the documentation genuinely useful for developers.

Output a complete FinalDocumentation structure."""


def create_doc_synthesizer_agent() -> Agent:
    """Create the Documentation Synthesizer Agent."""

    config = AGENT_CONFIGS["doc_synthesizer"]

    return Agent(
        name=config.name,
        instructions=DOC_SYNTHESIZER_INSTRUCTIONS,
        model=LitellmModel(
            model=config.model,
            api_key=API_KEYS["google"]
        ),
        model_settings=ModelSettings(
            temperature=config.temperature,
            max_tokens=8192,
        ),
        tools=[],  # No tools needed - pure synthesis
        output_type=FinalDocumentation,
    )


async def run_doc_synthesis(
    discovery: DiscoveryHandoff,
    file_analyses: List[FileAnalysisHandoff],
    module_analysis: ModuleAnalysisHandoff,
) -> FinalDocumentation:
    """
    Run documentation synthesis phase.

    Args:
        discovery: Discovery handoff
        file_analyses: File analysis handoffs
        module_analysis: Module analysis handoff

    Returns:
        FinalDocumentation with complete docs
    """
    agent = create_doc_synthesizer_agent()

    # Build comprehensive context
    repo_name = os.path.basename(discovery.repository_path)

    # Module summaries
    modules_context = []
    for module in module_analysis.modules:
        modules_context.append({
            "name": module.name,
            "path": module.path,
            "purpose": module.purpose,
            "files": module.files,
            "public_api": module.public_api,
        })

    # Key relationships
    relationships = [
        f"{edge.source} -> {edge.target} ({edge.relationship_type})"
        for edge in module_analysis.dependency_graph[:50]  # Top 50
    ]

    # File details for API reference
    api_details = []
    for analysis in file_analyses:
        if analysis.classes or analysis.functions:
            api_details.append({
                "file": analysis.path,
                "classes": [
                    {
                        "name": c.name,
                        "description": c.description,
                        "methods": [m.name for m in c.methods]
                    }
                    for c in analysis.classes
                ],
                "functions": [
                    {
                        "name": f.name,
                        "description": f.description,
                        "parameters": f.parameters
                    }
                    for f in analysis.functions
                ]
            })

    import json

    prompt = f"""Create comprehensive documentation for this repository:

REPOSITORY: {repo_name}
PATH: {discovery.repository_path}
LANGUAGES: {', '.join(discovery.detected_languages)}
FRAMEWORKS: {', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else 'None'}

REPOSITORY SUMMARY:
{discovery.summary}

MODULES:
{json.dumps(modules_context, indent=2)}

KEY RELATIONSHIPS:
{chr(10).join(relationships)}

ARCHITECTURAL PATTERNS:
{', '.join(module_analysis.architecture_patterns)}

ARCHITECTURAL INSIGHTS:
{chr(10).join(module_analysis.architectural_insights)}

API DETAILS:
{json.dumps(api_details[:20], indent=2)}

Create documentation that includes:
1. Clear overview explaining the project
2. Architecture section with text-based diagrams
3. Module documentation for each major module
4. API reference with class/function details
5. Getting started guide
6. Configuration reference

Make it comprehensive and developer-friendly.
Return a FinalDocumentation structure."""

    result = await Runner.run(agent, prompt)
    return result.final_output


def write_documentation_files(docs: FinalDocumentation):
    """
    Write documentation to markdown files.

    Args:
        docs: FinalDocumentation to write
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Main README
    readme_content = f"""# {docs.repository_name}

{docs.overview}

## Table of Contents

- [Architecture](#architecture)
- [Modules](#modules)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Examples](#examples)

## Architecture

{docs.architecture.content}

"""

    # Add subsections
    for subsection in docs.architecture.subsections:
        readme_content += f"### {subsection.title}\n\n{subsection.content}\n\n"

    readme_content += "## Modules\n\n"

    for module in docs.modules:
        readme_content += f"### {module.title}\n\n{module.content}\n\n"
        for sub in module.subsections:
            readme_content += f"#### {sub.title}\n\n{sub.content}\n\n"

    readme_content += f"""## API Reference

{docs.api_reference.content}

"""

    for sub in docs.api_reference.subsections:
        readme_content += f"### {sub.title}\n\n{sub.content}\n\n"

    readme_content += f"""## Getting Started

{docs.getting_started.content}

"""

    if docs.configuration:
        readme_content += f"""## Configuration

{docs.configuration.content}

"""

    readme_content += "## Examples\n\n"

    for example in docs.examples:
        readme_content += f"""### {example.title}

{example.description}

```{example.language}
{example.code}
```

"""

    # Write main README
    readme_path = os.path.join(OUTPUT_DIR, "README.md")
    with open(readme_path, 'w') as f:
        f.write(readme_content)

    # Write separate module docs
    modules_dir = os.path.join(OUTPUT_DIR, "modules")
    os.makedirs(modules_dir, exist_ok=True)

    for module in docs.modules:
        module_filename = module.title.lower().replace(' ', '_') + '.md'
        module_path = os.path.join(modules_dir, module_filename)

        module_content = f"# {module.title}\n\n{module.content}\n\n"
        for sub in module.subsections:
            module_content += f"## {sub.title}\n\n{sub.content}\n\n"

        with open(module_path, 'w') as f:
            f.write(module_content)

    # Write API reference separately
    api_path = os.path.join(OUTPUT_DIR, "API_REFERENCE.md")
    api_content = f"# API Reference\n\n{docs.api_reference.content}\n\n"
    for sub in docs.api_reference.subsections:
        api_content += f"## {sub.title}\n\n{sub.content}\n\n"

    with open(api_path, 'w') as f:
        f.write(api_content)

    print(f"Documentation written to {OUTPUT_DIR}/")
    print(f"  - README.md")
    print(f"  - API_REFERENCE.md")
    print(f"  - modules/ ({len(docs.modules)} files)")
```

### Success Criteria:

#### Automated Verification:
- [ ] `python -c "from agents.doc_synthesizer import create_doc_synthesizer_agent; print('OK')"` works

#### Manual Verification:
- [ ] Generated README.md is comprehensive and readable
- [ ] Module documentation covers all major components

---

## Phase 6: Code Example Generator Agent

### Overview
Implement the Code Example Generator Agent that creates comprehensive usage examples and integration patterns.

### Changes Required:

#### 1. Example Generator Implementation
**File**: `agents/example_generator.py`

```python
"""Code Example Generator Agent - Creates usage examples and integration patterns."""

import os
from typing import List
from agents import Agent, Runner, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

from config import AGENT_CONFIGS, API_KEYS, OUTPUT_DIR
from models import (
    CodeExample,
    FinalDocumentation,
    ModuleAnalysisHandoff,
    FileAnalysisHandoff,
)
from tools import read_file


EXAMPLE_GENERATOR_INSTRUCTIONS = """You are a Code Example Generator Agent specialized in creating practical, working code examples.

Your task is to generate comprehensive examples that help developers:
1. Understand how to use the codebase
2. Integrate with the codebase from external projects
3. Implement common patterns and workflows
4. Handle edge cases correctly

For each example:
- Make it complete and runnable
- Include necessary imports
- Add comments explaining key steps
- Show error handling where appropriate
- Include prerequisites (dependencies, setup steps)
- Reference the actual source files

Types of examples to generate:
1. **Quick Start** - Minimal example to get started
2. **Common Use Cases** - Examples for typical scenarios
3. **Integration Patterns** - How to integrate with other systems
4. **Advanced Usage** - Complex scenarios and customization
5. **Error Handling** - How to handle failures gracefully

Write clean, idiomatic code following the project's conventions.
Make examples genuinely useful - not just trivial.

Output a list of CodeExample objects."""


def create_example_generator_agent() -> Agent:
    """Create the Example Generator Agent."""

    config = AGENT_CONFIGS["example_generator"]

    return Agent(
        name=config.name,
        instructions=EXAMPLE_GENERATOR_INSTRUCTIONS,
        model=LitellmModel(
            model=config.model,
            api_key=API_KEYS["anthropic"]
        ),
        model_settings=ModelSettings(
            temperature=config.temperature,
            max_tokens=8192,
        ),
        tools=[read_file],
    )


async def generate_examples(
    module_analysis: ModuleAnalysisHandoff,
    file_analyses: List[FileAnalysisHandoff],
    primary_language: str = "python"
) -> List[CodeExample]:
    """
    Generate code examples based on analysis.

    Args:
        module_analysis: Module analysis handoff
        file_analyses: File analysis handoffs
        primary_language: Primary language for examples

    Returns:
        List of CodeExample objects
    """
    agent = create_example_generator_agent()

    # Build context about public APIs
    public_apis = []
    for module in module_analysis.modules:
        if module.public_api:
            public_apis.append({
                "module": module.name,
                "apis": module.public_api[:10]  # Top 10 per module
            })

    # Key classes and functions
    key_components = []
    for analysis in file_analyses:
        if analysis.complexity_score >= 7:  # High importance files
            for cls in analysis.classes[:3]:
                key_components.append({
                    "file": analysis.path,
                    "type": "class",
                    "name": cls.name,
                    "description": cls.description,
                    "methods": [m.name for m in cls.methods[:5]]
                })
            for fn in analysis.functions[:3]:
                key_components.append({
                    "file": analysis.path,
                    "type": "function",
                    "name": fn.name,
                    "description": fn.description,
                    "parameters": fn.parameters
                })

    import json

    prompt = f"""Generate comprehensive code examples for this codebase:

PRIMARY LANGUAGE: {primary_language}

PUBLIC APIS:
{json.dumps(public_apis, indent=2)}

KEY COMPONENTS:
{json.dumps(key_components[:30], indent=2)}

ENTRY POINTS:
{', '.join(module_analysis.entry_points)}

Generate these types of examples:

1. **Quick Start Example**
   - Minimal code to get started
   - Shows basic import and usage

2. **Common Use Cases** (2-3 examples)
   - Real-world scenarios
   - Practical, useful patterns

3. **Integration Example**
   - How to use from another project
   - External API usage

4. **Advanced Usage**
   - Complex configuration
   - Customization patterns

5. **Error Handling**
   - Common errors and handling
   - Graceful degradation

For each example:
- Make it complete and runnable
- Include imports
- Add helpful comments
- Reference source files
- List prerequisites

Return a list of CodeExample objects."""

    result = await Runner.run(agent, prompt)

    # Parse the output - agent may return raw list or need extraction
    if isinstance(result.final_output, list):
        examples = result.final_output
    else:
        # Try to extract examples from text response
        examples = parse_examples_from_text(result.final_output, primary_language)

    return examples


def parse_examples_from_text(text: str, language: str) -> List[CodeExample]:
    """
    Parse examples from text output if structured output fails.

    Args:
        text: Raw text containing examples
        language: Programming language

    Returns:
        List of CodeExample objects
    """
    import re

    examples = []

    # Find code blocks with titles
    pattern = r'###?\s*(.+?)\n+(?:(.+?)\n+)?```(\w+)?\n(.*?)```'
    matches = re.findall(pattern, text, re.DOTALL)

    for match in matches:
        title = match[0].strip()
        description = match[1].strip() if match[1] else ""
        lang = match[2] or language
        code = match[3].strip()

        examples.append(CodeExample(
            title=title,
            description=description,
            code=code,
            language=lang,
            file_references=[],
            prerequisites=[]
        ))

    return examples


def write_examples_file(examples: List[CodeExample]):
    """
    Write examples to a dedicated markdown file.

    Args:
        examples: List of examples to write
    """
    examples_path = os.path.join(OUTPUT_DIR, "EXAMPLES.md")

    content = "# Code Examples\n\n"
    content += "This document contains practical code examples for using this codebase.\n\n"
    content += "## Table of Contents\n\n"

    for i, example in enumerate(examples, 1):
        anchor = example.title.lower().replace(' ', '-')
        content += f"{i}. [{example.title}](#{anchor})\n"

    content += "\n---\n\n"

    for example in examples:
        content += f"## {example.title}\n\n"

        if example.description:
            content += f"{example.description}\n\n"

        if example.prerequisites:
            content += "**Prerequisites:**\n"
            for prereq in example.prerequisites:
                content += f"- {prereq}\n"
            content += "\n"

        content += f"```{example.language}\n{example.code}\n```\n\n"

        if example.file_references:
            content += "**Related files:**\n"
            for ref in example.file_references:
                content += f"- `{ref}`\n"
            content += "\n"

        content += "---\n\n"

    with open(examples_path, 'w') as f:
        f.write(content)

    print(f"Examples written to {examples_path}")
```

### Success Criteria:

#### Automated Verification:
- [ ] `python -c "from agents.example_generator import create_example_generator_agent; print('OK')"` works

#### Manual Verification:
- [ ] Generated examples are syntactically correct
- [ ] Examples cover practical use cases

---

## Phase 7: Orchestrator & Main Entry Point

### Overview
Implement the main orchestrator agent that coordinates all sub-agents and the CLI entry point.

### Changes Required:

#### 1. Orchestrator Agent
**File**: `agents/orchestrator.py`

```python
"""Orchestrator Agent - Coordinates the documentation generation workflow."""

import os
import asyncio
import json
from typing import Optional
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from agents import Agent, Runner, ModelSettings, set_default_openai_api, set_tracing_disabled
from agents.extensions.models.litellm_model import LitellmModel

from config import AGENT_CONFIGS, API_KEYS, OUTPUT_DIR, HANDOFF_DIR
from models import (
    DiscoveryHandoff,
    FileAnalysisHandoff,
    ModuleAnalysisHandoff,
    FinalDocumentation,
)
from agents.discovery import run_discovery
from agents.file_analyzer import run_file_analysis
from agents.module_analyzer import run_module_analysis
from agents.doc_synthesizer import run_doc_synthesis, write_documentation_files
from agents.example_generator import generate_examples, write_examples_file


# Configure for non-OpenAI providers
set_default_openai_api("chat_completions")
set_tracing_disabled()

console = Console()


ORCHESTRATOR_INSTRUCTIONS = """You are the Orchestrator Agent coordinating repository documentation generation.

Your role is to:
1. Manage the overall workflow
2. Ensure each phase completes successfully
3. Handle errors and retries
4. Coordinate data flow between agents

Phases:
1. Discovery - Scan and classify repository
2. File Analysis - Deep analysis of each file
3. Module Analysis - Cross-file relationships
4. Documentation Synthesis - Generate documentation
5. Example Generation - Create code examples

You delegate to specialized agents and monitor progress.
If a phase fails, attempt recovery before proceeding."""


class DocumentationOrchestrator:
    """Orchestrates the multi-agent documentation generation workflow."""

    def __init__(self, repository_path: str):
        """
        Initialize the orchestrator.

        Args:
            repository_path: Path to repository to document
        """
        self.repository_path = os.path.abspath(repository_path)
        self.discovery: Optional[DiscoveryHandoff] = None
        self.file_analyses: Optional[list[FileAnalysisHandoff]] = None
        self.module_analysis: Optional[ModuleAnalysisHandoff] = None
        self.documentation: Optional[FinalDocumentation] = None

        # Ensure output directories exist
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        os.makedirs(HANDOFF_DIR, exist_ok=True)

    async def run_phase_with_progress(self, phase_name: str, coro):
        """
        Run a phase with progress indication.

        Args:
            phase_name: Name of the phase
            coro: Coroutine to run

        Returns:
            Result of the coroutine
        """
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task(f"[cyan]{phase_name}...", total=None)
            result = await coro
            progress.update(task, completed=True)
        return result

    async def run(self) -> str:
        """
        Run the complete documentation generation workflow.

        Returns:
            Path to generated documentation
        """
        console.print(f"\n[bold blue]Repository Documentation Generator[/bold blue]")
        console.print(f"Repository: {self.repository_path}\n")

        # Phase 1: Discovery
        console.print("[bold]Phase 1: Discovery[/bold]")
        self.discovery = await self.run_phase_with_progress(
            "Scanning repository",
            run_discovery(self.repository_path)
        )
        console.print(f"  ✓ Found {self.discovery.total_files} files")
        console.print(f"  ✓ Languages: {', '.join(self.discovery.detected_languages)}")

        # Phase 2: File Analysis
        console.print("\n[bold]Phase 2: File Analysis[/bold]")
        self.file_analyses = await self.run_phase_with_progress(
            "Analyzing files",
            run_file_analysis(self.discovery)
        )
        console.print(f"  ✓ Analyzed {len(self.file_analyses)} files")

        # Phase 3: Module Analysis
        console.print("\n[bold]Phase 3: Module Analysis[/bold]")
        self.module_analysis = await self.run_phase_with_progress(
            "Analyzing modules and relationships",
            run_module_analysis(self.discovery, self.file_analyses)
        )
        console.print(f"  ✓ Identified {len(self.module_analysis.modules)} modules")
        console.print(f"  ✓ Mapped {len(self.module_analysis.dependency_graph)} relationships")

        # Phase 4: Documentation Synthesis
        console.print("\n[bold]Phase 4: Documentation Synthesis[/bold]")
        self.documentation = await self.run_phase_with_progress(
            "Generating documentation",
            run_doc_synthesis(self.discovery, self.file_analyses, self.module_analysis)
        )
        write_documentation_files(self.documentation)
        console.print(f"  ✓ Generated {len(self.documentation.modules)} module docs")

        # Phase 5: Example Generation
        console.print("\n[bold]Phase 5: Example Generation[/bold]")
        primary_lang = self.discovery.detected_languages[0] if self.discovery.detected_languages else "python"
        examples = await self.run_phase_with_progress(
            "Generating code examples",
            generate_examples(self.module_analysis, self.file_analyses, primary_lang)
        )
        write_examples_file(examples)
        console.print(f"  ✓ Generated {len(examples)} code examples")

        # Summary
        console.print("\n[bold green]Documentation Complete![/bold green]")
        console.print(f"Output directory: {OUTPUT_DIR}/")
        console.print("Files generated:")
        console.print("  - README.md (main documentation)")
        console.print("  - API_REFERENCE.md")
        console.print("  - EXAMPLES.md")
        console.print("  - modules/ (detailed module docs)")

        return OUTPUT_DIR


async def generate_documentation(repository_path: str) -> str:
    """
    Main entry point for documentation generation.

    Args:
        repository_path: Path to repository

    Returns:
        Path to output directory
    """
    orchestrator = DocumentationOrchestrator(repository_path)
    return await orchestrator.run()
```

#### 2. Main Entry Point
**File**: `main.py`

```python
#!/usr/bin/env python3
"""
Repository Documentation Generator

A multi-agent system for generating comprehensive documentation
from source code repositories.

Usage:
    python main.py /path/to/repository
    python main.py /path/to/repository --output ./docs
"""

import asyncio
import argparse
import sys
import os
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console

# Load environment variables
load_dotenv()

console = Console()


def validate_repository(path: str) -> Path:
    """
    Validate that the path is a valid repository.

    Args:
        path: Path to validate

    Returns:
        Resolved Path object

    Raises:
        ValueError: If path is invalid
    """
    repo_path = Path(path).resolve()

    if not repo_path.exists():
        raise ValueError(f"Path does not exist: {repo_path}")

    if not repo_path.is_dir():
        raise ValueError(f"Path is not a directory: {repo_path}")

    # Check for some source files
    has_source = any(
        repo_path.rglob("*.py") or
        repo_path.rglob("*.js") or
        repo_path.rglob("*.ts") or
        repo_path.rglob("*.java") or
        repo_path.rglob("*.go")
    )

    if not has_source:
        console.print("[yellow]Warning: No common source files detected[/yellow]")

    return repo_path


def validate_api_keys():
    """Check that required API keys are set."""
    required_keys = {
        "ANTHROPIC_API_KEY": "Anthropic (Claude)",
        "GOOGLE_API_KEY": "Google (Gemini)",
        "XAI_API_KEY": "xAI (Grok)",
    }

    missing = []
    for key, provider in required_keys.items():
        if not os.getenv(key):
            missing.append(f"  - {key} ({provider})")

    if missing:
        console.print("[red]Missing API keys:[/red]")
        for m in missing:
            console.print(m)
        console.print("\nPlease set these in your .env file or environment.")
        sys.exit(1)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Generate comprehensive documentation for a repository",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python main.py /path/to/my-project
    python main.py ./my-repo --output ./documentation
    python main.py https://github.com/user/repo  # Future: git clone support
        """
    )

    parser.add_argument(
        "repository",
        help="Path to the repository to document"
    )

    parser.add_argument(
        "--output", "-o",
        default="./output",
        help="Output directory for documentation (default: ./output)"
    )

    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )

    args = parser.parse_args()

    # Validate inputs
    try:
        repo_path = validate_repository(args.repository)
    except ValueError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)

    validate_api_keys()

    # Update output directory if specified
    if args.output != "./output":
        import config
        config.OUTPUT_DIR = os.path.abspath(args.output)
        config.HANDOFF_DIR = os.path.join(config.OUTPUT_DIR, ".handoffs")

    # Run documentation generation
    console.print(f"\n[bold]Starting documentation generation...[/bold]")
    console.print(f"Repository: {repo_path}")
    console.print(f"Output: {args.output}\n")

    from agents.orchestrator import generate_documentation

    try:
        output_path = asyncio.run(generate_documentation(str(repo_path)))
        console.print(f"\n[green]Success![/green] Documentation generated at: {output_path}")
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        sys.exit(130)
    except Exception as e:
        console.print(f"\n[red]Error:[/red] {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
```

#### 3. Update Agents Package Init
**File**: `agents/__init__.py` (update)

```python
"""Agents package for repository documentation system."""

from .orchestrator import DocumentationOrchestrator, generate_documentation
from .discovery import run_discovery
from .file_analyzer import run_file_analysis
from .module_analyzer import run_module_analysis
from .doc_synthesizer import run_doc_synthesis
from .example_generator import generate_examples

__all__ = [
    'DocumentationOrchestrator',
    'generate_documentation',
    'run_discovery',
    'run_file_analysis',
    'run_module_analysis',
    'run_doc_synthesis',
    'generate_examples',
]
```

### Success Criteria:

#### Automated Verification:
- [ ] `pip install -r requirements.txt` succeeds
- [ ] `python main.py --help` shows usage information
- [ ] `python -c "from agents.orchestrator import generate_documentation; print('OK')"` works

#### Manual Verification:
- [ ] Run on a small test repository successfully
- [ ] All documentation files generated in output directory
- [ ] No API key errors during execution

---

## Testing Strategy

### Unit Tests:
- Test each tool function independently
- Test Pydantic model serialization/deserialization
- Test configuration loading

### Integration Tests:
- Test discovery agent on sample repository
- Test file analysis on single files
- Test full pipeline on small repos

### Manual Testing Steps:
1. Create small test repository with 5-10 files
2. Run `python main.py ./test-repo`
3. Verify README.md is generated and readable
4. Verify EXAMPLES.md contains working code
5. Check all modules documented in modules/

## Performance Considerations

- **Batch Processing**: File analysis runs in batches of 5 to avoid rate limits
- **Caching**: Handoff documents are persisted to avoid re-computation
- **Timeouts**: All LLM calls have implicit timeouts via the SDK
- **Parallelism**: asyncio.gather used for concurrent file analysis

## Configuration Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key | Required |
| `GOOGLE_API_KEY` | Gemini API key | Required |
| `XAI_API_KEY` | Grok API key | Required |
| `OUTPUT_DIR` | Documentation output | `./output` |
| `MAX_FILE_SIZE_KB` | Skip files larger than | 500 KB |

## References

- OpenAI Agents SDK: https://openai.github.io/openai-agents-python/
- LiteLLM: https://docs.litellm.ai/docs/
- Model identifiers from research phase
