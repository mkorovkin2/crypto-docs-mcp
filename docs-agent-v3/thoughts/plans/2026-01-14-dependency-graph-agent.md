# Dependency Graph Generator Agent - Implementation Plan

## Overview

Add a new agent to the documentation pipeline that generates a comprehensive dependency graph by writing, testing, and executing a Python script. The agent uses Claude Opus 4.5 and outputs relationship data to a CSV file.

**Key Design Principle**: The agent starts from a **reference template** that shows the expected structure and flow. The agent CAN and SHOULD modify the template based on:
- The repository's primary language(s) (Python, JS/TS, Go, Rust, etc.)
- Repo structure discovered by earlier agents
- Knowledge from discovery, file analysis, and module analysis phases
- Language-specific import patterns and AST requirements

The agent keeps the **overall logic flow** the same (find files → extract deps → write CSV) but adapts the implementation details for the specific codebase.

## Current State Analysis

### Existing Agent Pattern (from `doc_agents/file_analyzer.py`):
- Agent defined with `*_INSTRUCTIONS` system prompt
- `@function_tool` decorated tools for agent capabilities
- `create_*_agent()` factory function
- `run_*()` async entry point
- Uses `SubagentCoordinator` for parallel execution
- Pydantic models for structured outputs
- Results saved to `HANDOFF_DIR`

### Integration Point:
The orchestrator (`doc_agents/orchestrator.py`) runs phases sequentially. This will be added as **Phase 7** after FAQ generation, using data from earlier phases.

### Key Input: Earlier Phase Handoffs
The agent receives knowledge from previous phases:
- **DiscoveryHandoff**: Languages, frameworks, file structure, entry points
- **FileAnalysisHandoff[]**: Per-file imports, classes, functions, dependencies
- **ModuleAnalysisHandoff**: Module relationships, architecture patterns, dependency graph

## Desired End State

After implementation:
1. Running `python main.py /path/to/repo` includes a new "Dependency Graph Generation" phase
2. A `setup_depgraph.sh` script exists that creates an isolated venv for the generated script
3. The agent reads a **reference template** and adapts it for the specific repo
4. The script extracts: module imports, class inheritance, function calls, type references
5. Output: `output/dependency_graph.csv` with the specified format
6. The agent can debug and fix script issues through a defined process

### Verification:
- `output/dependency_graph.csv` exists and contains valid data
- The CSV has columns: `source_file,source_entity,target_file,target_entity,relationship_type,line_number`
- No Python errors in the execution log

## What We're NOT Doing

- NOT writing scripts from absolute scratch (always starts from template)
- NOT creating a standalone CLI tool (integrated into pipeline)
- NOT generating visualization (just CSV data)
- NOT requiring external dependencies beyond Python stdlib (keeps venv simple)

## Implementation Approach

### Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DependencyGraphAgent                          │
│                                                                  │
│  INPUTS:                                                        │
│  ├─ Reference template (Python example)                         │
│  ├─ DiscoveryHandoff (languages, structure)                     │
│  ├─ FileAnalysisHandoff[] (per-file analysis)                   │
│  └─ ModuleAnalysisHandoff (architecture)                        │
│                                                                  │
│  PROCESS:                                                       │
│  1. setup_depgraph.sh    - Creates isolated venv                │
│  2. Read template        - Understand expected structure        │
│  3. Adapt for repo       - Modify for language/structure        │
│  4. Write script         - Full script (not just config)        │
│  5. Test & debug         - Iterative fixing                     │
│  6. Execute & verify     - Run and check output                 │
│                                                                  │
│  OUTPUT:                                                        │
│  └─ dependency_graph.csv                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Script Template Design

The template is a **reference implementation for Python** that shows:
- Expected data structures (DependencyEdge dataclass)
- Required flow (find files → parse → extract → write CSV)
- CSV output format
- Error handling patterns

The agent CAN modify:
- Import statements (add language-specific parsers)
- File discovery logic (different extensions, patterns)
- Extraction logic (different AST for JS/TS/Go, regex for others)
- Any section needed to make it work for the target repo

The agent SHOULD preserve:
- Overall flow structure
- CSV output format (columns must match)
- Error handling patterns
- Progress reporting

---

## Phase 1: Create Static Setup Script

### Overview
Create `setup_depgraph.sh` that reliably creates and activates a venv for the dependency graph script.

### Changes Required:

#### 1. New File: `scripts/setup_depgraph.sh`
**File**: `scripts/setup_depgraph.sh`

```bash
#!/bin/bash
# Dependency Graph Generator - Environment Setup
# This script creates an isolated venv for the dependency extraction script

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/output/.depgraph_venv"
SCRIPT_OUTPUT="$PROJECT_ROOT/output/extract_dependencies.py"

echo "=== Dependency Graph Environment Setup ==="
echo "Project root: $PROJECT_ROOT"
echo "Venv directory: $VENV_DIR"

# Step 1: Clean any existing venv
if [ -d "$VENV_DIR" ]; then
    echo "Removing existing venv..."
    rm -rf "$VENV_DIR"
fi

# Step 2: Create fresh venv
echo "Creating virtual environment..."
python3 -m venv "$VENV_DIR"

# Step 3: Activate venv
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Step 4: Upgrade pip (suppress warnings)
echo "Upgrading pip..."
pip install --upgrade pip --quiet

# Step 5: Install minimal dependencies (only stdlib needed, but ensure pip works)
echo "Verifying Python environment..."
python3 -c "import ast; import csv; import os; print('Core modules available')"

# Step 6: Create output directory structure
mkdir -p "$PROJECT_ROOT/output"

echo ""
echo "=== Setup Complete ==="
echo "To activate: source $VENV_DIR/bin/activate"
echo "Script will be written to: $SCRIPT_OUTPUT"
echo ""

# Export variables for the agent
export DEPGRAPH_VENV="$VENV_DIR"
export DEPGRAPH_SCRIPT="$SCRIPT_OUTPUT"
export DEPGRAPH_OUTPUT="$PROJECT_ROOT/output/dependency_graph.csv"
```

