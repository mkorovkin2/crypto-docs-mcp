"""Documentation agents package for repository documentation system."""

# Note: Imports are done lazily to avoid circular imports with the openai-agents package

__all__ = [
    'DocumentationOrchestrator',
    'generate_documentation',
    'run_discovery',
    'create_discovery_agent',
    'run_file_analysis',
    'create_file_analyzer_agent',
    'run_module_analysis',
    'create_module_analyzer_agent',
    'run_doc_synthesis',
    'create_doc_synthesizer_agent',
    'generate_examples',
    'create_example_generator_agent',
]


def __getattr__(name):
    """Lazy import to avoid circular imports."""
    if name == 'DocumentationOrchestrator':
        from .orchestrator import DocumentationOrchestrator
        return DocumentationOrchestrator
    elif name == 'generate_documentation':
        from .orchestrator import generate_documentation
        return generate_documentation
    elif name == 'run_discovery':
        from .discovery import run_discovery
        return run_discovery
    elif name == 'create_discovery_agent':
        from .discovery import create_discovery_agent
        return create_discovery_agent
    elif name == 'run_file_analysis':
        from .file_analyzer import run_file_analysis
        return run_file_analysis
    elif name == 'create_file_analyzer_agent':
        from .file_analyzer import create_file_analyzer_agent
        return create_file_analyzer_agent
    elif name == 'run_module_analysis':
        from .module_analyzer import run_module_analysis
        return run_module_analysis
    elif name == 'create_module_analyzer_agent':
        from .module_analyzer import create_module_analyzer_agent
        return create_module_analyzer_agent
    elif name == 'run_doc_synthesis':
        from .doc_synthesizer import run_doc_synthesis
        return run_doc_synthesis
    elif name == 'create_doc_synthesizer_agent':
        from .doc_synthesizer import create_doc_synthesizer_agent
        return create_doc_synthesizer_agent
    elif name == 'generate_examples':
        from .example_generator import generate_examples
        return generate_examples
    elif name == 'create_example_generator_agent':
        from .example_generator import create_example_generator_agent
        return create_example_generator_agent
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
