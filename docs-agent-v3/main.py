#!/usr/bin/env python3
"""
Repository Documentation Generator

A multi-agent system for generating comprehensive documentation
from source code repositories.

Usage:
    python main.py /path/to/repository
    python main.py /path/to/repository --output ./docs

Features:
    - Deep analysis of every file using multiple LLMs
    - Automatic detection of languages, frameworks, and patterns
    - Hierarchical module and dependency analysis
    - Comprehensive markdown documentation generation
    - Practical code examples for common use cases

Models Used:
    - Grok 3 Fast: Discovery and classification
    - Gemini Flash: Per-file analysis
    - Gemini Pro: Architecture and deep reasoning
    - Claude Haiku: Code example generation
"""

import asyncio
import argparse
import sys
import os
import warnings
from pathlib import Path

# Suppress Pydantic serialization warnings from LiteLLM/agents SDK
# These occur because LiteLLM response objects have different field counts
# than what the agents SDK's Pydantic models expect (harmless)
warnings.filterwarnings(
    "ignore",
    message=".*PydanticSerializationUnexpectedValue.*",
    category=UserWarning,
    module="pydantic"
)

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel

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
    source_extensions = ['*.py', '*.js', '*.ts', '*.java', '*.go', '*.rs', '*.rb']
    has_source = False

    for ext in source_extensions:
        if list(repo_path.rglob(ext)):
            has_source = True
            break

    if not has_source:
        console.print("[yellow]Warning: No common source files detected[/yellow]")

    return repo_path


def validate_api_keys() -> dict:
    """
    Check that required API keys are set.

    Returns:
        Dictionary of available providers
    """
    providers = {
        "ANTHROPIC_API_KEY": ("Anthropic (Claude)", "anthropic"),
        "GOOGLE_API_KEY": ("Google (Gemini)", "google"),
        "XAI_API_KEY": ("xAI (Grok)", "xai"),
    }

    available = {}
    missing = []

    for key, (provider_name, provider_id) in providers.items():
        if os.getenv(key):
            available[provider_id] = True
        else:
            missing.append(f"  - {key} ({provider_name})")

    if missing:
        console.print("[yellow]Warning: Some API keys are missing:[/yellow]")
        for m in missing:
            console.print(m)
        console.print("\nThe system will use available providers.")

        if not available:
            console.print("[red]Error: No API keys configured![/red]")
            console.print("Please set at least one API key in your .env file.")
            sys.exit(1)

    return available


def print_banner():
    """Print welcome banner."""
    banner = """
╔══════════════════════════════════════════════════════════════╗
║           Repository Documentation Generator                  ║
║                                                              ║
║   Multi-Agent System powered by:                             ║
║   • Grok 3 Fast - Discovery & Classification                 ║
║   • Gemini Flash - File Analysis                             ║
║   • Gemini Pro - Architecture Analysis                       ║
║   • Claude Haiku - Code Examples                             ║
╚══════════════════════════════════════════════════════════════╝
"""
    console.print(banner, style="blue")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Generate comprehensive documentation for a repository",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python main.py /path/to/my-project
    python main.py ./my-repo --output ./documentation
    python main.py . --verbose

Environment Variables:
    ANTHROPIC_API_KEY   - Required for Claude models
    GOOGLE_API_KEY      - Required for Gemini models
    XAI_API_KEY         - Required for Grok models
    OUTPUT_DIR          - Output directory (default: ./output)
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

    parser.add_argument(
        "--skip-examples",
        action="store_true",
        help="Skip code example generation"
    )

    args = parser.parse_args()

    # Print banner
    print_banner()

    # Validate inputs
    try:
        repo_path = validate_repository(args.repository)
    except ValueError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)

    available_providers = validate_api_keys()

    # Update output directory if specified
    if args.output != "./output":
        import config
        config.OUTPUT_DIR = os.path.abspath(args.output)
        config.HANDOFF_DIR = os.path.join(config.OUTPUT_DIR, ".handoffs")

    # Print configuration
    console.print(Panel.fit(
        f"[bold]Configuration[/bold]\n\n"
        f"Repository: [cyan]{repo_path}[/cyan]\n"
        f"Output: [cyan]{args.output}[/cyan]\n"
        f"Providers: [green]{', '.join(available_providers.keys())}[/green]",
        border_style="blue"
    ))

    # Run documentation generation
    from doc_agents.orchestrator import generate_documentation

    try:
        output_path = asyncio.run(generate_documentation(str(repo_path)))
        console.print(f"\n[bold green]Success![/bold green] Documentation generated at: {output_path}")
        return 0

    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        return 130

    except Exception as e:
        console.print(f"\n[red]Error:[/red] {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