### Success Criteria:

#### Automated Verification:
- [ ] Script exists at `scripts/setup_depgraph.sh`
- [ ] Script is executable: `chmod +x scripts/setup_depgraph.sh`
- [ ] Script runs without error: `./scripts/setup_depgraph.sh`
- [ ] Venv created at `output/.depgraph_venv/`

#### Manual Verification:
- [ ] Running the script produces clear output showing each step
- [ ] The venv can be activated manually

---

## Phase 2: Create Reference Template

### Overview
Create a **reference template** that demonstrates the expected structure and flow. The agent reads this template and adapts it based on the repository's language and structure. The template is a Python example that the agent can modify as needed.

### Changes Required:

#### 1. New File: `templates/dependency_extractor_template.py`
**File**: `templates/dependency_extractor_template.py`

```python
#!/usr/bin/env python3
"""
Dependency Graph Extractor - REFERENCE TEMPLATE
================================================

This is a REFERENCE IMPLEMENTATION for Python codebases.

The DependencyGraphAgent should:
1. READ this template to understand the expected structure
2. ADAPT it for the target repository's language(s) and structure
3. KEEP the overall flow: find files → extract deps → write CSV
4. KEEP the CSV output format (columns must match)
5. MODIFY extraction logic as needed for the specific language

SECTIONS YOU MAY NEED TO MODIFY:
- CONFIGURATION: Paths, skip directories, file extensions
- LANGUAGE HANDLERS: Add handlers for JS/TS, Go, Rust, etc.
- FILE DISCOVERY: Adjust patterns for the repo structure
- EXTRACTION LOGIC: Language-specific AST or regex patterns

SECTIONS TO PRESERVE:
- DependencyEdge dataclass (keep fields the same)
- CSV output format (column order matters)
- Main flow structure
- Error handling patterns
"""

import ast
import csv
import os
import sys
from dataclasses import dataclass
from typing import List, Set, Dict, Optional
from pathlib import Path

# ============================================================================
# SECTION 1: DATA STRUCTURES (PRESERVE - keep field names for CSV compatibility)
# ============================================================================

@dataclass
class DependencyEdge:
    """A single dependency relationship."""
    source_file: str
    source_entity: str
    target_file: str
    target_entity: str
    relationship_type: str
    line_number: int


# ============================================================================
# SECTION 2: CONFIGURATION (MODIFY - set these for target repo)
# ============================================================================

# TARGET_DIRECTORY: The root directory to analyze
# Agent should set this to the actual repository path
TARGET_DIRECTORY = "/path/to/repository"

# OUTPUT_CSV_PATH: Where to write the dependency graph
OUTPUT_CSV_PATH = "/path/to/output/dependency_graph.csv"

# SKIP_DIRECTORIES: Directories to skip during analysis
# Agent should add repo-specific directories (e.g., vendor, dist, etc.)
SKIP_DIRECTORIES = {
    "venv", "__pycache__", ".git", "node_modules", ".venv", "dist", "build"
}

# FILE_EXTENSIONS: File extensions to analyze
# Agent should modify based on detected languages
# Python: {".py"}
# JavaScript/TypeScript: {".js", ".ts", ".jsx", ".tsx"}
# Go: {".go"}
# Multiple: {".py", ".js", ".ts"}
FILE_EXTENSIONS = {".py"}


# ============================================================================
# SECTION 3: EXTRACTION LOGIC (MODIFY - adapt for target language)
# ============================================================================
#
# This section contains Python-specific extraction using the `ast` module.
#
# FOR OTHER LANGUAGES, the agent should:
# - JavaScript/TypeScript: Use regex or a JS parser approach
# - Go: Use regex to find import blocks and type definitions
# - Rust: Use regex for `use` statements and `impl` blocks
# - Or use subprocess to call language-specific tools if available
#
# The extraction should identify:
# - imports/imports_from: Module dependencies
# - extends: Class inheritance
# - calls: Function/method calls
# - uses_type: Type annotations and references

class DependencyExtractor(ast.NodeVisitor):
    """AST visitor that extracts dependency relationships (Python-specific)."""

    def __init__(self, file_path: str, base_path: str):
        self.file_path = file_path
        self.base_path = base_path
        self.relative_path = os.path.relpath(file_path, base_path)
        self.edges: List[DependencyEdge] = []
        self.current_class: Optional[str] = None
        self.current_function: Optional[str] = None

    def _add_edge(self, source_entity: str, target_file: str, target_entity: str,
                  rel_type: str, line_number: int):
        """Add a dependency edge."""
        self.edges.append(DependencyEdge(
            source_file=self.relative_path,
            source_entity=source_entity,
            target_file=target_file,
            target_entity=target_entity,
            relationship_type=rel_type,
            line_number=line_number
        ))

    def visit_Import(self, node: ast.Import):
        """Handle: import x, import x.y"""
        for alias in node.names:
            module_name = alias.name
            self._add_edge(
                source_entity="<module>",
                target_file=self._module_to_file(module_name),
                target_entity=module_name,
                rel_type="imports",
                line_number=node.lineno
            )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        """Handle: from x import y"""
        module = node.module or ""
        level = node.level  # Number of dots for relative imports

        for alias in node.names:
            name = alias.name
            self._add_edge(
                source_entity="<module>",
                target_file=self._module_to_file(module, level),
                target_entity=f"{module}.{name}" if module else name,
                rel_type="imports_from",
                line_number=node.lineno
            )
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef):
        """Handle class definitions and inheritance."""
        old_class = self.current_class
        self.current_class = node.name

        # Extract base classes (inheritance)
        for base in node.bases:
            base_name = self._get_name(base)
            if base_name:
                self._add_edge(
                    source_entity=node.name,
                    target_file="<inherited>",
                    target_entity=base_name,
                    rel_type="extends",
                    line_number=node.lineno
                )

        self.generic_visit(node)
        self.current_class = old_class

    def visit_FunctionDef(self, node: ast.FunctionDef):
        """Handle function definitions."""
        old_function = self.current_function
        self.current_function = node.name

        # Extract type annotations
        self._extract_annotations(node)

        self.generic_visit(node)
        self.current_function = old_function

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        """Handle async function definitions."""
        self.visit_FunctionDef(node)  # Same logic

    def visit_Call(self, node: ast.Call):
        """Handle function calls."""
        func_name = self._get_name(node.func)
        if func_name:
            context = self.current_class or self.current_function or "<module>"
            self._add_edge(
                source_entity=context,
                target_file="<called>",
                target_entity=func_name,
                rel_type="calls",
                line_number=node.lineno
            )
        self.generic_visit(node)

    def _extract_annotations(self, node: ast.FunctionDef):
        """Extract type annotations from function."""
        context = f"{self.current_class}.{node.name}" if self.current_class else node.name

        # Return annotation
        if node.returns:
            type_name = self._get_name(node.returns)
            if type_name and not self._is_builtin(type_name):
                self._add_edge(
                    source_entity=context,
                    target_file="<type>",
                    target_entity=type_name,
                    rel_type="uses_type",
                    line_number=node.lineno
                )

        # Parameter annotations
        for arg in node.args.args + node.args.kwonlyargs:
            if arg.annotation:
                type_name = self._get_name(arg.annotation)
                if type_name and not self._is_builtin(type_name):
                    self._add_edge(
                        source_entity=context,
                        target_file="<type>",
                        target_entity=type_name,
                        rel_type="uses_type",
                        line_number=node.lineno
                    )

    def _get_name(self, node) -> Optional[str]:
        """Extract name from various AST node types."""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            value = self._get_name(node.value)
            if value:
                return f"{value}.{node.attr}"
            return node.attr
        elif isinstance(node, ast.Subscript):
            return self._get_name(node.value)
        elif isinstance(node, ast.Constant):
            return str(node.value)
        return None

    def _module_to_file(self, module: str, level: int = 0) -> str:
        """Convert module name to potential file path."""
        if level > 0:
            return f"<relative:{level}>.{module}" if module else f"<relative:{level}>"
        return module.replace(".", "/") + ".py" if module else "<unknown>"

    def _is_builtin(self, name: str) -> bool:
        """Check if a type name is a Python builtin."""
        builtins = {
            "str", "int", "float", "bool", "list", "dict", "set", "tuple",
            "None", "Any", "Optional", "List", "Dict", "Set", "Tuple",
            "Union", "Callable", "Type", "TypeVar", "Generic"
        }
        return name.split(".")[0] in builtins


# ============================================================================
# SECTION 4: MAIN LOGIC (PRESERVE FLOW - modify function names/details as needed)
# ============================================================================
#
# The main flow should be preserved:
# 1. Find files matching the target extensions
# 2. For each file, extract dependencies
# 3. Collect all edges
# 4. Write to CSV
# 5. Print summary
#
# The agent can rename functions, adjust file discovery, etc.
# but should keep this overall structure.

def find_source_files(directory: str) -> List[str]:
    """Find all source files in directory, respecting skip list."""
    python_files = []

    for root, dirs, files in os.walk(directory):
        # Remove skip directories from dirs to prevent walking into them
        dirs[:] = [d for d in dirs if d not in SKIP_DIRECTORIES]

        for file in files:
            if any(file.endswith(ext) for ext in FILE_EXTENSIONS):
                python_files.append(os.path.join(root, file))

    return python_files


def extract_from_file(file_path: str, base_path: str) -> List[DependencyEdge]:
    """Extract dependencies from a single file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        tree = ast.parse(content, filename=file_path)
        extractor = DependencyExtractor(file_path, base_path)
        extractor.visit(tree)
        return extractor.edges

    except SyntaxError as e:
        print(f"Syntax error in {file_path}: {e}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"Error processing {file_path}: {e}", file=sys.stderr)
        return []


def write_csv(edges: List[DependencyEdge], output_path: str):
    """Write dependency edges to CSV file."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'source_file', 'source_entity', 'target_file',
            'target_entity', 'relationship_type', 'line_number'
        ])

        for edge in edges:
            writer.writerow([
                edge.source_file,
                edge.source_entity,
                edge.target_file,
                edge.target_entity,
                edge.relationship_type,
                edge.line_number
            ])


def main():
    """Main entry point."""
    print(f"=== Dependency Graph Extractor ===")
    print(f"Target directory: {TARGET_DIRECTORY}")
    print(f"Output CSV: {OUTPUT_CSV_PATH}")
    print()

    # Validate target directory
    if not os.path.isdir(TARGET_DIRECTORY):
        print(f"ERROR: Target directory does not exist: {TARGET_DIRECTORY}", file=sys.stderr)
        sys.exit(1)

    # Find all source files
    print("Finding source files...")
    files = find_source_files(TARGET_DIRECTORY)
    print(f"Found {len(files)} Python files")

    # Extract dependencies
    print("Extracting dependencies...")
    all_edges = []
    for i, file_path in enumerate(files):
        edges = extract_from_file(file_path, TARGET_DIRECTORY)
        all_edges.extend(edges)
        if (i + 1) % 10 == 0:
            print(f"  Processed {i + 1}/{len(files)} files...")

    print(f"Extracted {len(all_edges)} dependency relationships")

    # Write output
    print(f"Writing to {OUTPUT_CSV_PATH}...")
    write_csv(all_edges, OUTPUT_CSV_PATH)

    print()
    print("=== Complete ===")
    print(f"Output written to: {OUTPUT_CSV_PATH}")

    # Print summary by relationship type
    rel_counts = {}
    for edge in all_edges:
        rel_counts[edge.relationship_type] = rel_counts.get(edge.relationship_type, 0) + 1

    print()
    print("Relationship summary:")
    for rel_type, count in sorted(rel_counts.items()):
        print(f"  {rel_type}: {count}")


if __name__ == "__main__":
    main()
```

