"""Event Logger - Logs key agent events and discoveries."""

from datetime import datetime
from typing import Any, Optional
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

console = Console()

# Color scheme for different event types
COLORS = {
    "start": "cyan",
    "complete": "green",
    "finding": "yellow",
    "error": "red",
    "info": "blue",
    "exploring": "magenta",
}


def _timestamp() -> str:
    """Get current timestamp."""
    return datetime.now().strftime("%H:%M:%S")


def log_agent_start(agent_name: str, target: str = None):
    """Log when an agent starts working."""
    ts = _timestamp()
    msg = f"[{COLORS['start']}][{ts}][/] [bold]{agent_name}[/bold] started"
    if target:
        msg += f" → [dim]{target}[/dim]"
    console.print(msg)


def log_agent_complete(agent_name: str, success: bool = True, summary: str = None):
    """Log when an agent completes."""
    ts = _timestamp()
    color = COLORS['complete'] if success else COLORS['error']
    status = "completed" if success else "failed"
    msg = f"[{color}][{ts}][/] [bold]{agent_name}[/bold] {status}"
    if summary:
        # Truncate summary if too long
        if len(summary) > 150:
            summary = summary[:147] + "..."
        msg += f"\n    └─ {summary}"
    console.print(msg)


def log_exploration(directory: str, agent_name: str = None):
    """Log when exploring a directory."""
    ts = _timestamp()
    agent_part = f"[bold]{agent_name}[/bold] " if agent_name else ""
    console.print(f"[{COLORS['exploring']}][{ts}][/] {agent_part}exploring [cyan]{directory}[/cyan]")


def log_finding(category: str, description: str, details: str = None):
    """Log a key finding/discovery."""
    ts = _timestamp()
    msg = f"[{COLORS['finding']}][{ts}][/] [bold]{category}:[/bold] {description}"
    if details:
        if len(details) > 200:
            details = details[:197] + "..."
        msg += f"\n    └─ [dim]{details}[/dim]"
    console.print(msg)


def log_batch_progress(phase: str, current: int, total: int, item: str = None):
    """Log batch processing progress."""
    ts = _timestamp()
    msg = f"[{COLORS['info']}][{ts}][/] [{phase}] [{current}/{total}]"
    if item:
        # Truncate long item names
        if len(item) > 60:
            item = "..." + item[-57:]
        msg += f" {item}"
    console.print(msg)


def log_subagent_spawn(agent_name: str, target: str, model: str):
    """Log when a subagent is spawned."""
    ts = _timestamp()
    console.print(
        f"[{COLORS['start']}][{ts}][/] spawning [bold]{agent_name}[/bold] "
        f"→ [cyan]{target}[/cyan] [dim]({model})[/dim]"
    )


def log_subagent_result(agent_name: str, success: bool, key_findings: list = None):
    """Log subagent results with key findings."""
    ts = _timestamp()
    color = COLORS['complete'] if success else COLORS['error']
    status = "✓" if success else "✗"
    console.print(f"[{color}][{ts}][/] {status} [bold]{agent_name}[/bold]")

    if key_findings and success:
        for finding in key_findings[:3]:  # Limit to 3 findings
            if len(finding) > 100:
                finding = finding[:97] + "..."
            console.print(f"    └─ [dim]{finding}[/dim]")


def log_phase_start(phase_name: str, description: str = None):
    """Log the start of a major phase."""
    ts = _timestamp()
    console.print()  # Empty line before phase
    text = f"[bold white on blue] {phase_name} [/bold white on blue]"
    if description:
        text += f" [dim]{description}[/dim]"
    console.print(f"[{ts}] {text}")


def log_phase_complete(phase_name: str, stats: dict = None):
    """Log completion of a major phase."""
    ts = _timestamp()
    msg = f"[{COLORS['complete']}][{ts}][/] [bold]{phase_name}[/bold] complete"
    if stats:
        stat_parts = [f"{k}: {v}" for k, v in stats.items()]
        msg += f" [dim]({', '.join(stat_parts)})[/dim]"
    console.print(msg)
    console.print()  # Empty line after phase


def log_error(context: str, error: str):
    """Log an error."""
    ts = _timestamp()
    if len(error) > 200:
        error = error[:197] + "..."
    console.print(f"[{COLORS['error']}][{ts}][/] [bold]ERROR[/bold] in {context}: {error}")


def log_info(message: str):
    """Log general info message."""
    ts = _timestamp()
    console.print(f"[{COLORS['info']}][{ts}][/] {message}")


def extract_key_findings(output: str, max_findings: int = 3) -> list:
    """Extract key findings from agent output for logging."""
    if not output:
        return []

    findings = []
    lines = output.split('\n')

    # Look for lines that seem like key findings
    keywords = ['purpose:', 'key file', 'main', 'entry', 'pattern', 'component', 'class:', 'function:']

    for line in lines:
        line = line.strip()
        if not line or len(line) < 10:
            continue

        lower = line.lower()
        if any(kw in lower for kw in keywords):
            # Clean up the line
            clean = line.lstrip('- *•#').strip()
            if clean and len(clean) > 15:
                findings.append(clean)

        if len(findings) >= max_findings:
            break

    # If no keyword matches, take first substantive lines
    if not findings:
        for line in lines:
            line = line.strip().lstrip('- *•#').strip()
            if line and len(line) > 20 and not line.startswith(('#', '//', '/*')):
                findings.append(line)
                if len(findings) >= max_findings:
                    break

    return findings
