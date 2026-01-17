"""File operation tools for agents."""

import os
import json
from typing import List, Optional

# Import config values
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import SUPPORTED_EXTENSIONS, SKIP_DIRECTORIES, MAX_FILE_SIZE_KB


def list_directory(path: str, recursive: bool = False) -> str:
    """
    List files and directories at the given path.

    Args:
        path: Directory path to list
        recursive: If True, list all files recursively

    Returns:
        JSON string with file listing
    """
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

            try:
                results.append({
                    "name": item,
                    "is_directory": is_dir,
                    "size_kb": round(os.path.getsize(full_path) / 1024, 2) if not is_dir else None
                })
            except OSError:
                continue

    return json.dumps({"path": path, "items": results, "count": len(results)})


def read_file(path: str, max_lines: Optional[int] = None) -> str:
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
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            if max_lines:
                lines = []
                for i, line in enumerate(f):
                    if i >= max_lines:
                        break
                    lines.append(line)
                content = ''.join(lines)
            else:
                content = f.read()

        return content
    except Exception as e:
        return f"Error reading file {path}: {str(e)}"


def get_file_info(path: str) -> str:
    """
    Get metadata about a file without reading its contents.

    Args:
        path: Path to the file

    Returns:
        JSON string with file metadata
    """
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


def read_multiple_files(paths: List[str]) -> str:
    """
    Read multiple files and return their contents.

    Args:
        paths: List of file paths to read

    Returns:
        JSON string with file contents keyed by path
    """
    results = {}
    for path in paths:
        content = read_file(path)
        results[path] = content

    return json.dumps(results)
