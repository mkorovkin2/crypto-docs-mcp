/**
 * Source Collector with Agentic Loop
 *
 * Uses Tavily for search, LLM for evaluation, and an agentic loop that:
 * - Evaluates each source for relevance
 * - Generates new queries if not finding enough good sources
 * - Prioritizes diversity (different projects/domains)
 * - Deduplicates by project, not just URL
 */

import { WebSearchClient, createLLMClient, type LLMClient } from '@mina-docs/shared';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DEFAULT_MODEL = 'grok-4-1-fast-non-reasoning-latest';
const MAX_ITERATIONS = 10;
const MAX_SEARCHES_PER_ITERATION = 3;

interface CollectedSource {
  url: string;
  title: string;
  description: string;
  type: 'github' | 'blog' | 'docs' | 'tutorial';
  domain: string;
  project: string; // Extracted project/repo name for diversity
  relevanceScore: number;
  relevanceReason: string;
  discoveredAt: string;
}

interface CollectorConfig {
  prompt: string;
  count: number;
  outputDir: string;
  model?: string;
  minRelevance?: number;
  excludeDomains?: string[];
  verbose?: boolean;
}

interface EvaluationResult {
  isRelevant: boolean;
  score: number;
  reason: string;
  projectName: string; // LLM extracts the project name
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Extract project identifier from URL for diversity tracking
 */
function extractProjectId(url: string): string {
  // GitHub: org/repo
  const ghMatch = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
  if (ghMatch) return ghMatch[1].toLowerCase();

  // For other URLs, use domain + first path segment
  try {
    const u = new URL(url);
    const firstPath = u.pathname.split('/').filter(Boolean)[0] || '';
    return `${u.hostname}/${firstPath}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Determine source type from URL
 */
function getSourceType(url: string, title: string, content: string): CollectedSource['type'] {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (lowerUrl.includes('github.com')) return 'github';
  if (lowerUrl.includes('/docs') || lowerUrl.includes('docs.') || lowerTitle.includes('documentation')) return 'docs';
  if (lowerTitle.includes('tutorial') || lowerContent.includes('step by step') || lowerContent.includes('how to')) return 'tutorial';
  return 'blog';
}

/**
 * Use LLM to evaluate if a source is relevant and extract project name
 */
async function evaluateSource(
  llm: LLMClient,
  searchPrompt: string,
  source: { url: string; title: string; content: string },
  existingProjects: Set<string>,
  verbose: boolean
): Promise<EvaluationResult> {
  const existingList = Array.from(existingProjects).slice(0, 10).join(', ') || 'none yet';

  const systemPrompt = `You evaluate web search results for relevance and extract project names.
Respond with ONLY valid JSON, no markdown or explanation.`;

  const userPrompt = `Evaluate if this source is useful for someone looking for: "${searchPrompt}"

Source:
- Title: ${source.title}
- URL: ${source.url}
- Content: ${source.content.slice(0, 600)}

Already collected projects: ${existingList}

Respond with JSON:
{
  "isRelevant": true/false,
  "score": 0-100,
  "reason": "brief explanation",
  "projectName": "extracted project/repo name or 'unknown'"
}

Scoring:
- 80-100: Third-party GitHub repos with real code examples, community tutorials
- 60-79: Useful third-party blog posts or guides with code
- 40-59: Official documentation (we want THIRD-PARTY sources, not official docs)
- 0-39: Off-topic, too generic, or no practical value

PRIORITIES:
1. GitHub repositories from individual developers or community projects (BEST)
2. Third-party blog posts and tutorials with actual code
3. Community guides and examples

PENALIZE:
- Official documentation sites (-30 points) - we want third-party sources
- Already collected projects (-20 points)
- Sources without actual code examples (-15 points)

Be strict - only 60+ for THIRD-PARTY sources with ACTUAL code value.`;

  try {
    const response = await llm.synthesize(systemPrompt, userPrompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      if (verbose) console.log(`   ⚠️ Parse error: ${response.slice(0, 100)}`);
      return { isRelevant: false, score: 0, reason: 'Parse failed', projectName: 'unknown' };
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      isRelevant: result.isRelevant === true,
      score: typeof result.score === 'number' ? result.score : 0,
      reason: result.reason || 'No reason',
      projectName: result.projectName || 'unknown',
    };
  } catch (error) {
    if (verbose) console.log(`   ⚠️ Eval error: ${error instanceof Error ? error.message : error}`);
    return { isRelevant: false, score: 0, reason: 'Error', projectName: 'unknown' };
  }
}

/**
 * Use LLM to generate new search queries based on what we've found so far
 */
async function generateNewQueries(
  llm: LLMClient,
  originalPrompt: string,
  triedQueries: Set<string>,
  collectedProjects: Set<string>,
  needed: number,
  verbose: boolean
): Promise<string[]> {
  const triedList = Array.from(triedQueries).slice(-10).join('\n- ');
  const projectsList = Array.from(collectedProjects).join(', ') || 'none';

  const systemPrompt = `You generate diverse search queries to find code examples and tutorials.
Respond with ONLY a JSON array of 3 new search queries.`;

  const userPrompt = `I need ${needed} more diverse sources for: "${originalPrompt}"

Already tried queries:
- ${triedList}

Already found projects: ${projectsList}

Generate 3 NEW search queries that:
1. Are DIFFERENT from tried queries
2. Will find DIFFERENT projects than already found
3. Focus on code examples, tutorials, GitHub repos
4. Try different angles (e.g., "build X with Y", "Y tutorial", "Y example project")

Respond with JSON array only: ["query1", "query2", "query3"]`;

  try {
    const response = await llm.synthesize(systemPrompt, userPrompt);
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      if (verbose) console.log(`   ⚠️ Query generation parse error`);
      return [];
    }
    const queries = JSON.parse(jsonMatch[0]);
    return queries.filter((q: string) => typeof q === 'string' && !triedQueries.has(q.toLowerCase()));
  } catch (error) {
    if (verbose) console.log(`   ⚠️ Query generation error: ${error}`);
    return [];
  }
}

/**
 * Source collector with diversity tracking
 */
class DiverseSourceCollector {
  private sources: Map<string, CollectedSource> = new Map();
  private projectCounts: Map<string, number> = new Map();
  private domainCounts: Map<string, number> = new Map();
  private targetCount: number;
  private maxPerProject: number;
  private maxPerDomain: number;

  constructor(targetCount: number, maxPerProject = 2, maxPerDomain = 5) {
    this.targetCount = targetCount;
    this.maxPerProject = maxPerProject;
    this.maxPerDomain = maxPerDomain;
  }

  canAdd(project: string, domain: string): boolean {
    const projectCount = this.projectCounts.get(project) || 0;
    const domainCount = this.domainCounts.get(domain) || 0;
    return projectCount < this.maxPerProject && domainCount < this.maxPerDomain;
  }

  add(source: CollectedSource): boolean {
    const normalizedUrl = source.url.replace(/\/$/, '').toLowerCase();
    if (this.sources.has(normalizedUrl)) return false;

    const project = source.project.toLowerCase();
    const domain = source.domain.toLowerCase();

    if (!this.canAdd(project, domain)) return false;

    this.sources.set(normalizedUrl, source);
    this.projectCounts.set(project, (this.projectCounts.get(project) || 0) + 1);
    this.domainCounts.set(domain, (this.domainCounts.get(domain) || 0) + 1);
    return true;
  }

  getProjects(): Set<string> {
    return new Set(this.projectCounts.keys());
  }

  getAll(): CollectedSource[] {
    return Array.from(this.sources.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  count(): number {
    return this.sources.size;
  }

  needsMore(): boolean {
    return this.sources.size < this.targetCount;
  }

  remaining(): number {
    return Math.max(0, this.targetCount - this.sources.size);
  }
}

/**
 * Initial seed queries
 */
function getSeedQueries(prompt: string): string[] {
  return [
    `${prompt} examples`,
    `${prompt} tutorial`,
    `${prompt} github`,
    `${prompt} how to build`,
    `${prompt} starter template`,
  ];
}

/**
 * Main agentic collection loop
 */
async function collectSources(config: CollectorConfig): Promise<CollectedSource[]> {
  const { prompt: searchPrompt, count, model, minRelevance = 60, excludeDomains = [], verbose = false } = config;

  console.log(`\n🔍 Starting agentic source collection...`);
  console.log(`   Prompt: "${searchPrompt}"`);
  console.log(`   Target: ${count} diverse sources (min relevance: ${minRelevance})`);
  if (excludeDomains.length > 0) {
    console.log(`   Excluding: ${excludeDomains.join(', ')}`);
  }
  console.log(`   Max iterations: ${MAX_ITERATIONS}\n`);

  const tavilyApiKey = process.env.TAVILY_API_KEY;
  const xaiApiKey = process.env.XAI_API_KEY;

  if (!tavilyApiKey) throw new Error('TAVILY_API_KEY required');
  if (!xaiApiKey) throw new Error('XAI_API_KEY required');

  const searchClient = new WebSearchClient({
    apiKey: tavilyApiKey,
    maxResults: 10,
    searchDepth: 'advanced',
  });

  const llm = createLLMClient({
    provider: 'xai',
    xaiApiKey,
    model: model || DEFAULT_MODEL,
    temperature: 0.3,
  });

  const collector = new DiverseSourceCollector(count);
  const triedQueries = new Set<string>();
  let pendingQueries = getSeedQueries(searchPrompt);

  let totalEvaluated = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let totalDuplicateProject = 0;

  // Agentic loop
  for (let iteration = 0; iteration < MAX_ITERATIONS && collector.needsMore(); iteration++) {
    console.log(`\n━━━ Iteration ${iteration + 1}/${MAX_ITERATIONS} ━━━`);
    console.log(`   Progress: ${collector.count()}/${count} | Need: ${collector.remaining()}`);

    // Process pending queries
    const queriesToRun = pendingQueries.slice(0, MAX_SEARCHES_PER_ITERATION);
    pendingQueries = pendingQueries.slice(MAX_SEARCHES_PER_ITERATION);

    for (const query of queriesToRun) {
      if (!collector.needsMore()) break;
      if (triedQueries.has(query.toLowerCase())) continue;

      triedQueries.add(query.toLowerCase());
      console.log(`\n🔎 "${query}"`);

      try {
        const response = await searchClient.search(query, {
          maxResults: 10,
          includeAnswer: false,
          excludeDomains: excludeDomains.length > 0 ? excludeDomains : undefined,
        });
        console.log(`   Found ${response.results.length} results`);

        for (const result of response.results) {
          if (!collector.needsMore()) break;

          const normalizedUrl = result.url.replace(/\/$/, '').toLowerCase();
          if (collector.getAll().some(s => s.url.replace(/\/$/, '').toLowerCase() === normalizedUrl)) {
            continue;
          }

          totalEvaluated++;
          const domain = extractDomain(result.url);
          const projectId = extractProjectId(result.url);

          // Quick domain/project check before LLM eval
          if (!collector.canAdd(projectId, domain)) {
            totalDuplicateProject++;
            if (verbose) console.log(`   ⏭️ Skip (already have enough from ${projectId})`);
            continue;
          }

          // LLM evaluation
          console.log(`   📎 ${result.url}`);
          const evaluation = await evaluateSource(
            llm,
            searchPrompt,
            { url: result.url, title: result.title || '', content: result.content || '' },
            collector.getProjects(),
            verbose
          );

          if (evaluation.score >= minRelevance) {
            const source: CollectedSource = {
              url: result.url,
              title: result.title || 'Untitled',
              description: result.content?.slice(0, 300) || '',
              type: getSourceType(result.url, result.title || '', result.content || ''),
              domain,
              project: evaluation.projectName !== 'unknown' ? evaluation.projectName : projectId,
              relevanceScore: evaluation.score,
              relevanceReason: evaluation.reason,
              discoveredAt: new Date().toISOString(),
            };

            const added = collector.add(source);
            if (added) {
              totalAccepted++;
              console.log(`   ✅ [${evaluation.score}] ${source.title.slice(0, 50)}...`);
              if (verbose) console.log(`      Project: ${source.project} | ${evaluation.reason}`);
            } else {
              totalDuplicateProject++;
              if (verbose) console.log(`   ⏭️ [${evaluation.score}] Skipped (diversity limit)`);
            }
          } else {
            totalRejected++;
            if (verbose) {
              console.log(`   ❌ [${evaluation.score}] ${result.title?.slice(0, 40)}... - ${evaluation.reason}`);
            }
          }
        }

      } catch (error) {
        console.error(`   ⚠️ Search error: ${error instanceof Error ? error.message : error}`);
      }
    }

    // If we still need more and have no pending queries, generate new ones
    if (collector.needsMore() && pendingQueries.length === 0) {
      console.log(`\n🧠 Generating new search queries...`);
      const newQueries = await generateNewQueries(
        llm,
        searchPrompt,
        triedQueries,
        collector.getProjects(),
        collector.remaining(),
        verbose
      );

      if (newQueries.length > 0) {
        console.log(`   Generated: ${newQueries.join(', ')}`);
        pendingQueries.push(...newQueries);
      } else {
        console.log(`   No new queries generated, stopping.`);
        break;
      }
    }

    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ COLLECTION COMPLETE`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`   Total evaluated: ${totalEvaluated}`);
  console.log(`   Accepted: ${totalAccepted}`);
  console.log(`   Rejected (low score): ${totalRejected}`);
  console.log(`   Skipped (diversity): ${totalDuplicateProject}`);
  console.log(`   Unique projects: ${collector.getProjects().size}`);
  console.log(`   Final sources: ${collector.count()}\n`);

  return collector.getAll();
}

/**
 * Convert to source entry format
 */
function toSourceEntry(source: CollectedSource, projectId: string, index: number): object {
  const id = `${projectId}-discovered-${index}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);

  if (source.type === 'github' && source.url.includes('github.com')) {
    const match = source.url.match(/github\.com\/([^\/]+\/[^\/]+)/);
    const repo = match ? match[1].replace(/\.git$/, '').split('/').slice(0, 2).join('/') : source.url;

    return {
      id,
      type: 'github',
      repoType: 'example-repo',
      trustLevel: 'community',
      repo,
      branch: 'main',
      scrapeStrategy: {
        exampleDirs: ['examples', 'src', 'demo'],
        exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      },
      qualityThresholds: {
        minDocumentationScore: 20,
        minLLMRelevanceScore: 40,
        requireReadme: true,
      },
      description: source.description,
      relevanceScore: source.relevanceScore,
      relevanceReason: source.relevanceReason,
      project: source.project,
      addedAt: source.discoveredAt,
      discoveredFrom: source.url,
    };
  } else {
    return {
      id,
      type: 'blog',
      trustLevel: 'community',
      url: source.url,
      description: source.description,
      relevanceScore: source.relevanceScore,
      relevanceReason: source.relevanceReason,
      project: source.project,
      addedAt: source.discoveredAt,
    };
  }
}

/**
 * Write output files
 */
function writeOutput(sources: CollectedSource[], projectId: string, outputDir: string) {
  const fullOutputDir = join(outputDir, 'discovered');
  if (!existsSync(fullOutputDir)) mkdirSync(fullOutputDir, { recursive: true });

  const timestamp = new Date().toISOString().split('T')[0];
  const entries = sources.map((s, i) => toSourceEntry(s, projectId, i));

  const outputFile = join(fullOutputDir, `${projectId}-${timestamp}.json`);
  writeFileSync(outputFile, JSON.stringify(entries, null, 2));
  console.log(`📁 Written ${entries.length} sources to: ${outputFile}`);

  const reportFile = join(fullOutputDir, `${projectId}-${timestamp}-report.md`);
  writeFileSync(reportFile, generateReport(sources, projectId));
  console.log(`📄 Written report to: ${reportFile}`);
}

/**
 * Generate markdown report
 */
function generateReport(sources: CollectedSource[], projectId: string): string {
  const byType = sources.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniqueProjects = new Set(sources.map(s => s.project)).size;
  const uniqueDomains = new Set(sources.map(s => s.domain)).size;
  const avgScore = sources.length > 0
    ? Math.round(sources.reduce((sum, s) => sum + s.relevanceScore, 0) / sources.length)
    : 0;

  let report = `# Discovered Sources Report\n\n`;
  report += `**Project**: ${projectId}\n`;
  report += `**Date**: ${new Date().toISOString()}\n`;
  report += `**Total Sources**: ${sources.length}\n`;
  report += `**Unique Projects**: ${uniqueProjects}\n`;
  report += `**Unique Domains**: ${uniqueDomains}\n`;
  report += `**Average Relevance**: ${avgScore}/100\n\n`;

  report += `## By Type\n`;
  for (const [type, count] of Object.entries(byType)) report += `- ${type}: ${count}\n`;

  report += `\n## Sources (by relevance)\n\n`;
  for (const source of sources) {
    report += `### [${source.relevanceScore}] ${source.title}\n`;
    report += `- **URL**: ${source.url}\n`;
    report += `- **Project**: ${source.project}\n`;
    report += `- **Type**: ${source.type}\n`;
    report += `- **Why**: ${source.relevanceReason}\n\n`;
  }

  return report;
}

/**
 * Parse CLI args
 */
function parseArgs(): CollectorConfig {
  const args = process.argv.slice(2);
  const config: CollectorConfig = {
    prompt: '',
    count: 20,
    outputDir: './config/sources',
    model: DEFAULT_MODEL,
    minRelevance: 60,
    excludeDomains: [],
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--prompt': case '-p': config.prompt = args[++i]; break;
      case '--count': case '-n': config.count = parseInt(args[++i], 10); break;
      case '--output': case '-o': config.outputDir = args[++i]; break;
      case '--model': case '-m': config.model = args[++i]; break;
      case '--min-relevance': case '-r': config.minRelevance = parseInt(args[++i], 10); break;
      case '--exclude-domains': case '-x': config.excludeDomains = args[++i].split(',').map(d => d.trim()); break;
      case '--verbose': case '-v': config.verbose = true; break;
      case '--help': case '-h':
        console.log(`
Source Collector - Agentic search with LLM evaluation and diversity

Usage:
  npm run collect-sources-for-project -- -p "prompt" [options]

Options:
  -p, --prompt <text>       Search prompt (required)
  -n, --count <number>      Target sources (default: 20)
  -r, --min-relevance <n>   Min score 0-100 (default: 60)
  -x, --exclude-domains <d> Comma-separated domains to exclude (e.g. docs.x.com,x.com)
  -m, --model <name>        LLM model (default: grok-4-1-fast-non-reasoning-latest)
  -o, --output <dir>        Output dir (default: ./config/sources)
  -v, --verbose             Verbose output

Environment:
  TAVILY_API_KEY    Tavily API key
  XAI_API_KEY       XAI API key for LLM

Examples:
  npm run collect-sources-for-project -- -p "o1js zkApp" -n 20
  npm run collect-sources-for-project -- -p "Solana Anchor" -n 30 -r 70 -v
  npm run collect-sources-for-project -- -p "o1js zkApp" -x "docs.minaprotocol.com,minaprotocol.com"
`);
        process.exit(0);
    }
  }

  if (!config.prompt) { console.error('Error: --prompt required'); process.exit(1); }
  return config;
}

async function main() {
  await import('@mina-docs/shared/load-env');
  const config = parseArgs();
  const projectId = config.prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);

  try {
    const sources = await collectSources(config);
    if (sources.length > 0) {
      writeOutput(sources, projectId, config.outputDir);
    } else {
      console.log('\n⚠️ No sources met the criteria.');
    }
  } catch (error) {
    console.error('\n❌ Fatal:', error);
    process.exit(1);
  }
}

main();
