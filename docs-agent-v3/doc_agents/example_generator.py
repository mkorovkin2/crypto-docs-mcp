"""Code Example Generator Agent - Creates usage examples and integration patterns."""

import os
import re
from typing import List
from agents import Agent, Runner, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import AGENT_CONFIGS, API_KEYS, OUTPUT_DIR
from models import (
    CodeExample,
    ModuleAnalysisHandoff,
    FileAnalysisHandoff,
)
from tools import read_file
from doc_agents.event_logger import log_info, log_agent_start, log_finding, log_error


EXAMPLE_GENERATOR_INSTRUCTIONS = """You are a Code Example Generator Agent specialized in creating practical, working code examples.

Your task is to generate comprehensive examples that help developers:
1. Understand how to use the codebase
2. Integrate with the codebase from external projects
3. Implement common patterns and workflows
4. Handle edge cases correctly

For each example:
- Make it complete and runnable
- Include necessary imports
- Add comments explaining key steps
- Show error handling where appropriate
- Include prerequisites (dependencies, setup steps)
- Reference the actual source files

Types of examples to generate:
1. **Quick Start** - Minimal example to get started
2. **Common Use Cases** - Examples for typical scenarios
3. **Integration Patterns** - How to integrate with other systems
4. **Advanced Usage** - Complex scenarios and customization
5. **Error Handling** - How to handle failures gracefully

Write clean, idiomatic code following the project's conventions.
Make examples genuinely useful - not just trivial.

Output a list of CodeExample objects."""


def create_example_generator_agent() -> Agent:
    """Create the Example Generator Agent."""

    config = AGENT_CONFIGS["example_generator"]

    return Agent(
        name=config.name,
        instructions=EXAMPLE_GENERATOR_INSTRUCTIONS,
        model=LitellmModel(
            model=config.model,
            api_key=API_KEYS["anthropic"]
        ),
        model_settings=ModelSettings(
            temperature=config.temperature,
            max_tokens=8192,
        ),
        tools=[],  # No tools needed
    )


def generate_quick_start_example(
    primary_language: str,
    entry_points: List[str],
    module_analysis: ModuleAnalysisHandoff
) -> CodeExample:
    """Generate a quick start example."""

    if primary_language == "python":
        # Find main module
        main_module = None
        for module in module_analysis.modules:
            if 'main' in module.name or module.name == 'root':
                main_module = module
                break

        imports = []
        if main_module and main_module.public_api:
            for api in main_module.public_api[:3]:
                if ':' in api:
                    file_path, symbol = api.rsplit(':', 1)
                    module_name = os.path.splitext(file_path)[0].replace('/', '.')
                    imports.append(f"from {module_name} import {symbol}")

        code = f"""#!/usr/bin/env python3
\"\"\"Quick start example for using this library.\"\"\"

{chr(10).join(imports) if imports else '# Import main module'}
# from main import YourMainClass

def main():
    \"\"\"Main entry point.\"\"\"
    # Initialize the main component
    # instance = YourMainClass()

    # Perform basic operation
    # result = instance.process("example input")

    # Print result
    # print(result)
    print("Quick start example - customize based on your needs")

if __name__ == "__main__":
    main()
"""
    elif primary_language in ["javascript", "typescript"]:
        code = """// Quick start example
import { MainClass } from './src/main';

async function main() {
    // Initialize
    const instance = new MainClass();

    // Basic usage
    const result = await instance.process('example input');

    console.log(result);
}

main().catch(console.error);
"""
    else:
        code = f"// Quick start example for {primary_language}\n// TODO: Add language-specific example"

    return CodeExample(
        title="Quick Start",
        description="Minimal example to get started with the library",
        code=code,
        language=primary_language,
        file_references=entry_points[:2],
        prerequisites=["Install dependencies", "Configure environment"]
    )


