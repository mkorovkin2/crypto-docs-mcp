"""Pydantic models for handoff documents between agents."""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum


class FileType(str, Enum):
    SOURCE_CODE = "source_code"
    CONFIG = "config"
    DOCUMENTATION = "documentation"
    TEST = "test"
    BUILD = "build"
    DATA = "data"
    OTHER = "other"


class FileClassification(BaseModel):
    """Classification of a single file."""
    path: str
    file_type: FileType
    language: Optional[str] = None
    importance: int = Field(ge=1, le=10, description="1=low, 10=critical")
    description: str = ""


class DiscoveryHandoff(BaseModel):
    """Handoff document from Discovery Agent."""
    repository_path: str
    total_files: int
    files: List[FileClassification]
    directory_structure: Dict[str, Any]
    detected_languages: List[str]
    detected_frameworks: List[str]
    entry_points: List[str]
    summary: str


class FunctionInfo(BaseModel):
    """Information about a function/method."""
    name: str
    line_number: int
    parameters: List[str]
    return_type: Optional[str] = None
    docstring: Optional[str] = None
    description: str
    complexity: str = "low"  # low, medium, high
    calls: List[str] = Field(default_factory=list)


class ClassInfo(BaseModel):
    """Information about a class."""
    name: str
    line_number: int
    base_classes: List[str] = Field(default_factory=list)
    docstring: Optional[str] = None
    description: str
    methods: List[FunctionInfo] = Field(default_factory=list)
    attributes: List[str] = Field(default_factory=list)


class ImportInfo(BaseModel):
    """Information about an import."""
    module: str
    names: List[str] = Field(default_factory=list)
    is_relative: bool = False
    is_external: bool = False


class FileAnalysisHandoff(BaseModel):
    """Handoff document from File Analyzer Agent for a single file."""
    path: str
    language: str
    purpose: str
    imports: List[ImportInfo]
    exports: List[str]
    classes: List[ClassInfo]
    functions: List[FunctionInfo]
    constants: List[str]
    key_insights: List[str]
    dependencies: List[str]
    complexity_score: int = Field(ge=1, le=10)
    raw_summary: str


class ModuleInfo(BaseModel):
    """Information about a module/package."""
    name: str
    path: str
    files: List[str]
    purpose: str
    public_api: List[str]
    internal_components: List[str]


class DependencyEdge(BaseModel):
    """A dependency relationship between two files/modules."""
    source: str
    target: str
    relationship_type: str  # imports, extends, implements, uses, etc.
    strength: str = "normal"  # weak, normal, strong


class ModuleAnalysisHandoff(BaseModel):
    """Handoff document from Module Analyzer Agent."""
    modules: List[ModuleInfo]
    dependency_graph: List[DependencyEdge]
    architecture_patterns: List[str]
    data_flow: List[str]
    entry_points: List[str]
    public_apis: Dict[str, List[str]]
    key_relationships: List[str]
    architectural_insights: List[str]


class DocumentationSection(BaseModel):
    """A section of documentation."""
    title: str
    content: str
    subsections: List["DocumentationSection"] = Field(default_factory=list)


class CodeExample(BaseModel):
    """A code example."""
    title: str
    description: str
    code: str
    language: str
    file_references: List[str] = Field(default_factory=list)
    prerequisites: List[str] = Field(default_factory=list)


class FinalDocumentation(BaseModel):
    """Final synthesized documentation."""
    repository_name: str
    overview: str
    architecture: DocumentationSection
    modules: List[DocumentationSection]
    api_reference: DocumentationSection
    examples: List[CodeExample]
    getting_started: DocumentationSection
    configuration: Optional[DocumentationSection] = None
