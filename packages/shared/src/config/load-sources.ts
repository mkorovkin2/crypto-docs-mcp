import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  SourceEntrySchema,
  ProjectSourcesConfigSchema,
  type SourceEntry,
  type ProjectSources,
  type GitHubSourceEntry,
} from './source-registry.js';

const PROJECT_SOURCES_FILE = 'project-sources.json';

/**
 * Find the sources config directory
 */
function findSourcesDir(): string {
  const candidates = [
    join(process.cwd(), 'config', 'sources'),
    join(process.cwd(), '..', '..', 'config', 'sources'), // From packages/*/
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'config', 'sources'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Default to cwd-based path (may not exist yet)
  return join(process.cwd(), 'config', 'sources');
}

let SOURCES_DIR: string | null = null;

export function getSourcesDir(): string {
  if (!SOURCES_DIR) {
    SOURCES_DIR = findSourcesDir();
  }
  return SOURCES_DIR;
}

/**
 * Check if source registry is available
 */
export function sourceRegistryExists(): boolean {
  const sourcesDir = getSourcesDir();
  return existsSync(sourcesDir);
}

/**
 * Load a single source entry by ID
 */
export function loadSourceEntry(sourceId: string): SourceEntry {
  const sourcesDir = getSourcesDir();
  const filePath = join(sourcesDir, `${sourceId}.json`);

  if (!existsSync(filePath)) {
    throw new Error(`Source not found: ${sourceId}. Available sources: ${listSourceIds().join(', ') || 'none'}`);
  }

  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  return SourceEntrySchema.parse(raw);
}

/**
 * Load all source entries
 */
export function loadAllSources(): SourceEntry[] {
  const sourcesDir = getSourcesDir();

  if (!existsSync(sourcesDir)) {
    return [];
  }

  const files = readdirSync(sourcesDir)
    .filter(f => f.endsWith('.json') && f !== PROJECT_SOURCES_FILE);

  return files.map(f => {
    const content = JSON.parse(readFileSync(join(sourcesDir, f), 'utf-8'));
    return SourceEntrySchema.parse(content);
  });
}

/**
 * List all available source IDs
 */
export function listSourceIds(): string[] {
  const sourcesDir = getSourcesDir();

  if (!existsSync(sourcesDir)) {
    return [];
  }

  return readdirSync(sourcesDir)
    .filter(f => f.endsWith('.json') && f !== PROJECT_SOURCES_FILE)
    .map(f => f.replace('.json', ''));
}

/**
 * Load project-to-sources mappings
 */
export function loadProjectSourcesMappings(): ProjectSources[] {
  const sourcesDir = getSourcesDir();
  const mappingFile = join(sourcesDir, PROJECT_SOURCES_FILE);

  if (!existsSync(mappingFile)) {
    return [];
  }

  const raw = JSON.parse(readFileSync(mappingFile, 'utf-8'));
  return ProjectSourcesConfigSchema.parse(raw);
}

/**
 * Load all sources for a specific project
 */
export function loadProjectSources(projectId: string): SourceEntry[] {
  const mappings = loadProjectSourcesMappings();
  const projectMapping = mappings.find(m => m.projectId === projectId);

  if (!projectMapping) {
    return [];
  }

  return projectMapping.sources.map(sourceId => loadSourceEntry(sourceId));
}

/**
 * Load only GitHub sources for a project
 */
export function loadProjectGitHubSources(projectId: string): GitHubSourceEntry[] {
  const sources = loadProjectSources(projectId);
  return sources.filter((s): s is GitHubSourceEntry => s.type === 'github');
}

/**
 * Get sources grouped by trust level
 */
export function getSourcesByTrustLevel(projectId: string): Record<string, SourceEntry[]> {
  const sources = loadProjectSources(projectId);
  return {
    official: sources.filter(s => s.trustLevel === 'official'),
    'verified-community': sources.filter(s => s.trustLevel === 'verified-community'),
    community: sources.filter(s => s.trustLevel === 'community'),
  };
}

/**
 * Save a new source entry (used by discovery CLI)
 */
export function saveSourceEntry(source: SourceEntry): void {
  const sourcesDir = getSourcesDir();
  const filePath = join(sourcesDir, `${source.id}.json`);
  writeFileSync(filePath, JSON.stringify(source, null, 2));
}

/**
 * Add a source to a project's source list
 */
export function addSourceToProject(projectId: string, sourceId: string): void {
  const sourcesDir = getSourcesDir();
  const mappingFile = join(sourcesDir, PROJECT_SOURCES_FILE);

  let mappings: ProjectSources[] = [];
  if (existsSync(mappingFile)) {
    mappings = JSON.parse(readFileSync(mappingFile, 'utf-8'));
  }

  const projectMapping = mappings.find(m => m.projectId === projectId);
  if (projectMapping) {
    if (!projectMapping.sources.includes(sourceId)) {
      projectMapping.sources.push(sourceId);
    }
  } else {
    mappings.push({ projectId, sources: [sourceId] });
  }

  writeFileSync(mappingFile, JSON.stringify(mappings, null, 2));
}
