"""Orchestrator Agent - Coordinates the documentation generation workflow."""

import os
import asyncio
from typing import Optional
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.panel import Panel
from agents import set_default_openai_api, set_tracing_disabled

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import OUTPUT_DIR, HANDOFF_DIR
from models import (
    DiscoveryHandoff,
    FileAnalysisHandoff,
    ModuleAnalysisHandoff,
    FinalDocumentation,
)
from doc_agents.discovery import run_discovery
from doc_agents.file_analyzer import run_file_analysis
from doc_agents.module_analyzer import run_module_analysis
from doc_agents.doc_synthesizer import run_doc_synthesis, write_documentation_files
from doc_agents.example_generator import generate_examples, write_examples_file


# Configure for non-OpenAI providers
try:
    set_default_openai_api("chat_completions")
    set_tracing_disabled()
except Exception:
    pass  # May fail if agents SDK not fully initialized

console = Console()


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

    async def run_phase(self, phase_name: str, coro, spinner_text: str):
        """
        Run a phase with progress indication.

        Args:
            phase_name: Name of the phase
            coro: Coroutine to run
            spinner_text: Text to show while running

        Returns:
            Result of the coroutine
        """
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
            transient=True
        ) as progress:
            task = progress.add_task(f"[cyan]{spinner_text}...", total=None)
            result = await coro
            progress.update(task, completed=True)
        return result

    async def run(self) -> str:
        """
        Run the complete documentation generation workflow with subagent exploration.

        This uses parallel LLM agents to explore the codebase deeply and generate
        comprehensive, contextual documentation.

        Returns:
            Path to generated documentation
        """
        total_phases = 6

        console.print(Panel.fit(
            "[bold blue]Repository Documentation Generator[/bold blue]\n"
            "[dim]Powered by multi-agent LLM exploration[/dim]\n\n"
            f"Repository: {self.repository_path}",
            border_style="blue"
        ))

        # Phase 1: Discovery with subagent exploration
        console.print(f"\n[bold cyan]Phase 1/{total_phases}: Discovery & Exploration[/bold cyan]")
        try:
            self.discovery = await self.run_phase(
                "Discovery",
                run_discovery(self.repository_path),
                "Spawning subagents to explore repository"
            )
            console.print(f"  [green]✓[/green] Found {self.discovery.total_files} files")
            console.print(f"  [green]✓[/green] Languages: {', '.join(self.discovery.detected_languages) or 'Unknown'}")
            if self.discovery.detected_frameworks:
                console.print(f"  [green]✓[/green] Frameworks: {', '.join(self.discovery.detected_frameworks)}")
        except Exception as e:
            console.print(f"  [red]✗[/red] Discovery failed: {e}")
            raise

        # Phase 2: File Analysis with LLM for ALL files
        console.print(f"\n[bold cyan]Phase 2/{total_phases}: Deep File Analysis[/bold cyan]")
        try:
            analyzable = len([f for f in self.discovery.files if f.language])
            console.print(f"  [dim]Analyzing {analyzable} source files with LLM...[/dim]")
            self.file_analyses = await self.run_phase(
                "File Analysis",
                run_file_analysis(self.discovery),
                "Running LLM analysis on all source files"
            )
            analyzed_count = len([f for f in self.file_analyses if f.classes or f.functions])
            console.print(f"  [green]✓[/green] Analyzed {len(self.file_analyses)} files with LLM")
            console.print(f"  [green]✓[/green] Found code in {analyzed_count} files")
        except Exception as e:
            console.print(f"  [red]✗[/red] File analysis failed: {e}")
            raise

        # Phase 3: Module Analysis with architectural understanding
        console.print(f"\n[bold cyan]Phase 3/{total_phases}: Architectural Analysis[/bold cyan]")
        try:
            self.module_analysis = await self.run_phase(
                "Module Analysis",
                run_module_analysis(self.discovery, self.file_analyses),
                "Analyzing architecture with LLM subagents"
            )
            console.print(f"  [green]✓[/green] Identified {len(self.module_analysis.modules)} modules")
            console.print(f"  [green]✓[/green] Mapped {len(self.module_analysis.dependency_graph)} relationships")
            if self.module_analysis.architecture_patterns:
                console.print(f"  [green]✓[/green] Patterns: {', '.join(self.module_analysis.architecture_patterns)}")
            if self.module_analysis.architectural_insights:
                console.print(f"  [green]✓[/green] Generated {len(self.module_analysis.architectural_insights)} architectural insights")
        except Exception as e:
            console.print(f"  [red]✗[/red] Module analysis failed: {e}")
            raise

        # Phase 4: Documentation Synthesis with LLM
        console.print(f"\n[bold cyan]Phase 4/{total_phases}: Documentation Generation[/bold cyan]")
        try:
            self.documentation = await self.run_phase(
                "Documentation Synthesis",
                run_doc_synthesis(self.discovery, self.file_analyses, self.module_analysis),
                "Generating documentation with LLM"
            )
            write_documentation_files(self.documentation)
            console.print(f"  [green]✓[/green] Generated {len(self.documentation.modules)} module docs with LLM")
            console.print(f"  [green]✓[/green] Wrote README.md, API_REFERENCE.md")
        except Exception as e:
            console.print(f"  [red]✗[/red] Documentation synthesis failed: {e}")
            raise

        # Phase 5: Example Generation
        console.print(f"\n[bold cyan]Phase 5/{total_phases}: Example Generation[/bold cyan]")
        try:
            primary_lang = self.discovery.detected_languages[0] if self.discovery.detected_languages else "python"
            examples = await self.run_phase(
                "Example Generation",
                generate_examples(self.module_analysis, self.file_analyses, primary_lang),
                "Generating code examples with LLM"
            )

            # Update documentation with examples
            self.documentation.examples = examples
            write_examples_file(examples)

            console.print(f"  [green]✓[/green] Generated {len(examples)} code examples")
        except Exception as e:
            console.print(f"  [yellow]![/yellow] Example generation failed: {e}")
            # Non-fatal - continue without examples

        # Phase 6: FAQ Generation
        console.print(f"\n[bold cyan]Phase 6/{total_phases}: FAQ Generation[/bold cyan]")
        try:
            from doc_agents.faq_generator import generate_faqs
            faqs = await self.run_phase(
                "FAQ Generation",
                generate_faqs(self.discovery, self.file_analyses, self.module_analysis),
                "Generating FAQs with LLM"
            )
            console.print(f"  [green]✓[/green] Generated FAQ.md with {len(faqs)} questions")
        except Exception as e:
            console.print(f"  [yellow]![/yellow] FAQ generation failed: {e}")
            # Non-fatal - continue without FAQs

        # Summary
        console.print(Panel.fit(
            "[bold green]Documentation Complete![/bold green]\n\n"
            f"Output directory: [cyan]{OUTPUT_DIR}/[/cyan]\n\n"
            "Files generated:\n"
            "  • README.md - Main documentation (LLM-written)\n"
            "  • API_REFERENCE.md - API docs (LLM-written)\n"
            "  • EXAMPLES.md - Code examples\n"
            "  • FAQ.md - Frequently asked questions (LLM-written)\n"
            f"  • modules/ - {len(self.documentation.modules)} module docs\n\n"
            "[dim]All documentation generated using multi-agent LLM analysis[/dim]",
            border_style="green"
        ))

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