### Success Criteria:

#### Automated Verification:
- [ ] Template file exists at `templates/dependency_extractor_template.py`
- [ ] Template is valid Python: `python3 -m py_compile templates/dependency_extractor_template.py`
- [ ] Template has section markers for CONFIGURATION, EXTRACTION LOGIC, MAIN LOGIC

#### Manual Verification:
- [ ] Template structure is clear with guidance comments
- [ ] Each section clearly indicates what can/should be modified
- [ ] CSV output format is clearly documented

---

## Phase 3: Create Pydantic Models

### Overview
Create structured models for the dependency graph data and agent outputs.

### Changes Required:

#### 1. New File: `models/dependency_graph.py`
**File**: `models/dependency_graph.py`

```python
"""Pydantic models for dependency graph generation."""

from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum


class RelationshipType(str, Enum):
    """Types of dependency relationships."""
    IMPORTS = "imports"
    IMPORTS_FROM = "imports_from"
    EXTENDS = "extends"
    CALLS = "calls"
    USES_TYPE = "uses_type"


class DependencyEdge(BaseModel):
    """A single dependency relationship."""
    source_file: str = Field(description="Relative path to source file")
    source_entity: str = Field(description="Class, function, or <module>")
    target_file: str = Field(description="Target file or <inherited>/<called>/<type>")
    target_entity: str = Field(description="Target class, function, or module")
    relationship_type: str = Field(description="Type of relationship")
    line_number: int = Field(description="Line number in source file")


class ScriptConfiguration(BaseModel):
    """Configuration that the agent fills into the template."""
    target_directory: str = Field(description="Absolute path to analyze")
    output_csv_path: str = Field(description="Absolute path for output CSV")
    skip_directories: List[str] = Field(
        default_factory=lambda: ["venv", "__pycache__", ".git", "node_modules"],
        description="Directories to skip"
    )


class ScriptExecutionResult(BaseModel):
    """Result of running the dependency extraction script."""
    success: bool
    script_path: str
    output_csv_path: Optional[str] = None
    stdout: str = ""
    stderr: str = ""
    error_message: Optional[str] = None
    edge_count: int = 0


class DependencyGraphHandoff(BaseModel):
    """Handoff document from Dependency Graph Generator Agent."""
    repository_path: str
    script_path: str
    csv_output_path: str
    total_files_analyzed: int
    total_edges: int
    edges_by_type: dict = Field(default_factory=dict)
    execution_log: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
```