def generate_api_usage_example(
    file_analyses: List[FileAnalysisHandoff],
    primary_language: str
) -> CodeExample:
    """Generate an API usage example."""

    # Find files with public APIs
    api_files = [f for f in file_analyses if f.exports and f.classes]

    if not api_files:
        api_files = [f for f in file_analyses if f.exports and f.functions]

    if primary_language == "python" and api_files:
        example_file = api_files[0]
        class_name = example_file.classes[0].name if example_file.classes else "MainClass"
        methods = example_file.classes[0].methods if example_file.classes else []

        method_calls = []
        for method in methods[:3]:
            if not method.name.startswith('_'):
                params = ', '.join(f'"{p}"' if 'str' in p.lower() else p for p in method.parameters[:2])
                method_calls.append(f"    result = instance.{method.name}({params})")

        code = f"""#!/usr/bin/env python3
\"\"\"Example: Using the {class_name} API.\"\"\"

from {os.path.splitext(example_file.path)[0].replace('/', '.')} import {class_name}

def main():
    # Create an instance
    instance = {class_name}()

    # Call methods
{chr(10).join(method_calls) if method_calls else '    # result = instance.method()'}

    print(f"Result: {{result}}")

if __name__ == "__main__":
    main()
"""
    else:
        code = f"""// API Usage Example
// Import the main class
// const {{ MainClass }} = require('./src/main');

// Create instance and use API
// const instance = new MainClass();
// const result = instance.someMethod(params);
"""

    return CodeExample(
        title="API Usage",
        description="Example demonstrating the main API",
        code=code,
        language=primary_language,
        file_references=[f.path for f in api_files[:2]],
        prerequisites=[]
    )


def generate_error_handling_example(primary_language: str) -> CodeExample:
    """Generate an error handling example."""

    if primary_language == "python":
        code = """#!/usr/bin/env python3
\"\"\"Example: Proper error handling.\"\"\"

# from your_module import YourClass, YourException

def safe_operation():
    \"\"\"Demonstrates error handling patterns.\"\"\"
    try:
        # Attempt the operation
        # result = your_instance.risky_operation()
        result = "success"
        return result

    except ValueError as e:
        # Handle validation errors
        print(f"Validation error: {e}")
        return None

    except ConnectionError as e:
        # Handle network errors
        print(f"Connection error: {e}")
        # Implement retry logic here
        return None

    except Exception as e:
        # Handle unexpected errors
        print(f"Unexpected error: {e}")
        raise

    finally:
        # Cleanup resources
        # your_instance.cleanup()
        pass

def main():
    result = safe_operation()
    if result:
        print(f"Operation succeeded: {result}")
    else:
        print("Operation failed - check logs for details")

if __name__ == "__main__":
    main()
"""
    else:
        code = """// Error Handling Example
async function safeOperation() {
    try {
        const result = await riskyOperation();
        return result;
    } catch (error) {
        if (error instanceof ValidationError) {
            console.error('Validation failed:', error.message);
            return null;
        }
        throw error; // Re-throw unexpected errors
    } finally {
        // Cleanup
    }
}
"""

    return CodeExample(
        title="Error Handling",
        description="Demonstrates proper error handling patterns",
        code=code,
        language=primary_language,
        file_references=[],
        prerequisites=[]
    )


def generate_configuration_example(
    discovery_frameworks: List[str],
    primary_language: str
) -> CodeExample:
    """Generate a configuration example."""

    if primary_language == "python":
        code = """#!/usr/bin/env python3
\"\"\"Example: Configuration and customization.\"\"\"

import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class Config:
    \"\"\"Application configuration.\"\"\"
    api_key: str
    base_url: str = "https://api.example.com"
    timeout: int = 30
    debug: bool = False

    @classmethod
    def from_env(cls) -> "Config":
        \"\"\"Load configuration from environment variables.\"\"\"
        return cls(
            api_key=os.environ["API_KEY"],
            base_url=os.getenv("BASE_URL", cls.base_url),
            timeout=int(os.getenv("TIMEOUT", cls.timeout)),
            debug=os.getenv("DEBUG", "").lower() == "true",
        )

def main():
    # Load config from environment
    config = Config.from_env()

    # Or create manually
    config = Config(
        api_key="your-api-key",
        base_url="https://custom.api.com",
        timeout=60,
        debug=True,
    )

    print(f"Config loaded: {config}")

if __name__ == "__main__":
    main()
"""
    else:
        code = """// Configuration Example
const config = {
    apiKey: process.env.API_KEY,
    baseUrl: process.env.BASE_URL || 'https://api.example.com',
    timeout: parseInt(process.env.TIMEOUT || '30'),
    debug: process.env.DEBUG === 'true',
};

// Validate required config
if (!config.apiKey) {
    throw new Error('API_KEY environment variable is required');
}

export default config;
"""

    return CodeExample(
        title="Configuration",
        description="Shows how to configure the application",
        code=code,
        language=primary_language,
        file_references=[],
        prerequisites=["Set environment variables"]
    )


