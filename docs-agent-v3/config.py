"""Configuration for multi-provider LLM access and agent settings."""

import os
from dataclasses import dataclass
from typing import Literal
from dotenv import load_dotenv

load_dotenv()

# Model identifiers for each provider
MODELS = {
    "grok_fast": "xai/grok-4-fast",                # Fast extraction/classification
    "gemini_flash": "gemini/gemini-2.5-flash",     # Standard tasks
    "gemini_pro": "gemini/gemini-2.5-pro",         # Complex reasoning
    "claude_haiku": "anthropic/claude-haiku-4-5-20251001",  # Code generation
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