#### 2. Update `models/__init__.py`
**File**: `models/__init__.py`
**Changes**: Add exports for new models

```python
# Add to existing exports:
from .dependency_graph import (
    DependencyEdge,
    ScriptConfiguration,
    ScriptExecutionResult,
    DependencyGraphHandoff,
    RelationshipType,
)
```

### Success Criteria:

#### Automated Verification:
- [ ] File exists at `models/dependency_graph.py`
- [ ] Python can import the models: `python -c "from models.dependency_graph import *"`

#### Manual Verification:
- [ ] Models accurately represent the domain

---

## Phase 4: Create Script Execution Tools

### Overview
Create tools that the agent uses to:
1. Read the reference template
2. Write a complete, adapted script
3. Execute and debug the generated script
4. Verify the output

The key difference from a simple "fill-in-the-blanks" approach: the agent reads the template, adapts it based on repo knowledge, and writes the complete script.

### Changes Required:

#### 1. New File: `tools/script_tools.py`
**File**: `tools/script_tools.py`

```python
"""Script execution and debugging tools for agents."""

import os
import subprocess
import json
import shutil
from typing import Optional

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import OUTPUT_DIR


def setup_script_environment() -> str:
    """
    Run setup_depgraph.sh to create the script execution environment.

    Returns:
        JSON string with setup result
    """
    script_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "scripts",
        "setup_depgraph.sh"
    )

    if not os.path.exists(script_path):
        return json.dumps({
            "success": False,
            "error": f"Setup script not found: {script_path}"
        })

    try:
        result = subprocess.run(
            ["bash", script_path],
            capture_output=True,
            text=True,
            timeout=60
        )

        return json.dumps({
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "venv_path": os.path.join(OUTPUT_DIR, ".depgraph_venv"),
            "script_output_path": os.path.join(OUTPUT_DIR, "extract_dependencies.py")
        })

    except subprocess.TimeoutExpired:
        return json.dumps({
            "success": False,
            "error": "Setup script timed out after 60 seconds"
        })
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        })


def read_template() -> str:
    """
    Read the reference template for the agent to study and adapt.

    Returns:
        JSON string with template content or error
    """
    template_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "templates",
        "dependency_extractor_template.py"
    )

    if not os.path.exists(template_path):
        return json.dumps({
            "success": False,
            "error": f"Template not found: {template_path}"
        })

    try:
        with open(template_path, 'r') as f:
            content = f.read()

        return json.dumps({
            "success": True,
            "template_path": template_path,
            "content": content,
            "line_count": len(content.split('\n'))
        })

    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        })


def write_script(script_content: str) -> str:
    """
    Write the complete dependency extraction script.

    The agent should adapt the template based on repo knowledge and write
    the full script content here.

    Args:
        script_content: The complete Python script to write

    Returns:
        JSON string with result
    """
    output_script_path = os.path.join(OUTPUT_DIR, "extract_dependencies.py")

    try:
        # Ensure output directory exists
        os.makedirs(OUTPUT_DIR, exist_ok=True)

        with open(output_script_path, 'w') as f:
            f.write(script_content)

        return json.dumps({
            "success": True,
            "script_path": output_script_path,
            "line_count": len(script_content.split('\n'))
        })

    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        })


def read_script() -> str:
    """
    Read the current generated script (for debugging/iteration).

    Returns:
        JSON string with script content or error
    """
    script_path = os.path.join(OUTPUT_DIR, "extract_dependencies.py")

    if not os.path.exists(script_path):
        return json.dumps({
            "success": False,
            "error": f"Script not found: {script_path}"
        })

    try:
        with open(script_path, 'r') as f:
            content = f.read()

        return json.dumps({
            "success": True,
            "script_path": script_path,
            "content": content,
            "line_count": len(content.split('\n'))
        })

    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        })


def execute_script(script_path: Optional[str] = None) -> str:
    """
    Execute the dependency extraction script in the prepared venv.

    Args:
        script_path: Path to script (defaults to output/extract_dependencies.py)

    Returns:
        JSON string with execution result
    """
    if script_path is None:
        script_path = os.path.join(OUTPUT_DIR, "extract_dependencies.py")

    venv_python = os.path.join(OUTPUT_DIR, ".depgraph_venv", "bin", "python3")

    if not os.path.exists(script_path):
        return json.dumps({
            "success": False,
            "error": f"Script not found: {script_path}"
        })

    if not os.path.exists(venv_python):
        return json.dumps({
            "success": False,
            "error": f"Venv Python not found: {venv_python}. Run setup_script_environment first."
        })

    try:
        result = subprocess.run(
            [venv_python, script_path],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout for large repos
        )

        # Check if output CSV was created
        output_csv = None
        for line in result.stdout.split('\n'):
            if 'Output written to:' in line:
                output_csv = line.split('Output written to:')[-1].strip()

        return json.dumps({
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "output_csv": output_csv
        })

    except subprocess.TimeoutExpired:
        return json.dumps({
            "success": False,
            "error": "Script execution timed out after 5 minutes"
        })
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        })


def validate_script_syntax(script_path: Optional[str] = None) -> str:
    """
    Validate Python syntax of the generated script without executing it.

    Args:
        script_path: Path to script to validate

    Returns:
        JSON string with validation result
    """
    if script_path is None:
        script_path = os.path.join(OUTPUT_DIR, "extract_dependencies.py")

    if not os.path.exists(script_path):
        return json.dumps({
            "success": False,
            "error": f"Script not found: {script_path}"
        })

    try:
        with open(script_path, 'r') as f:
            content = f.read()

        # Try to compile
        compile(content, script_path, 'exec')

        return json.dumps({
            "success": True,
            "message": "Script syntax is valid"
        })

    except SyntaxError as e:
        return json.dumps({
            "success": False,
            "error": f"Syntax error at line {e.lineno}: {e.msg}",
            "line_number": e.lineno,
            "offset": e.offset,
            "text": e.text
        })
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        })


def read_csv_summary(csv_path: Optional[str] = None) -> str:
    """
    Read the generated CSV and return a summary.

    Args:
        csv_path: Path to CSV file

    Returns:
        JSON string with summary statistics
    """
    if csv_path is None:
        csv_path = os.path.join(OUTPUT_DIR, "dependency_graph.csv")

    if not os.path.exists(csv_path):
        return json.dumps({
            "success": False,
            "error": f"CSV file not found: {csv_path}"
        })

    try:
        import csv as csv_module

        with open(csv_path, 'r') as f:
            reader = csv_module.DictReader(f)
            rows = list(reader)

        # Compute statistics
        rel_counts = {}
        source_files = set()

        for row in rows:
            rel_type = row.get('relationship_type', 'unknown')
            rel_counts[rel_type] = rel_counts.get(rel_type, 0) + 1
            source_files.add(row.get('source_file', ''))

        return json.dumps({
            "success": True,
            "total_edges": len(rows),
            "unique_source_files": len(source_files),
            "relationships_by_type": rel_counts,
            "csv_path": csv_path
        })

    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        })
```