async def generate_examples(
    module_analysis: ModuleAnalysisHandoff,
    file_analyses: List[FileAnalysisHandoff],
    primary_language: str = "python"
) -> List[CodeExample]:
    """
    Generate code examples based on analysis.

    Args:
        module_analysis: Module analysis handoff
        file_analyses: File analysis handoffs
        primary_language: Primary language for examples

    Returns:
        List of CodeExample objects
    """
    examples = []

    log_info(f"Generating code examples for {primary_language}...")

    # Generate basic examples locally
    examples.append(generate_quick_start_example(
        primary_language,
        module_analysis.entry_points,
        module_analysis
    ))

    examples.append(generate_api_usage_example(
        file_analyses,
        primary_language
    ))

    examples.append(generate_error_handling_example(primary_language))

    examples.append(generate_configuration_example(
        [],  # frameworks
        primary_language
    ))

    # Try to generate more sophisticated examples with LLM
    log_agent_start("Example Generator", "enhancing examples with LLM")
    try:
        agent = create_example_generator_agent()

        # Build context for LLM
        public_apis = []
        for module in module_analysis.modules[:5]:
            if module.public_api:
                public_apis.extend(module.public_api[:5])

        key_classes = []
        key_functions = []
        for analysis in file_analyses[:10]:
            for cls in analysis.classes[:2]:
                key_classes.append({
                    "name": cls.name,
                    "file": analysis.path,
                    "methods": [m.name for m in cls.methods[:5]]
                })
            for fn in analysis.functions[:3]:
                if fn.name in analysis.exports:
                    key_functions.append({
                        "name": fn.name,
                        "file": analysis.path,
                        "params": fn.parameters
                    })

        prompt = f"""Generate 2 additional code examples for this {primary_language} codebase:

PUBLIC APIs:
{public_apis[:10]}

KEY CLASSES:
{key_classes[:5]}

KEY FUNCTIONS:
{key_functions[:5]}

Generate:
1. An integration example showing how to use this library with external systems
2. An advanced usage example showing complex features

For each example, provide:
- A clear title
- A description
- Complete, runnable code
- File references if applicable

Return as formatted code blocks with titles."""

        result = await Runner.run(agent, prompt)

        # Parse LLM response to extract additional examples
        response = str(result.final_output)
        parsed = parse_examples_from_text(response, primary_language)
        examples.extend(parsed)

    except Exception as e:
        log_error("Example Generator", str(e))
        # Add a placeholder integration example
        examples.append(CodeExample(
            title="Integration Example",
            description="Example showing integration with external systems",
            code=f"# Integration example for {primary_language}\n# TODO: Customize for your use case",
            language=primary_language,
            file_references=[],
            prerequisites=[]
        ))

    return examples


def parse_examples_from_text(text: str, language: str) -> List[CodeExample]:
    """
    Parse examples from text output if structured output fails.

    Args:
        text: Raw text containing examples
        language: Programming language

    Returns:
        List of CodeExample objects
    """
    examples = []

    # Find code blocks with titles
    pattern = r'(?:###?\s*|(?:^|\n)(?:\d+\.\s*)?)([\w\s]+?)(?:\n+|\s*\n)(?:(.+?)\n+)?```(\w+)?\n(.*?)```'
    matches = re.findall(pattern, text, re.DOTALL | re.MULTILINE)

    for match in matches:
        title = match[0].strip()
        description = match[1].strip() if match[1] else ""
        lang = match[2] or language
        code = match[3].strip()

        if code and len(code) > 20:  # Skip trivial matches
            examples.append(CodeExample(
                title=title if len(title) < 50 else title[:47] + "...",
                description=description,
                code=code,
                language=lang,
                file_references=[],
                prerequisites=[]
            ))

    return examples[:3]  # Limit to 3 parsed examples


def write_examples_file(examples: List[CodeExample]):
    """
    Write examples to a dedicated markdown file.

    Args:
        examples: List of examples to write
    """
    examples_path = os.path.join(OUTPUT_DIR, "EXAMPLES.md")

    content = "# Code Examples\n\n"
    content += "This document contains practical code examples for using this codebase.\n\n"
    content += "## Table of Contents\n\n"

    for i, example in enumerate(examples, 1):
        anchor = example.title.lower().replace(' ', '-').replace('/', '-')
        content += f"{i}. [{example.title}](#{anchor})\n"

    content += "\n---\n\n"

    for example in examples:
        content += f"## {example.title}\n\n"

        if example.description:
            content += f"{example.description}\n\n"

        if example.prerequisites:
            content += "**Prerequisites:**\n"
            for prereq in example.prerequisites:
                content += f"- {prereq}\n"
            content += "\n"

        content += f"```{example.language}\n{example.code}\n```\n\n"

        if example.file_references:
            content += "**Related files:**\n"
            for ref in example.file_references:
                content += f"- `{ref}`\n"
            content += "\n"

        content += "---\n\n"

    with open(examples_path, 'w') as f:
        f.write(content)

    log_finding("Examples written", examples_path, f"{len(examples)} examples")
