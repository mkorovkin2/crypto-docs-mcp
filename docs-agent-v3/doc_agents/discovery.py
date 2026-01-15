"""Discovery Agent - Scans and classifies repository contents."""

import os
import json
from typing import List, Dict, Any
from agents import Agent, Runner, function_tool, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import AGENT_CONFIGS, API_KEYS, HANDOFF_DIR, SUPPORTED_EXTENSIONS, SKIP_DIRECTORIES
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


# Define function tools for the agent
@function_tool
def tool_list_directory(path: str, recursive: bool = False) -> str:
    """
    List files and directories at the given path.

    Args:
        path: Directory path to list
        recursive: If True, list all files recursively

    Returns:
        JSON string with file listing
    """
    return list_directory(path, recursive)


@function_tool
def tool_get_file_structure(path: str, max_depth: int = 4) -> str:
    """
    Get a tree-like structure of the directory.

    Args:
        path: Root directory
        max_depth: Maximum depth to traverse

    Returns:
        String representation of directory tree
    """
    return get_file_structure(path, max_depth)


@function_tool
def tool_check_language_tools(path: str) -> str:
    """
    Check what language/build tools are available in the repository.

    Args:
        path: Repository path

    Returns:
        JSON string with detected tools and configurations
    """
    return check_language_tools(path)


@function_tool
def tool_read_file(path: str, max_lines: int = None) -> str:
    """
    Read the contents of a file.

    Args:
        path: Path to the file to read
        max_lines: Optional maximum number of lines to read

    Returns:
        File contents as string, or error message
    """
    return read_file(path, max_lines)


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
            tool_list_directory,
            tool_get_file_structure,
            tool_check_language_tools,
            tool_read_file,
        ],
        output_type=DiscoveryHandoff,
    )

    return agent


def classify_files_locally(path: str) -> List[FileClassification]:
    """
    Locally classify files without LLM calls for efficiency.

    Args:
        path: Repository path

    Returns:
        List of file classifications
    """
    classifications = []

    for root, dirs, files in os.walk(path):
        # Skip unwanted directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRECTORIES and not d.startswith('.')]

        for file in files:
            if file.startswith('.'):
                continue

            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, path)
            ext = os.path.splitext(file)[1].lower()
            name = file.lower()

            # Determine file type
            if ext in {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs',
                       '.rb', '.php', '.cs', '.cpp', '.c', '.swift', '.kt', '.scala'}:
                file_type = FileType.SOURCE_CODE
            elif ext in {'.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.env', '.conf'}:
                file_type = FileType.CONFIG
            elif ext in {'.md', '.rst', '.txt'} or name in {'readme', 'changelog', 'license', 'contributing'}:
                file_type = FileType.DOCUMENTATION
            elif 'test' in name or 'spec' in name or '_test.' in name or '.test.' in name:
                file_type = FileType.TEST
            elif ext in {'.sql', '.csv', '.parquet', '.sqlite', '.db'}:
                file_type = FileType.DATA
            elif name in {'makefile', 'dockerfile', 'jenkinsfile', 'cmakelists.txt'} or ext in {'.mk', '.cmake'}:
                file_type = FileType.BUILD
            else:
                file_type = FileType.OTHER

            # Determine language
            lang_map = {
                '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
                '.jsx': 'javascript', '.tsx': 'typescript', '.java': 'java',
                '.go': 'go', '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
                '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c', '.swift': 'swift',
                '.kt': 'kotlin', '.scala': 'scala', '.sh': 'shell',
                '.bash': 'shell', '.zsh': 'shell'
            }
            language = lang_map.get(ext)

            # Determine importance
            importance = 5  # Default
            base_name = os.path.splitext(name)[0]

            if base_name in {'main', 'index', 'app', 'server', '__init__', '__main__'}:
                importance = 9
            elif base_name in {'setup', 'config', 'settings', 'constants'}:
                importance = 8
            elif 'test' in name or 'spec' in name:
                importance = 4
            elif file_type == FileType.DOCUMENTATION:
                importance = 6
            elif file_type == FileType.CONFIG:
                importance = 7
            elif ext not in SUPPORTED_EXTENSIONS:
                importance = 3

            classifications.append(FileClassification(
                path=rel_path,
                file_type=file_type,
                language=language,
                importance=importance,
                description=""
            ))

    return classifications