#### 2. Update `tools/__init__.py`
**File**: `tools/__init__.py`
**Changes**: Add exports for new tools

```python
# Add to existing imports:
from .script_tools import (
    setup_script_environment,
    read_template,
    write_script,
    read_script,
    execute_script,
    validate_script_syntax,
    read_csv_summary,
)

# Add to __all__:
__all__ = [
    # ... existing exports ...
    'setup_script_environment',
    'read_template',
    'write_script',
    'read_script',
    'execute_script',
    'validate_script_syntax',
    'read_csv_summary',
]
```

### Success Criteria:

#### Automated Verification:
- [ ] File exists at `tools/script_tools.py`
- [ ] Tools can be imported: `python -c "from tools.script_tools import *"`

#### Manual Verification:
- [ ] Each tool has clear docstrings
- [ ] Error handling is comprehensive

---

## Phase 5: Create the Dependency Graph Agent

### Overview
Create the agent that reads the template, adapts it based on repository knowledge, writes the script, tests it, and iterates until it works.

### Changes Required:

#### 1. Update `config.py`
**File**: `config.py`
**Changes**: Add agent configuration for dependency graph generator using Claude Opus 4.5

```python
# Add to MODELS dict:
MODELS = {
    # ... existing models ...
    "claude_opus": "anthropic/claude-opus-4-5-20251101",  # For complex script generation
}

# Add to AGENT_CONFIGS dict:
AGENT_CONFIGS = {
    # ... existing configs ...
    "dependency_graph": AgentConfig(
        name="DependencyGraphAgent",
        model=MODELS["claude_opus"],  # Uses Claude Opus 4.5
        temperature=0.3,  # Slightly higher for creative adaptation
        max_tokens=16384,  # Larger for full script generation
    ),
}
```

#### 2. New File: `doc_agents/dependency_graph_generator.py`
**File**: `doc_agents/dependency_graph_generator.py`

