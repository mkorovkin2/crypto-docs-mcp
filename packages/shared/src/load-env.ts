/**
 * Centralized environment variable loader.
 * Always loads .env from the monorepo root, regardless of where scripts are run from.
 *
 * Usage: Import this file FIRST in any entry point before other imports.
 *
 * import '@mina-docs/shared/load-env';
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

// Find the repo root by walking up from this file's location
// This file is at: packages/shared/src/load-env.ts (or dist/load-env.js when compiled)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Navigate up to repo root:
// From src: packages/shared/src -> packages/shared -> packages -> root (3 levels)
// From dist: packages/shared/dist -> packages/shared -> packages -> root (3 levels)
const repoRoot = resolve(__dirname, '..', '..', '..');

const envPath = resolve(repoRoot, '.env');

if (existsSync(envPath)) {
  config({ path: envPath });
} else {
  // Fallback: try current working directory (for backwards compatibility)
  const cwdEnvPath = resolve(process.cwd(), '.env');
  if (existsSync(cwdEnvPath)) {
    config({ path: cwdEnvPath });
  }
  // If no .env found, that's OK - env vars might be set directly in the environment
}
