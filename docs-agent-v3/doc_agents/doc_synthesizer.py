"""Documentation Synthesizer Agent - Generates comprehensive documentation."""

import os
import json
from typing import List
from agents import Agent, Runner, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import AGENT_CONFIGS, API_KEYS, OUTPUT_DIR, HANDOFF_DIR
from models import (
    FinalDocumentation,
    DocumentationSection,
    CodeExample,
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


def generate_overview(
    discovery: DiscoveryHandoff,
    module_analysis: ModuleAnalysisHandoff
) -> str:
    """Generate overview section."""
    repo_name = os.path.basename(discovery.repository_path)

    overview = f"""# {repo_name}

{discovery.summary}

## Quick Facts

- **Languages**: {', '.join(discovery.detected_languages) if discovery.detected_languages else 'Not detected'}
- **Frameworks**: {', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else 'None detected'}
- **Total Files**: {discovery.total_files}
- **Modules**: {len(module_analysis.modules)}

## Architecture Patterns

{chr(10).join('- ' + p for p in module_analysis.architecture_patterns) if module_analysis.architecture_patterns else 'No specific patterns detected.'}

## Key Insights

{chr(10).join('- ' + i for i in module_analysis.architectural_insights[:5]) if module_analysis.architectural_insights else 'See module documentation for details.'}
"""
    return overview


def generate_architecture_section(
    module_analysis: ModuleAnalysisHandoff,
    file_analyses: List[FileAnalysisHandoff]
) -> DocumentationSection:
    """Generate architecture section."""

    # Create ASCII dependency diagram
    diagram_lines = ["```"]
    diagram_lines.append("Module Dependencies:")
    diagram_lines.append("=" * 40)

    # Group edges by source module
    module_deps = {}
    for edge in module_analysis.dependency_graph[:30]:
        src_dir = os.path.dirname(edge.source) or "root"
        tgt_dir = os.path.dirname(edge.target) or "root"
        if src_dir != tgt_dir:
            if src_dir not in module_deps:
                module_deps[src_dir] = set()
            module_deps[src_dir].add(tgt_dir)

    for src, targets in list(module_deps.items())[:10]:
        diagram_lines.append(f"\n{src}/")
        for tgt in list(targets)[:5]:
            diagram_lines.append(f"  └── depends on → {tgt}/")

    diagram_lines.append("```")

    content = f"""## System Architecture

This section describes the overall architecture of the codebase.

### Module Overview

The codebase is organized into {len(module_analysis.modules)} modules:

| Module | Files | Purpose |
|--------|-------|---------|
"""

    for module in module_analysis.modules[:15]:
        content += f"| `{module.name}` | {len(module.files)} | {module.purpose[:50]}... |\n"

    content += f"""

### Dependency Graph

{chr(10).join(diagram_lines)}

### Architecture Patterns Detected

"""
    for pattern in module_analysis.architecture_patterns:
        content += f"- **{pattern}**\n"

    content += """

### Data Flow

"""
    for flow in module_analysis.data_flow:
        content += f"- {flow}\n"

    return DocumentationSection(
        title="Architecture",
        content=content,
        subsections=[]
    )


def generate_module_docs(
    module_analysis: ModuleAnalysisHandoff,
    file_analyses: List[FileAnalysisHandoff]
) -> List[DocumentationSection]:
    """Generate documentation for each module."""

    # Map file analyses by path
    file_map = {f.path: f for f in file_analyses}

    module_docs = []

    for module in module_analysis.modules:
        content = f"""### {module.name}

**Path**: `{module.path}`

**Purpose**: {module.purpose}

**Files** ({len(module.files)}):
"""
        for file_path in module.files[:10]:
            content += f"- `{file_path}`\n"

        if len(module.files) > 10:
            content += f"- ... and {len(module.files) - 10} more files\n"

        content += "\n**Public API**:\n"
        for api in module.public_api[:10]:
            content += f"- `{api}`\n"

        # Add detailed file info
        content += "\n#### Key Components\n\n"
        for file_path in module.files[:5]:
            if file_path in file_map:
                f = file_map[file_path]
                content += f"**{os.path.basename(file_path)}**\n"
                content += f"- Purpose: {f.purpose}\n"
                if f.classes:
                    content += f"- Classes: {', '.join(c.name for c in f.classes[:5])}\n"
                if f.functions:
                    content += f"- Functions: {', '.join(fn.name for fn in f.functions[:5])}\n"
                content += "\n"

        module_docs.append(DocumentationSection(
            title=module.name,
            content=content,
            subsections=[]
        ))

    return module_docs


def generate_api_reference(
    file_analyses: List[FileAnalysisHandoff]
) -> DocumentationSection:
    """Generate API reference section."""

    content = """## API Reference

This section documents the public API of the codebase.

"""

    # Group by file
    for analysis in file_analyses:
        if not analysis.classes and not analysis.functions:
            continue

        if analysis.exports:
            content += f"### {analysis.path}\n\n"

            if analysis.classes:
                content += "#### Classes\n\n"
                for cls in analysis.classes:
                    content += f"**`{cls.name}`**"
                    if cls.base_classes:
                        content += f" (extends {', '.join(cls.base_classes)})"
                    content += f"\n\n{cls.description}\n\n"

                    if cls.methods:
                        content += "Methods:\n"
                        for method in cls.methods[:5]:
                            params = ', '.join(method.parameters) if method.parameters else ''
                            content += f"- `{method.name}({params})`"
                            if method.return_type:
                                content += f" → `{method.return_type}`"
                            content += f": {method.description}\n"
                        content += "\n"

            if analysis.functions:
                # Only show exported functions
                exported_funcs = [f for f in analysis.functions if f.name in analysis.exports]
                if exported_funcs:
                    content += "#### Functions\n\n"
                    for func in exported_funcs[:10]:
                        params = ', '.join(func.parameters) if func.parameters else ''
                        content += f"**`{func.name}({params})`**"
                        if func.return_type:
                            content += f" → `{func.return_type}`"
                        content += f"\n\n{func.description}\n\n"

    return DocumentationSection(
        title="API Reference",
        content=content,
        subsections=[]
    )


def generate_getting_started(
    discovery: DiscoveryHandoff
) -> DocumentationSection:
    """Generate getting started section."""

    content = """## Getting Started

This section explains how to set up and run the project.

### Prerequisites

"""
    if 'python' in discovery.detected_languages:
        content += "- Python 3.8 or higher\n"
    if 'javascript' in discovery.detected_languages or 'typescript' in discovery.detected_languages:
        content += "- Node.js 16 or higher\n"
    if 'go' in discovery.detected_languages:
        content += "- Go 1.19 or higher\n"
    if 'rust' in discovery.detected_languages:
        content += "- Rust (latest stable)\n"

    content += "\n### Installation\n\n"

    if 'python' in discovery.detected_languages:
        content += """```bash
# Clone the repository
git clone <repository-url>
cd <repository-name>

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt
```

"""

    if 'javascript' in discovery.detected_languages or 'typescript' in discovery.detected_languages:
        content += """```bash
# Clone the repository
git clone <repository-url>
cd <repository-name>

# Install dependencies
npm install
# or
yarn install
```

"""

    content += "### Running\n\n"

    if discovery.entry_points:
        content += "**Entry Points:**\n"
        for entry in discovery.entry_points[:3]:
            content += f"- `{entry}`\n"
        content += "\n"

    if 'python' in discovery.detected_languages:
        main_entry = next((e for e in discovery.entry_points if e.endswith('.py')), 'main.py')
        content += f"""```bash
python {main_entry}
```

"""

    if 'javascript' in discovery.detected_languages:
        content += """```bash
npm start
# or
node index.js
```

"""

    return DocumentationSection(
        title="Getting Started",
        content=content,
        subsections=[]
    )


async def run_doc_synthesis(
    discovery: DiscoveryHandoff,
    file_analyses: List[FileAnalysisHandoff],
    module_analysis: ModuleAnalysisHandoff,
) -> FinalDocumentation:
    """
    Generate documentation using LLM synthesis, not templates.

    This uses LLM to write actual documentation based on the analysis,
    producing contextual, specific documentation rather than boilerplate.

    Args:
        discovery: Discovery handoff
        file_analyses: File analysis handoffs
        module_analysis: Module analysis handoff

    Returns:
        FinalDocumentation with LLM-written content
    """
    from doc_agents.subagent_coordinator import SubagentCoordinator, SubagentTask

    config = AGENT_CONFIGS["doc_synthesizer"]
    coordinator = SubagentCoordinator(max_concurrent=5)

    repo_name = os.path.basename(discovery.repository_path)

    # Load detailed analysis from previous phases
    detailed_path = os.path.join(HANDOFF_DIR, "module_analysis_detailed.json")
    detailed_analysis = {}
    if os.path.exists(detailed_path):
        with open(detailed_path) as f:
            detailed_analysis = json.load(f)

    print("  Generating documentation sections with LLM...")

    # 1. Generate Overview section with LLM
    print("    Writing overview...")
    overview_prompt = f"""Write a comprehensive README overview section for: {repo_name}

REPOSITORY SUMMARY:
{discovery.summary}

LANGUAGES: {', '.join(discovery.detected_languages)}
FRAMEWORKS: {', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else 'None detected'}
TOTAL FILES: {discovery.total_files}
MODULES: {len(module_analysis.modules)}

ARCHITECTURAL INSIGHTS:
{chr(10).join('- ' + i for i in module_analysis.architectural_insights[:8])}

ARCHITECTURE PATTERNS:
{', '.join(module_analysis.architecture_patterns) if module_analysis.architecture_patterns else 'Standard architecture'}

Write a clear, comprehensive overview that:
1. Opens with a compelling 1-2 sentence description of what this project does
2. Explains the problem it solves and target audience
3. Highlights 3-5 key features or capabilities
4. Provides quick facts (languages, file count, etc.)
5. Summarizes the architecture in 2-3 sentences
6. Lists key insights or notable aspects

Write in clear, professional markdown. Be specific about THIS project.
Do NOT write generic documentation - make every sentence specific to this codebase."""

    overview_result = await coordinator.run_task(SubagentTask(
        name="overview",
        prompt=overview_prompt,
        model=config.model,
        api_key=API_KEYS["google"],
        temperature=0.5,
        max_tokens=3000
    ))

    # 2. Generate Architecture section with LLM
    print("    Writing architecture documentation...")
    arch_analysis = detailed_analysis.get("architecture", "")

    arch_prompt = f"""Write detailed architecture documentation for: {repo_name}

ARCHITECTURE PATTERNS DETECTED: {', '.join(module_analysis.architecture_patterns)}

MODULES:
{json.dumps([{"name": m.name, "purpose": m.purpose, "files": len(m.files)} for m in module_analysis.modules[:15]], indent=2)}

DEPENDENCY RELATIONSHIPS:
{json.dumps([{"from": e.source, "to": e.target, "type": e.relationship_type} for e in module_analysis.dependency_graph[:20]], indent=2)}

DETAILED ARCHITECTURE ANALYSIS:
{arch_analysis[:3000] if arch_analysis else "See module information above"}

ARCHITECTURAL INSIGHTS:
{chr(10).join('- ' + i for i in module_analysis.architectural_insights[:10])}

Write architecture documentation that:
1. Explains the overall system design and architecture pattern
2. Creates an ASCII diagram showing module relationships
3. Describes each major component/module in 2-3 sentences
4. Explains how data flows through the system
5. Documents key design decisions and their rationale
6. Lists dependencies between modules

Format as clear markdown with headers. Include an ASCII diagram like:
```
┌─────────────┐     ┌─────────────┐
│   Module A  │────▶│   Module B  │
└─────────────┘     └─────────────┘
```

Be specific and technical. Reference actual module and file names."""

    arch_result = await coordinator.run_task(SubagentTask(
        name="architecture",
        prompt=arch_prompt,
        model=config.model,
        api_key=API_KEYS["google"],
        temperature=0.5,
        max_tokens=4000
    ))

    # 3. Generate Module documentation (parallel)
    print("    Writing module documentation...")
    module_tasks = []

    # Map file analyses by module
    file_map = {f.path: f for f in file_analyses}

    for module in module_analysis.modules[:10]:
        module_files = [f for f in file_analyses if f.path.startswith(module.path + "/") or (module.path == "." and "/" not in f.path)]

        # Find detailed analysis for this module
        module_detailed = next(
            (m for m in detailed_analysis.get("modules", []) if module.name in m.get("name", "")),
            {}
        )

        prompt = f"""Write comprehensive documentation for the {module.name} module:

MODULE: {module.name}
PATH: {module.path}
PURPOSE: {module.purpose}

FILES ({len(module_files)} total):
{json.dumps([{"path": f.path, "purpose": f.purpose, "classes": [c.name for c in f.classes], "functions": [fn.name for fn in f.functions]} for f in module_files[:8]], indent=2)}

PUBLIC API:
{json.dumps(module.public_api[:15], indent=2)}

DETAILED ANALYSIS:
{module_detailed.get("analysis", "")[:2000]}

Write module documentation that includes:

## {module.name}

### Overview
[2-3 sentences about what this module does]

### Key Components
[List and describe main classes/functions]

### Usage
[Show how to use this module with code examples]

### API Reference
[Document public functions/classes with parameters]

### Dependencies
[What this module depends on]

Be specific and include realistic code examples using actual class/function names from this module."""

        module_tasks.append(SubagentTask(
            name=f"module_{module.name.replace('.', '_').replace('/', '_')}",
            prompt=prompt,
            model=config.model,
            api_key=API_KEYS["google"],
            temperature=0.5,
            max_tokens=3000
        ))

    module_results = await coordinator.run_parallel(module_tasks)

    # 4. Generate API Reference with LLM
    print("    Writing API reference...")

    # Collect key APIs
    key_apis = []
    for f in file_analyses:
        if f.exports:
            for cls in f.classes[:3]:
                key_apis.append({
                    "type": "class",
                    "name": cls.name,
                    "file": f.path,
                    "methods": [m.name for m in cls.methods[:5]],
                    "description": cls.description
                })
            for fn in f.functions[:3]:
                if fn.name in f.exports:
                    key_apis.append({
                        "type": "function",
                        "name": fn.name,
                        "file": f.path,
                        "params": fn.parameters,
                        "description": fn.description
                    })

    api_prompt = f"""Write an API reference section for: {repo_name}

KEY APIS:
{json.dumps(key_apis[:25], indent=2)}

Write API reference documentation that:
1. Groups APIs by module/file
2. Documents each class with:
   - Description
   - Constructor parameters
   - Key methods with parameters and return types
   - Usage example
3. Documents each function with:
   - Description
   - Parameters and types
   - Return value
   - Usage example
4. Uses proper markdown formatting

Format as clean, scannable markdown with code blocks for examples.
Be specific - use actual parameter names and types from the API list."""

    api_result = await coordinator.run_task(SubagentTask(
        name="api_reference",
        prompt=api_prompt,
        model=config.model,
        api_key=API_KEYS["google"],
        temperature=0.4,
        max_tokens=4000
    ))

    # 5. Generate Getting Started with LLM
    print("    Writing getting started guide...")

    getting_started_prompt = f"""Write a Getting Started guide for: {repo_name}

LANGUAGES: {', '.join(discovery.detected_languages)}
FRAMEWORKS: {', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else 'None'}
ENTRY POINTS: {', '.join(discovery.entry_points) if discovery.entry_points else 'Not explicitly defined'}

REPOSITORY SUMMARY:
{discovery.summary[:500]}

Write a practical getting started guide that includes:

## Getting Started

### Prerequisites
[List required software, versions, and dependencies]

### Installation
[Step-by-step installation instructions with code blocks]

### Quick Start
[Minimal example to get something working - include actual code]

### Configuration
[How to configure the project - environment variables, config files]

### Running
[How to run the project with actual commands]

### Next Steps
[Where to go after the basics - links to other docs]

Be practical and actionable. Include actual shell commands and code examples.
Make instructions specific to this project's technology stack ({', '.join(discovery.detected_languages)})."""

    getting_started_result = await coordinator.run_task(SubagentTask(
        name="getting_started",
        prompt=getting_started_prompt,
        model=config.model,
        api_key=API_KEYS["google"],
        temperature=0.4,
        max_tokens=3000
    ))

    # Assemble final documentation
    documentation = FinalDocumentation(
        repository_name=repo_name,
        overview=str(overview_result.output) if overview_result.success else generate_overview(discovery, module_analysis),
        architecture=DocumentationSection(
            title="Architecture",
            content=str(arch_result.output) if arch_result.success else generate_architecture_section(module_analysis, file_analyses).content,
            subsections=[]
        ),
        modules=[
            DocumentationSection(
                title=module_analysis.modules[i].name if i < len(module_analysis.modules) else r.task_name.replace("module_", ""),
                content=str(r.output) if r.success else f"Documentation for {r.task_name} pending.",
                subsections=[]
            )
            for i, r in enumerate(module_results)
        ],
        api_reference=DocumentationSection(
            title="API Reference",
            content=str(api_result.output) if api_result.success else generate_api_reference(file_analyses).content,
            subsections=[]
        ),
        examples=[],  # Filled by example generator
        getting_started=DocumentationSection(
            title="Getting Started",
            content=str(getting_started_result.output) if getting_started_result.success else generate_getting_started(discovery).content,
            subsections=[]
        ),
        configuration=None
    )

    successful = sum([
        overview_result.success,
        arch_result.success,
        api_result.success,
        getting_started_result.success
    ]) + len([r for r in module_results if r.success])

    total = 4 + len(module_results)
    print(f"  Documentation synthesis complete. {successful}/{total} sections written with LLM.")

    return documentation


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
- [Examples](#examples)

---

{docs.architecture.content}

---

## Modules

"""

    for module in docs.modules:
        readme_content += f"{module.content}\n\n---\n\n"

    readme_content += f"""
{docs.api_reference.content}

---

{docs.getting_started.content}

---

## Examples

"""

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
        module_filename = module.title.replace('/', '_').replace('.', '_') + '.md'
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

    print(f"  Documentation written to {OUTPUT_DIR}/")
    print(f"    - README.md")
    print(f"    - API_REFERENCE.md")
    print(f"    - modules/ ({len(docs.modules)} files)")