```python
"""Dependency Graph Generator Agent - Generates dependency extraction scripts."""

import os
import json
from typing import Optional, List
from agents import Agent, Runner, function_tool, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import AGENT_CONFIGS, API_KEYS, OUTPUT_DIR, HANDOFF_DIR
from models import DiscoveryHandoff, FileAnalysisHandoff, ModuleAnalysisHandoff
from models.dependency_graph import (
    DependencyGraphHandoff,
    ScriptConfiguration,
    ScriptExecutionResult,
)
from tools.script_tools import (
    setup_script_environment,
    read_template,
    write_script,
    read_script,
    execute_script,
    validate_script_syntax,
    read_csv_summary,
)


# ============================================================================
# AGENT INSTRUCTIONS - TEMPLATE-GUIDED WITH ADAPTATION
# ============================================================================

DEPENDENCY_GRAPH_INSTRUCTIONS = """You are a Dependency Graph Generator Agent.

YOUR TASK: Generate a dependency extraction script that analyzes a codebase and outputs
a CSV file with dependency relationships.

## APPROACH
You start from a REFERENCE TEMPLATE and ADAPT it based on:
1. The repository's detected language(s)
2. The repository structure discovered by earlier agents
3. Language-specific import patterns and dependency relationships

You MUST keep the overall flow the same:
- Find source files → Extract dependencies → Write CSV

You CAN and SHOULD modify:
- Configuration values (paths, skip directories, extensions)
- Extraction logic for the specific language(s)
- Import statements if needed
- File discovery patterns

You MUST preserve:
- The DependencyEdge dataclass field names (for CSV compatibility)
- The CSV output format (columns: source_file, source_entity, target_file, target_entity, relationship_type, line_number)
- Error handling patterns
- Progress reporting

## REQUIRED PROCESS

### STEP 1: Setup Environment
Call `tool_setup_environment()` to create the execution environment.
- If it fails, report the error and stop
- If it succeeds, proceed to Step 2

### STEP 2: Read Reference Template
Call `tool_read_template()` to get the reference implementation.
- Study the structure and understand each section
- Note: This is a Python example - adapt for other languages

### STEP 3: Analyze Repository Context
Review the repository information provided in your prompt:
- Primary language(s) detected
- Frameworks and libraries in use
- Directory structure
- Key file patterns

Decide what adaptations are needed:
- For Python repos: The template should work with minimal changes
- For JS/TS repos: Modify FILE_EXTENSIONS, add regex-based import extraction
- For Go repos: Modify for Go import patterns
- For mixed repos: Handle multiple languages

### STEP 4: Write Adapted Script
Call `tool_write_script(script_content)` with your adapted script.

Key adaptations to consider:
1. TARGET_DIRECTORY: Set to the actual repository path
2. OUTPUT_CSV_PATH: Set to the output directory + "dependency_graph.csv"
3. SKIP_DIRECTORIES: Add any repo-specific directories to skip
4. FILE_EXTENSIONS: Match the repository's language(s)
5. Extraction logic: Adapt for the target language(s)

### STEP 5: Validate Syntax
Call `tool_validate_syntax()` to check for Python syntax errors.
- If validation fails, read the error, fix your script, and try again
- Maximum 3 attempts

### STEP 6: Execute Script
Call `tool_execute_script()` to run the dependency extraction.
- If execution succeeds, proceed to Step 7
- If execution fails:
  1. Read the error message carefully
  2. Call `tool_read_script()` to see the current script
  3. Fix the issue and call `tool_write_script()` with the corrected version
  4. Retry execution
  5. Maximum 3 retry attempts

### STEP 7: Verify Output
Call `tool_read_summary()` to verify the CSV was created correctly.
- Report the summary statistics
- If total_edges is 0, consider if the extraction logic needs adjustment

## DEBUG PROCESS (if Step 6 fails)

When you encounter an error:
1. READ the full error message from stderr
2. IDENTIFY the error type:
   - SyntaxError: Fix Python syntax in the script
   - ImportError: A module is not available in stdlib - remove it
   - FileNotFoundError: Check paths are absolute and correct
   - AttributeError/TypeError: Fix the extraction logic
3. CALL `tool_read_script()` to see the current state
4. FIX the specific issue
5. CALL `tool_write_script()` with the corrected version
6. RETRY execution

## OUTPUT FORMAT
After completing all steps, provide a summary:
- Repository language(s) handled
- Total files analyzed
- Total dependency edges found
- Breakdown by relationship type
- Path to output CSV
- Any errors or warnings encountered
- What adaptations you made to the template

## CONSTRAINTS
- Use ONLY Python standard library modules (no pip install)
- Keep the script self-contained (no external dependencies)
- Preserve CSV column format for downstream compatibility
"""


# ============================================================================
# TOOL DEFINITIONS
# ============================================================================

@function_tool
def tool_setup_environment() -> str:
    """
    Set up the script execution environment (venv, directories).

    Call this FIRST before any other operations.

    Returns:
        JSON with setup result including venv_path and script_output_path
    """
    return setup_script_environment()


@function_tool
def tool_read_template() -> str:
    """
    Read the reference template to understand the expected structure.

    Call this AFTER setup to study the template before adapting it.

    Returns:
        JSON with template content, path, and line count
    """
    return read_template()


@function_tool
def tool_write_script(script_content: str) -> str:
    """
    Write the complete dependency extraction script.

    You should adapt the template based on the repository's language(s) and
    structure, then write the full script here.

    Args:
        script_content: The complete Python script to write

    Returns:
        JSON with script_path and line_count if successful, or error details
    """
    return write_script(script_content)


@function_tool
def tool_read_script() -> str:
    """
    Read the current generated script for debugging/iteration.

    Use this when execution fails to see what was written and identify issues.

    Returns:
        JSON with script content, path, and line count
    """
    return read_script()


@function_tool
def tool_validate_syntax() -> str:
    """
    Validate the syntax of the generated script without executing it.

    Call this AFTER tool_write_script and BEFORE tool_execute_script.

    Returns:
        JSON with success=True if valid, or syntax error details with line number
    """
    return validate_script_syntax()


@function_tool
def tool_execute_script() -> str:
    """
    Execute the dependency extraction script in the prepared environment.

    Call this AFTER tool_validate_syntax passes.

    Returns:
        JSON with stdout, stderr, returncode, and output_csv path
    """
    return execute_script()


@function_tool
def tool_read_summary() -> str:
    """
    Read and summarize the generated dependency graph CSV.

    Call this AFTER tool_execute_script succeeds to verify output.

    Returns:
        JSON with total_edges, unique_source_files, relationships_by_type
    """
    return read_csv_summary()


# ============================================================================
# AGENT FACTORY
# ============================================================================

def create_dependency_graph_agent() -> Agent:
    """Create the Dependency Graph Generator Agent."""
    config = AGENT_CONFIGS["dependency_graph"]

    return Agent(
        name=config.name,
        instructions=DEPENDENCY_GRAPH_INSTRUCTIONS,
        model=LitellmModel(
            model=config.model,
            api_key=API_KEYS["anthropic"]
        ),
        model_settings=ModelSettings(
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        ),
        tools=[
            tool_setup_environment,
            tool_read_template,
            tool_write_script,
            tool_read_script,
            tool_validate_syntax,
            tool_execute_script,
            tool_read_summary,
        ],
        output_type=DependencyGraphHandoff,
    )


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

async def run_dependency_graph_generation(
    discovery: DiscoveryHandoff,
    file_analyses: List[FileAnalysisHandoff] = None,
    module_analysis: ModuleAnalysisHandoff = None
) -> DependencyGraphHandoff:
    """
    Run dependency graph generation for a repository.

    Args:
        discovery: DiscoveryHandoff from discovery phase with repository info
        file_analyses: Optional list of FileAnalysisHandoff from file analysis phase
        module_analysis: Optional ModuleAnalysisHandoff from module analysis phase

    Returns:
        DependencyGraphHandoff with results
    """
    agent = create_dependency_graph_agent()

    # Build context from earlier phases
    languages = ', '.join(discovery.detected_languages) if discovery.detected_languages else "Unknown"
    frameworks = ', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else "None detected"

    # Extract key patterns from file analyses (NO TRUNCATION)
    file_patterns = []
    if file_analyses:
        # Collect all external dependencies
        external_deps = set()
        for fa in file_analyses:
            for imp in fa.imports:
                if imp.is_external:
                    external_deps.add(imp.module)
        if external_deps:
            file_patterns.append(f"External dependencies: {', '.join(sorted(external_deps))}")

        # Include file count by language
        lang_counts = {}
        for fa in file_analyses:
            lang = fa.language or "unknown"
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
        if lang_counts:
            file_patterns.append(f"Files by language: {', '.join(f'{lang}={count}' for lang, count in sorted(lang_counts.items()))}")

    # Extract architecture info from module analysis (NO TRUNCATION)
    arch_info = []
    if module_analysis:
        if module_analysis.architecture_patterns:
            arch_info.append(f"Architecture patterns: {', '.join(module_analysis.architecture_patterns)}")
        if module_analysis.modules:
            module_names = [m.name for m in module_analysis.modules]
            arch_info.append(f"Modules: {', '.join(module_names)}")
        if module_analysis.key_relationships:
            arch_info.append(f"Key relationships: {'; '.join(module_analysis.key_relationships)}")

    # Prepare the prompt with full repository context (NO TRUNCATION)
    prompt = f"""Generate a dependency graph for this repository:

## REPOSITORY INFO
- PATH: {discovery.repository_path}
- TOTAL FILES: {discovery.total_files}
- DETECTED LANGUAGES: {languages}
- FRAMEWORKS: {frameworks}
- ENTRY POINTS: {', '.join(discovery.entry_points) if discovery.entry_points else "None identified"}

## OUTPUT CONFIGURATION
- OUTPUT DIRECTORY: {OUTPUT_DIR}
- CSV OUTPUT PATH: {OUTPUT_DIR}/dependency_graph.csv

## CONTEXT FROM EARLIER ANALYSIS
{chr(10).join(file_patterns) if file_patterns else "No file analysis context available"}
{chr(10).join(arch_info) if arch_info else "No architecture context available"}

## REPOSITORY SUMMARY
{discovery.summary if discovery.summary else "No summary available"}

---

Follow the REQUIRED PROCESS in your instructions:
1. Setup Environment
2. Read Reference Template
3. Analyze Repository Context (use the info above)
4. Write Adapted Script
5. Validate Syntax
6. Execute Script
7. Verify Output

Begin with Step 1: Setup Environment."""

    try:
        result = await Runner.run(agent, prompt)
        handoff = result.final_output

        # Save handoff
        os.makedirs(HANDOFF_DIR, exist_ok=True)
        handoff_path = os.path.join(HANDOFF_DIR, "dependency_graph_handoff.json")
        with open(handoff_path, 'w') as f:
            json.dump(handoff.model_dump(), f, indent=2)

        return handoff

    except Exception as e:
        # Return error handoff
        return DependencyGraphHandoff(
            repository_path=discovery.repository_path,
            script_path="",
            csv_output_path="",
            total_files_analyzed=0,
            total_edges=0,
            errors=[str(e)]
        )
```

