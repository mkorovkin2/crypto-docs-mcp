"""Bash command execution tools for agents."""

import subprocess
import asyncio
import os
import json
from typing import Optional


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


def run_command_sync(
    command: str,
    cwd: Optional[str] = None,
    timeout: int = 30
) -> str:
    """
    Synchronous version of run_command.

    Args:
        command: Shell command to run
        cwd: Working directory for the command
        timeout: Timeout in seconds

    Returns:
        JSON string with command output
    """
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
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            cwd=cwd,
            timeout=timeout
        )

        return json.dumps({
            "command": command,
            "returncode": result.returncode,
            "stdout": result.stdout.decode('utf-8', errors='replace')[:10000],
            "stderr": result.stderr.decode('utf-8', errors='replace')[:2000]
        })

    except subprocess.TimeoutExpired:
        return json.dumps({
            "error": f"Command timed out after {timeout} seconds",
            "command": command
        })
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "command": command
        })


def check_language_tools(path: str) -> str:
    """
    Check what language/build tools are available in the repository.

    Args:
        path: Repository path

    Returns:
        JSON string with detected tools and configurations
    """
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
