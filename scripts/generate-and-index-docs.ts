#!/usr/bin/env node

import { existsSync } from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import { spawn } from 'child_process';

function printUsage(): void {
  console.log(`
Usage: npm run generate-and-index-docs -- --project <id> [--repo <path>] [--custom <id>] [--output <dir>] [--generate-only|--index-only] [--skip-relationships] [--skip-index]

Options:
  -p, --project            Official project id to index under (e.g. polymarket)
  -r, --repo               Path to repository to document (default: .)
  -c, --custom             Custom id for generated docs (default: repo basename)
  -o, --output             Output directory for docs (default: docs/generated/<custom>)
  --generate-only          Only generate docs (skip indexing)
  --index-only             Only index existing docs (skip generation)
  --skip-relationships     Skip exporting RELATIONSHIPS.md from handoff JSON
  --skip-index             Skip indexing into Qdrant/SQLite
  -h, --help               Show this help

Examples:
  npm run generate-and-index-docs -- --project polymarket --repo ./my-repo
  npm run generate-and-index-docs -- -p polymarket -r ./my-repo -c my-repo-docs
`);
}

function normalizeCustom(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return normalized || 'generated-docs';
}

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function main(): Promise<void> {
  const { values: args } = parseArgs({
    options: {
      project: { type: 'string', short: 'p' },
      repo: { type: 'string', short: 'r' },
      custom: { type: 'string', short: 'c' },
      output: { type: 'string', short: 'o' },
      'generate-only': { type: 'boolean' },
      'index-only': { type: 'boolean' },
      'skip-relationships': { type: 'boolean' },
      'skip-index': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' }
    }
  });

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const generateOnly = Boolean(args['generate-only']);
  const indexOnly = Boolean(args['index-only']);
  if (generateOnly && indexOnly) {
    console.error('Error: --generate-only and --index-only cannot be used together');
    process.exit(1);
  }

  let skipGeneration = false;
  let skipIndex = Boolean(args['skip-index']);
  const skipRelationships = Boolean(args['skip-relationships']);

  if (generateOnly) {
    skipIndex = true;
  }
  if (indexOnly) {
    skipGeneration = true;
  }
  if (indexOnly && skipIndex) {
    console.error('Error: --index-only cannot be combined with --skip-index');
    process.exit(1);
  }

  const project = args.project as string | undefined;
  if (!skipIndex && !project) {
    console.error('Error: --project is required for indexing');
    process.exit(1);
  }

  const repo = args.repo ? path.resolve(args.repo) : process.cwd();
  const outputArg = args.output ? path.resolve(args.output) : '';
  let custom = args.custom as string | undefined;
  if (!custom) {
    custom = outputArg ? path.basename(outputArg) : path.basename(repo);
  }
  const normalizedCustom = normalizeCustom(custom);
  const outputDir = outputArg || path.resolve('docs', 'generated', normalizedCustom);

  const scriptPath = path.resolve(process.argv[1] ?? '');
  const scriptDir = path.dirname(scriptPath);
  const rootDir = path.resolve(scriptDir, '..');
  const docsAgentRun = path.join(rootDir, 'docs-agent-v3', 'run.sh');
  const exporter = path.join(rootDir, 'scripts', 'export-docs-relationships.js');

  if (!skipGeneration) {
    if (!existsSync(docsAgentRun)) {
      console.error(`Error: docs-agent-v3/run.sh not found at ${docsAgentRun}`);
      process.exit(1);
    }

    console.log(`==> Generating docs for: ${repo}`);
    console.log(`    Output: ${outputDir}`);
    await runCommand('bash', [docsAgentRun, repo, '--output', outputDir], rootDir);
  } else {
    if (!existsSync(outputDir)) {
      console.error(`Error: output directory not found at ${outputDir}`);
      process.exit(1);
    }
  }

  if (!skipRelationships) {
    if (!existsSync(exporter)) {
      console.error(`Error: exporter not found at ${exporter}`);
      process.exit(1);
    }

    const handoffPath = path.join(outputDir, '.handoffs', 'module_analysis_handoff.json');
    if (existsSync(handoffPath)) {
      console.log('==> Exporting relationships');
      await runCommand('node', [exporter, '--output', outputDir], rootDir);
    } else if (skipGeneration) {
      console.log(`==> Skipping relationships (handoff not found: ${handoffPath})`);
    } else {
      console.error(`Error: handoff not found after generation: ${handoffPath}`);
      process.exit(1);
    }
  }

  if (!skipIndex) {
    console.log('==> Indexing generated docs');
    await runCommand(
      'npm',
      ['run', 'index:generated-docs', '--', '--project', project!, '--dir', outputDir, '--custom', normalizedCustom],
      rootDir
    );
  }
}

main().catch((error) => {
  console.error('Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