#### 3. Update `doc_agents/__init__.py`
**File**: `doc_agents/__init__.py`
**Changes**: Add exports for new agent

```python
# Add to __all__:
__all__ = [
    # ... existing exports ...
    'run_dependency_graph_generation',
    'create_dependency_graph_agent',
]

# Add to __getattr__:
def __getattr__(name):
    # ... existing cases ...
    elif name == 'run_dependency_graph_generation':
        from .dependency_graph_generator import run_dependency_graph_generation
        return run_dependency_graph_generation
    elif name == 'create_dependency_graph_agent':
        from .dependency_graph_generator import create_dependency_graph_agent
        return create_dependency_graph_agent
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
```

### Success Criteria:

#### Automated Verification:
- [ ] Agent file exists at `doc_agents/dependency_graph_generator.py`
- [ ] Agent can be imported: `python -c "from doc_agents.dependency_graph_generator import *"`
- [ ] Config includes `dependency_graph` agent config

#### Manual Verification:
- [ ] Agent instructions are clear and constrained
- [ ] Tool sequence is logical and well-defined

---

## Phase 6: Integrate into Orchestrator

### Overview
Add dependency graph generation as Phase 7 in the documentation pipeline.

### Changes Required:

#### 1. Update `doc_agents/orchestrator.py`
**File**: `doc_agents/orchestrator.py`
**Changes**: Add Phase 7 for dependency graph generation

