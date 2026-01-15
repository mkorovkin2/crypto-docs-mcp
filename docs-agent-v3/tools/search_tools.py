"""Search tools for pattern matching in files."""

import os
import re
import json
import fnmatch
from typing import Optional


def grep_pattern(
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
    if not os.path.exists(path):
        return json.dumps({"error": f"Path does not exist: {path}"})

    results = []
    flags = re.IGNORECASE if case_insensitive else 0

    try:
        compiled_pattern = re.compile(pattern, flags)
    except re.error as e:
        return json.dumps({"error": f"Invalid regex pattern: {e}"})

    def search_file(file_path: str) -> bool:
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


def find_files(
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


def get_file_structure(path: str, max_depth: int = 4) -> str:
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
