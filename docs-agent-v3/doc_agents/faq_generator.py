"""FAQ Generator Agent - Creates FAQs based on code analysis."""

import os
import json
from typing import List
from agents import Agent, Runner, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import AGENT_CONFIGS, API_KEYS, OUTPUT_DIR, HANDOFF_DIR
from models import (
    FileAnalysisHandoff,
    ModuleAnalysisHandoff,
    DiscoveryHandoff,
)


async def generate_faqs(
    discovery: DiscoveryHandoff,
    file_analyses: List[FileAnalysisHandoff],
    module_analysis: ModuleAnalysisHandoff
) -> List[dict]:
    """
    Generate FAQs based on code analysis using LLM.

    This creates FAQs that address real complexity points, common patterns,
    and likely user questions based on the codebase analysis.

    Args:
        discovery: Discovery handoff
        file_analyses: File analysis handoffs
        module_analysis: Module analysis handoff

    Returns:
        List of FAQ dictionaries (also written to FAQ.md)
    """
    from doc_agents.subagent_coordinator import SubagentCoordinator, SubagentTask

    config = AGENT_CONFIGS["doc_synthesizer"]  # Use same config as doc synthesizer
    coordinator = SubagentCoordinator(max_concurrent=3)

    repo_name = os.path.basename(discovery.repository_path)

    # Identify complexity points (likely to confuse users)
    complex_files = [
        {"path": f.path, "purpose": f.purpose, "complexity": f.complexity_score}
        for f in file_analyses
        if f.complexity_score >= 7
    ]

    # Collect key insights that might generate questions
    all_insights = []
    for f in file_analyses:
        if f.key_insights:
            for insight in f.key_insights[:2]:
                all_insights.append({"file": f.path, "insight": insight})

    # Load detailed analysis if available
    detailed_path = os.path.join(HANDOFF_DIR, "module_analysis_detailed.json")
    detailed_analysis = {}
    if os.path.exists(detailed_path):
        with open(detailed_path) as f:
            detailed_analysis = json.load(f)

    print("  Generating FAQs with LLM...")

    faq_prompt = f"""Generate a comprehensive FAQ section for: {repo_name}

REPOSITORY OVERVIEW:
{discovery.summary}

LANGUAGES: {', '.join(discovery.detected_languages)}
FRAMEWORKS: {', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else 'None detected'}
ENTRY POINTS: {', '.join(discovery.entry_points) if discovery.entry_points else 'Not explicitly defined'}

MODULES ({len(module_analysis.modules)} total):
{json.dumps([{"name": m.name, "purpose": m.purpose} for m in module_analysis.modules[:10]], indent=2)}

COMPLEX AREAS (likely to confuse users):
{json.dumps(complex_files[:8], indent=2)}

ARCHITECTURAL INSIGHTS:
{chr(10).join('- ' + i for i in module_analysis.architectural_insights[:8])}

ARCHITECTURE PATTERNS:
{', '.join(module_analysis.architecture_patterns) if module_analysis.architecture_patterns else 'Standard architecture'}

KEY INSIGHTS FROM CODE ANALYSIS:
{json.dumps(all_insights[:10], indent=2)}

Generate 12-15 FAQs that address REAL questions users would have about THIS codebase.

Categories to cover:

1. GETTING STARTED (3-4 questions):
   - How do I install this project?
   - What are the prerequisites?
   - How do I run it for the first time?
   - How do I verify it's working?

2. USAGE (3-4 questions):
   - How do I perform the main functionality?
   - What are the most important entry points?
   - How do I configure common options?
   - What are the typical workflows?

3. ARCHITECTURE (2-3 questions):
   - How is the codebase organized?
   - What are the main modules and their purposes?
   - How do the components interact?

4. TROUBLESHOOTING (2-3 questions):
   - What are common errors and how do I fix them?
   - How do I debug issues?
   - Where can I find logs or diagnostic info?

5. ADVANCED (2-3 questions):
   - How do I extend or customize this?
   - How do I integrate with other systems?
   - What are the performance considerations?

Format each FAQ as:

## Q: [Specific question about THIS codebase]

**A:** [Detailed, helpful answer that references actual files, classes, or functions from the codebase. Include code examples where relevant.]

---

Be SPECIFIC to this codebase. Reference actual:
- File names and paths
- Class and function names
- Configuration options
- Module names

Do NOT write generic FAQs. Every answer should contain specific details from the analysis provided."""

    result = await coordinator.run_task(SubagentTask(
        name="faq_generation",
        prompt=faq_prompt,
        model=config.model,
        api_key=API_KEYS["google"],
        temperature=0.5,
        max_tokens=6000
    ))

    # Write FAQ file
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    faq_path = os.path.join(OUTPUT_DIR, "FAQ.md")

    faq_content = f"""# Frequently Asked Questions - {repo_name}

This FAQ addresses common questions about the {repo_name} codebase, based on automated analysis.

---

{str(result.output) if result.success else "FAQ generation encountered an issue. Please refer to other documentation files."}

---

*This FAQ was generated automatically based on code analysis. For the most up-to-date information, refer to the source code and inline documentation.*
"""

    with open(faq_path, 'w') as f:
        f.write(faq_content)

    print(f"  FAQs written to {faq_path}")

    # Parse FAQs into list for return
    faqs = []
    if result.success:
        faq_text = str(result.output)
        # Simple parsing - split by "## Q:"
        sections = faq_text.split("## Q:")
        for section in sections[1:]:  # Skip first empty section
            lines = section.strip().split("\n")
            if lines:
                question = lines[0].strip()
                answer = "\n".join(lines[1:]).strip()
                # Clean up answer
                answer = answer.replace("**A:**", "").strip()
                faqs.append({
                    "question": question,
                    "answer": answer[:1000]  # Truncate for return value
                })

    return faqs