After Phase 6 (FAQ Generation), add:

```python
# Add import at top:
from doc_agents.dependency_graph_generator import run_dependency_graph_generation

# In DocumentationOrchestrator.__init__, add:
self.dependency_graph: Optional[DependencyGraphHandoff] = None

# In DocumentationOrchestrator.run(), change total_phases to 7:
total_phases = 7

# After Phase 6 block, add Phase 7:

        # Phase 7: Dependency Graph Generation
        console.print(f"\n[bold cyan]Phase 7/{total_phases}: Dependency Graph Generation[/bold cyan]")
        try:
            # Pass context from earlier phases to help the agent adapt
            self.dependency_graph = await self.run_phase(
                "Dependency Graph",
                run_dependency_graph_generation(
                    self.discovery,
                    self.file_analyses,
                    self.module_analysis
                ),
                "Generating dependency graph with LLM agent"
            )
            console.print(f"  [green]✓[/green] Extracted {self.dependency_graph.total_edges} dependencies")
            if self.dependency_graph.edges_by_type:
                for rel_type, count in self.dependency_graph.edges_by_type.items():
                    console.print(f"    - {rel_type}: {count}")
            console.print(f"  [green]✓[/green] Output: {self.dependency_graph.csv_output_path}")
        except Exception as e:
            console.print(f"  [yellow]![/yellow] Dependency graph generation failed: {e}")
            # Non-fatal - continue without dependency graph

# Update the summary panel to include dependency graph:
        console.print(Panel.fit(
            "[bold green]Documentation Complete![/bold green]\n\n"
            f"Output directory: [cyan]{OUTPUT_DIR}/[/cyan]\n\n"
            "Files generated:\n"
            "  • README.md - Main documentation (LLM-written)\n"
            "  • API_REFERENCE.md - API docs (LLM-written)\n"
            "  • EXAMPLES.md - Code examples\n"
            "  • FAQ.md - Frequently asked questions (LLM-written)\n"
            "  • dependency_graph.csv - Dependency relationships\n"
            f"  • modules/ - {len(self.documentation.modules)} module docs\n\n"
            "[dim]All documentation generated using multi-agent LLM analysis[/dim]",
            border_style="green"
        ))
```

#### 2. Update `models/__init__.py`
**File**: `models/__init__.py`
**Changes**: Import DependencyGraphHandoff

```python
# Add to imports:
from .dependency_graph import DependencyGraphHandoff

# Add to __all__ if using explicit exports
```

### Success Criteria:

#### Automated Verification:
- [ ] Orchestrator imports dependency graph agent without errors
- [ ] Full pipeline runs: `python main.py ./` (on docs-agent-v3 itself)

#### Manual Verification:
- [ ] Phase 7 appears in console output
- [ ] dependency_graph.csv is created in output/
- [ ] CSV contains valid data

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering the implementation complete.

---

## Phase 7: Create Directory Structure

### Overview
Ensure all required directories exist.

### Changes Required:

#### 1. Create directories:
```bash
mkdir -p scripts
mkdir -p templates
```

### Success Criteria:

#### Automated Verification:
- [ ] `scripts/` directory exists
- [ ] `templates/` directory exists
- [ ] `scripts/setup_depgraph.sh` exists and is executable

---

## Testing Strategy

### Unit Tests:
- Test `script_tools.py` functions individually
- Test template placeholder replacement
- Test CSV parsing in `read_csv_summary`

### Integration Tests:
- Run full pipeline on docs-agent-v3 itself
- Verify CSV output format
- Verify all relationship types are captured

### Manual Testing Steps:
1. Run `./scripts/setup_depgraph.sh` standalone - verify venv creation
2. Run `python main.py ./` - verify Phase 7 executes
3. Open `output/dependency_graph.csv` - verify data structure
4. Check for imports, extends, calls relationships in CSV
5. Verify no Python errors in execution log

## Debugging Process

If the script fails to execute:

### Step 1: Check Environment Setup
```bash
# Verify venv exists
ls -la output/.depgraph_venv/

# Verify Python in venv works
output/.depgraph_venv/bin/python3 --version
```

### Step 2: Check Script Generation
```bash
# Verify script was generated
cat output/extract_dependencies.py | head -50

# Check configuration section
grep -A5 "SECTION 2: CONFIGURATION" output/extract_dependencies.py
```

### Step 3: Test Script Manually
```bash
# Run script directly
output/.depgraph_venv/bin/python3 output/extract_dependencies.py
```

### Step 4: Check Syntax
```bash
# Validate Python syntax
python3 -m py_compile output/extract_dependencies.py
```

### Step 5: Examine Error Output
- Check `stderr` in the agent's tool output
- Look for `SyntaxError`, `ImportError`, `FileNotFoundError`
- Check if paths are absolute and exist

## Performance Considerations

- Script execution timeout: 5 minutes (sufficient for large repos)
- CSV write is streaming (memory efficient)
- AST parsing is per-file (no full-repo memory load)
- Venv creation adds ~10 seconds to first run

## References

- Existing agent pattern: `doc_agents/file_analyzer.py`
- Tool pattern: `tools/file_tools.py`
- Model pattern: `models/handoff.py`
- Orchestrator integration: `doc_agents/orchestrator.py:81-213`
