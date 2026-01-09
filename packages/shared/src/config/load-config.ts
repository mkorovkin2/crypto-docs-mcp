import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ProjectConfigSchema, type ProjectConfig } from './project-config.js';

// Find the config directory relative to the package root
function findConfigDir(): string {
  // Try common locations
  const candidates = [
    join(process.cwd(), 'config', 'projects'),
    join(process.cwd(), '..', '..', 'config', 'projects'), // From packages/*/
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'config', 'projects'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Default to cwd-based path
  return join(process.cwd(), 'config', 'projects');
}

const CONFIG_DIR = findConfigDir();

export function loadProjectConfig(projectId: string): ProjectConfig {
  const configPath = join(CONFIG_DIR, `${projectId}.json`);

  if (!existsSync(configPath)) {
    throw new Error(`Project config not found: ${configPath}. Available projects: ${listProjects().join(', ') || 'none'}`);
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  return ProjectConfigSchema.parse(raw);
}

export function listProjects(): string[] {
  if (!existsSync(CONFIG_DIR)) {
    return [];
  }

  return readdirSync(CONFIG_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

export function loadAllProjectConfigs(): ProjectConfig[] {
  return listProjects().map(loadProjectConfig);
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