async def generate_troubleshooting_guide(
    discovery: DiscoveryHandoff,
    file_analyses: List[FileAnalysisHandoff],
    module_analysis: ModuleAnalysisHandoff
) -> str:
    """
    Generate a troubleshooting guide based on code analysis.

    This is an optional additional output that focuses specifically on
    error handling and debugging.

    Args:
        discovery: Discovery handoff
        file_analyses: File analysis handoffs
        module_analysis: Module analysis handoff

    Returns:
        Troubleshooting guide as markdown string
    """
    from doc_agents.subagent_coordinator import SubagentCoordinator, SubagentTask

    config = AGENT_CONFIGS["doc_synthesizer"]
    coordinator = SubagentCoordinator(max_concurrent=1)

    repo_name = os.path.basename(discovery.repository_path)

    # Find error handling patterns
    error_patterns = []
    for f in file_analyses:
        # Look for error-related insights
        for insight in f.key_insights:
            if any(word in insight.lower() for word in ["error", "exception", "fail", "catch", "try"]):
                error_patterns.append({"file": f.path, "insight": insight})

    troubleshooting_prompt = f"""Generate a troubleshooting guide for: {repo_name}

LANGUAGES: {', '.join(discovery.detected_languages)}
FRAMEWORKS: {', '.join(discovery.detected_frameworks) if discovery.detected_frameworks else 'None'}

ERROR HANDLING PATTERNS FOUND:
{json.dumps(error_patterns[:10], indent=2)}

ENTRY POINTS:
{', '.join(discovery.entry_points) if discovery.entry_points else 'Not defined'}

Write a troubleshooting guide that covers:

1. Common setup issues and solutions
2. Runtime errors and how to diagnose them
3. Configuration problems
4. Debugging tips specific to this codebase
5. Where to find logs and diagnostic information
6. How to get help or report issues

Be specific to this codebase and include actual file paths, class names, and configuration options."""

    result = await coordinator.run_task(SubagentTask(
        name="troubleshooting",
        prompt=troubleshooting_prompt,
        model=config.model,
        api_key=API_KEYS["google"],
        temperature=0.4,
        max_tokens=3000
    ))

    return str(result.output) if result.success else "Troubleshooting guide generation failed."