def detect_languages_and_frameworks(path: str) -> tuple[List[str], List[str], List[str]]:
    """
    Detect languages and frameworks from config files.

    Args:
        path: Repository path

    Returns:
        Tuple of (languages, frameworks, entry_points)
    """
    languages = set()
    frameworks = []
    entry_points = []

    # Check package.json
    package_json = os.path.join(path, 'package.json')
    if os.path.exists(package_json):
        try:
            with open(package_json) as f:
                data = json.load(f)
                languages.add('javascript')

                deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}
                if 'react' in deps:
                    frameworks.append('React')
                if 'vue' in deps:
                    frameworks.append('Vue')
                if 'express' in deps:
                    frameworks.append('Express')
                if 'next' in deps:
                    frameworks.append('Next.js')
                if 'typescript' in deps:
                    languages.add('typescript')

                if data.get('main'):
                    entry_points.append(data['main'])
        except:
            pass

    # Check requirements.txt / pyproject.toml
    req_txt = os.path.join(path, 'requirements.txt')
    pyproject = os.path.join(path, 'pyproject.toml')
    setup_py = os.path.join(path, 'setup.py')

    if os.path.exists(req_txt) or os.path.exists(pyproject) or os.path.exists(setup_py):
        languages.add('python')

        for req_file in [req_txt]:
            if os.path.exists(req_file):
                try:
                    with open(req_file) as f:
                        content = f.read().lower()
                        if 'django' in content:
                            frameworks.append('Django')
                        if 'flask' in content:
                            frameworks.append('Flask')
                        if 'fastapi' in content:
                            frameworks.append('FastAPI')
                        if 'pytorch' in content or 'torch' in content:
                            frameworks.append('PyTorch')
                        if 'tensorflow' in content:
                            frameworks.append('TensorFlow')
                except:
                    pass

    # Check for entry points
    for entry in ['main.py', 'app.py', 'server.py', 'index.py', 'run.py',
                  'src/main.py', 'src/index.py', 'src/app.py',
                  'main.js', 'index.js', 'app.js', 'server.js',
                  'src/main.js', 'src/index.js', 'src/app.js',
                  'main.ts', 'index.ts', 'app.ts',
                  'src/main.ts', 'src/index.ts']:
        if os.path.exists(os.path.join(path, entry)):
            entry_points.append(entry)

    # Check go.mod
    if os.path.exists(os.path.join(path, 'go.mod')):
        languages.add('go')
        if os.path.exists(os.path.join(path, 'main.go')):
            entry_points.append('main.go')

    # Check Cargo.toml
    if os.path.exists(os.path.join(path, 'Cargo.toml')):
        languages.add('rust')
        if os.path.exists(os.path.join(path, 'src/main.rs')):
            entry_points.append('src/main.rs')

    return list(languages), frameworks, entry_points


def build_directory_structure(path: str, max_depth: int = 3) -> Dict[str, Any]:
    """
    Build a nested dictionary representing directory structure.

    Args:
        path: Repository path
        max_depth: Maximum depth

    Returns:
        Dictionary with directory structure
    """
    def build_tree(current_path: str, depth: int = 0) -> Dict[str, Any]:
        if depth > max_depth:
            return {"...": "truncated"}

        result = {}
        try:
            items = sorted(os.listdir(current_path))
        except PermissionError:
            return {}

        for item in items:
            if item.startswith('.') or item in SKIP_DIRECTORIES:
                continue

            full_path = os.path.join(current_path, item)
            if os.path.isdir(full_path):
                result[item + "/"] = build_tree(full_path, depth + 1)
            else:
                result[item] = os.path.getsize(full_path)

        return result

    return build_tree(path)


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

    from doc_agents.subagent_coordinator import (
        SubagentCoordinator,
        reconcile_explorations,
        synthesize_explorations
    )

    coordinator = SubagentCoordinator(max_concurrent=5)

    # Phase 1: Quick local scan to identify directories and files
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

    # Phase 2: Local file classification (needed for handoff structure)
    print("  Classifying files locally...")
    files = classify_files_locally(repository_path)
    languages, frameworks, entry_points = detect_languages_and_frameworks(repository_path)

    # Add languages from file classifications
    for f in files:
        if f.language and f.language not in languages:
            languages.append(f.language)

    # Phase 3: Build directory structure
    directory_structure = build_directory_structure(repository_path)

    # Phase 4: Spawn subagents to explore each directory with LLM
    print(f"  Spawning {min(len(directories), 15)} subagents to explore directories...")

    # Create tools for exploration agents
    exploration_tools = [
        tool_list_directory,
        tool_get_file_structure,
        tool_check_language_tools,
        tool_read_file,
    ]

    exploration_results = await coordinator.explore_directories(
        directories[:15],  # Limit to top 15 directories for cost control
        repository_path,
        config.model,
        API_KEYS["xai"],
        tools=exploration_tools
    )

    # Phase 5: Reconcile findings from all explorations
    print("  Reconciling exploration findings...")
    reconciled = reconcile_explorations(exploration_results)

    # Add any patterns found to frameworks
    for pattern in reconciled.get("patterns", []):
        if pattern not in frameworks:
            frameworks.append(f"{pattern} Pattern")

    # Phase 6: Use master agent to synthesize overall understanding
    print("  Synthesizing overall repository understanding with LLM...")
    summary = await synthesize_explorations(
        reconciled,
        repository_path,
        config.model,
        API_KEYS["xai"]
    )

    # Create handoff document
    handoff = DiscoveryHandoff(
        repository_path=repository_path,
        total_files=len(files),
        files=files,
        directory_structure=directory_structure,
        detected_languages=languages,
        detected_frameworks=frameworks,
        entry_points=entry_points,
        summary=summary
    )

    # Save handoff document
    os.makedirs(HANDOFF_DIR, exist_ok=True)
    handoff_path = os.path.join(HANDOFF_DIR, "discovery_handoff.json")
    with open(handoff_path, 'w') as f:
        f.write(handoff.model_dump_json(indent=2))

    # Also save raw exploration results for later phases
    exploration_path = os.path.join(HANDOFF_DIR, "exploration_results.json")
    with open(exploration_path, 'w') as f:
        json.dump(reconciled, f, indent=2, default=str)

    successful = len([r for r in exploration_results if r.success])
    print(f"  Discovery complete: {successful}/{len(exploration_results)} explorations succeeded")

    return handoff
