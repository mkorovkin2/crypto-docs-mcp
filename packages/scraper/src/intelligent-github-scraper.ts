/**
 * Intelligent GitHub Scraper
 *
 * Enhanced scraper that uses the source registry and implements
 * a multi-stage quality pipeline:
 * 1. Directory filtering (repo-type aware)
 * 2. Quick relevance heuristics
 * 3. Documentation score assessment
 * 4. LLM relevance validation
 *
 * Only indexes code that passes all quality gates.
 */

import { randomUUID } from 'crypto';
import type { DocumentChunk, GitHubSourceEntry, TrustLevel } from '@mina-docs/shared';
import { minimatch } from 'minimatch';
import {
  assessDocumentation,
  assessLLMRelevance,
  quickRelevanceCheck,
  type DocumentationScore,
  type LLMRelevanceResult,
} from './quality-assessor.js';
import {
  fetchReadmeContext,
  isExampleProject,
  type ReadmeContext,
} from './readme-extractor.js';

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubContent {
  content: string;
  encoding: string;
}

interface RepoMetadata {
  stars: number;
  forks: number;
  lastCommit: string;
  topics: string[];
  isArchived: boolean;
}

export interface IntelligentScraperOptions {
  source: GitHubSourceEntry;
  project: string;
  openaiApiKey: string;
  githubToken?: string;
  dryRun?: boolean; // If true, don't call LLM, just log what would be indexed
}

export interface ScrapeResult {
  path: string;
  chunks: DocumentChunk[];
  skipped: boolean;
  skipReason?: string;
  qualityMetrics?: {
    documentationScore: number;
    llmScore: number;
    exampleDescription: string;
  };
}

export interface ScrapeStats {
  totalFiles: number;
  indexed: number;
  skipped: number;
  skipReasons: Record<string, number>;
}

export class IntelligentGitHubScraper {
  private source: GitHubSourceEntry;
  private project: string;
  private openaiApiKey: string;
  private dryRun: boolean;
  private baseApiUrl: string;
  private headers: Record<string, string>;
  private readmeCache: Map<string, ReadmeContext | null> = new Map();
  private repoMetadata: RepoMetadata | null = null;

  constructor(options: IntelligentScraperOptions) {
    this.source = options.source;
    this.project = options.project;
    this.openaiApiKey = options.openaiApiKey;
    this.dryRun = options.dryRun || false;
    this.baseApiUrl = `https://api.github.com/repos/${this.source.repo}`;
    this.headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'crypto-docs-scraper',
    };

    if (options.githubToken) {
      this.headers['Authorization'] = `token ${options.githubToken}`;
    }
  }

  /**
   * Fetch repository metadata (stars, forks, etc.)
   */
  async fetchRepoMetadata(): Promise<RepoMetadata | null> {
    if (this.repoMetadata) return this.repoMetadata;

    try {
      const response = await fetch(this.baseApiUrl, { headers: this.headers });
      if (!response.ok) return null;

      const data = await response.json();
      this.repoMetadata = {
        stars: data.stargazers_count,
        forks: data.forks_count,
        lastCommit: data.pushed_at,
        topics: data.topics || [],
        isArchived: data.archived,
      };
      return this.repoMetadata;
    } catch {
      return null;
    }
  }

  /**
   * List all files in the repository
   */
  async listAllFiles(): Promise<string[]> {
    try {
      const url = `${this.baseApiUrl}/git/trees/${this.source.branch}?recursive=1`;
      const response = await fetch(url, { headers: this.headers });

      if (!response.ok) {
        console.error(`  Failed to list files: ${response.status}`);
        return [];
      }

      const data = await response.json() as GitHubTreeResponse;
      return data.tree
        .filter(item => item.type === 'blob')
        .map(item => item.path);
    } catch (error) {
      console.error('  Error listing files:', error);
      return [];
    }
  }

  /**
   * Fetch file content from GitHub
   */
  async fetchFile(path: string): Promise<string | null> {
    try {
      const url = `${this.baseApiUrl}/contents/${path}?ref=${this.source.branch}`;
      const response = await fetch(url, { headers: this.headers });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as GitHubContent;
      if (data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return data.content;
    } catch {
      return null;
    }
  }

  /**
   * Detect language from file extension
   */
  detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'rs': 'rust',
      'go': 'go',
      'py': 'python',
      'sol': 'solidity',
      'move': 'move',
    };
    return langMap[ext] || ext;
  }

  /**
   * Stage 1: Directory-based filtering
   * Different logic for SDK vs example repos
   */
  shouldScrapeFile(filePath: string): { pass: boolean; reason: string } {
    const strategy = this.source.scrapeStrategy;
    const ext = '.' + (filePath.split('.').pop() || '');

    // Check extension
    if (!strategy.extensions.includes(ext)) {
      return { pass: false, reason: `Extension ${ext} not in allowed list` };
    }

    // Check exclusions
    if (strategy.exclude.some(pattern => minimatch(filePath, pattern, { matchBase: true }))) {
      return { pass: false, reason: 'Matches exclude pattern' };
    }

    const repoType = this.source.repoType;

    if (repoType === 'sdk') {
      // SDK repos: only scrape apiPaths and exampleDirs
      const apiPaths = strategy.apiPaths || [];
      const inApiPath = apiPaths.some(p => minimatch(filePath, p, { matchBase: true }));
      const inExampleDir = strategy.exampleDirs.some(dir =>
        filePath.startsWith(dir + '/') || filePath.includes('/' + dir + '/')
      );

      if (!inApiPath && !inExampleDir) {
        return { pass: false, reason: 'SDK repo: not in apiPaths or exampleDirs' };
      }

      // For SDK apiPaths, we're more lenient (API reference is always useful)
      if (inApiPath) {
        return { pass: true, reason: 'In SDK apiPaths' };
      }
    }

    // For example/tutorial repos, check if in example directories
    const inExampleDir = strategy.exampleDirs.some(dir =>
      filePath.startsWith(dir + '/') || filePath.includes('/' + dir + '/')
    );

    if (repoType === 'example-repo' || repoType === 'tutorial-repo') {
      // Example repos get broader scraping but still prioritize example dirs
      if (!inExampleDir) {
        // Allow root-level files in example repos
        const depth = filePath.split('/').length;
        if (depth > 2) {
          return { pass: false, reason: 'Example repo: not in exampleDirs and too deep' };
        }
      }
    }

    return { pass: true, reason: 'Passed directory filtering' };
  }

  /**
   * Get README context with caching
   */
  async getReadmeContext(filePath: string): Promise<ReadmeContext | null> {
    const dirPath = filePath.split('/').slice(0, -1).join('/') || '.';

    if (this.readmeCache.has(dirPath)) {
      return this.readmeCache.get(dirPath)!;
    }

    const context = await fetchReadmeContext(filePath, (p) => this.fetchFile(p));
    this.readmeCache.set(dirPath, context);
    return context;
  }

  /**
   * Run the full quality pipeline on a file
   */
  async assessFileQuality(
    filePath: string,
    content: string,
    language: string
  ): Promise<{
    shouldIndex: boolean;
    documentationScore: DocumentationScore;
    llmResult: LLMRelevanceResult | null;
    readmeContext: ReadmeContext | null;
    rejectionReason?: string;
  }> {
    const thresholds = this.source.qualityThresholds;

    // Stage 2: Quick heuristic check
    const quickCheck = quickRelevanceCheck(filePath, content);
    if (!quickCheck.pass) {
      return {
        shouldIndex: false,
        documentationScore: { score: 0, hasReadme: false, hasJsDoc: false, hasInlineComments: false, commentDensity: 0 },
        llmResult: null,
        readmeContext: null,
        rejectionReason: quickCheck.reason,
      };
    }

    // Stage 3: Fetch README context
    const readmeContext = await this.getReadmeContext(filePath);

    // Check README requirement
    if (thresholds.requireReadme && !readmeContext) {
      return {
        shouldIndex: false,
        documentationScore: { score: 0, hasReadme: false, hasJsDoc: false, hasInlineComments: false, commentDensity: 0 },
        llmResult: null,
        readmeContext: null,
        rejectionReason: 'No README found (required)',
      };
    }

    // Stage 4: Assess documentation quality
    const docScore = assessDocumentation(content, readmeContext?.fullContent || null, language);

    if (docScore.score < thresholds.minDocumentationScore) {
      return {
        shouldIndex: false,
        documentationScore: docScore,
        llmResult: null,
        readmeContext,
        rejectionReason: `Documentation score ${docScore.score} < ${thresholds.minDocumentationScore}`,
      };
    }

    // Stage 5: LLM relevance assessment (skip in dry run)
    if (this.dryRun) {
      return {
        shouldIndex: true,
        documentationScore: docScore,
        llmResult: null,
        readmeContext,
      };
    }

    const llmResult = await assessLLMRelevance(
      content,
      filePath,
      readmeContext?.relevantExcerpt || null,
      this.project,
      this.openaiApiKey
    );

    if (llmResult.score < thresholds.minLLMRelevanceScore) {
      return {
        shouldIndex: false,
        documentationScore: docScore,
        llmResult,
        readmeContext,
        rejectionReason: `LLM score ${llmResult.score} < ${thresholds.minLLMRelevanceScore}: ${llmResult.reasoning}`,
      };
    }

    return {
      shouldIndex: true,
      documentationScore: docScore,
      llmResult,
      readmeContext,
    };
  }

  /**
   * Parse file into chunks (simplified - delegates to detailed parsing)
   */
  parseSourceFile(path: string, content: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const fileName = path.split('/').pop() || path;
    const language = this.detectLanguage(path);
    const repoName = this.source.repo.split('/').pop() || this.source.repo;

    // For now, store the whole file as a chunk (the existing detailed parsing can be added later)
    // This ensures we capture complete examples
    if (content.length > 100) {
      chunks.push({
        id: randomUUID(),
        url: `https://github.com/${this.source.repo}/blob/${this.source.branch}/${path}`,
        title: `${repoName}: ${fileName}`,
        section: fileName,
        content: content.slice(0, 8000), // Larger limit for complete examples
        contentType: 'code',
        project: this.project,
        metadata: {
          headings: [repoName, 'Source Code', fileName],
          codeLanguage: language,
          sourceType: 'github',
          filePath: path,
          lastScraped: new Date().toISOString(),
        },
      });
    }

    return chunks;
  }

  /**
   * Enrich chunks with quality metadata
   */
  enrichChunks(
    chunks: DocumentChunk[],
    quality: {
      documentationScore: DocumentationScore;
      llmResult: LLMRelevanceResult | null;
      readmeContext: ReadmeContext | null;
    }
  ): void {
    for (const chunk of chunks) {
      // Trust level from source
      chunk.metadata.trustLevel = this.source.trustLevel;
      chunk.metadata.sourceId = this.source.id;

      // Quality scores
      if (quality.llmResult) {
        chunk.metadata.qualityScore = quality.llmResult.score;
        chunk.metadata.exampleDescription = quality.llmResult.exampleDescription;
        chunk.metadata.prerequisites = quality.llmResult.prerequisites;
        chunk.metadata.versionHint = quality.llmResult.versionHint || undefined;
        chunk.metadata.indexedReason = `Doc: ${quality.documentationScore.score}, LLM: ${quality.llmResult.score}`;
      } else {
        chunk.metadata.qualityScore = quality.documentationScore.score;
        chunk.metadata.indexedReason = `Doc: ${quality.documentationScore.score} (dry run)`;
      }

      // README context
      if (quality.readmeContext) {
        chunk.metadata.readmeContext = quality.readmeContext.relevantExcerpt;
      }

      // Repo stats
      if (this.repoMetadata) {
        chunk.metadata.repoStats = {
          stars: this.repoMetadata.stars,
          forks: this.repoMetadata.forks,
          lastCommit: this.repoMetadata.lastCommit,
        };
      }
    }
  }

  /**
   * Main scrape method with quality pipeline
   */
  async *scrape(): AsyncGenerator<ScrapeResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scraping: ${this.source.repo}`);
    console.log(`Type: ${this.source.repoType} | Trust: ${this.source.trustLevel}`);
    console.log(`${'='.repeat(60)}`);

    // Fetch repo metadata
    await this.fetchRepoMetadata();
    if (this.repoMetadata) {
      console.log(`Stars: ${this.repoMetadata.stars} | Forks: ${this.repoMetadata.forks}`);
      if (this.repoMetadata.isArchived) {
        console.log(`WARNING: Repository is archived`);
      }
    }

    // List all files
    const allFiles = await this.listAllFiles();
    console.log(`\nFound ${allFiles.length} total files`);

    let processed = 0;
    let indexed = 0;
    let skipped = 0;

    for (const filePath of allFiles) {
      processed++;

      // Stage 1: Directory filtering
      const dirFilter = this.shouldScrapeFile(filePath);
      if (!dirFilter.pass) {
        skipped++;
        yield { path: filePath, chunks: [], skipped: true, skipReason: dirFilter.reason };
        continue;
      }

      console.log(`\n[${processed}/${allFiles.length}] Evaluating: ${filePath}`);

      // Fetch file content
      const content = await this.fetchFile(filePath);
      if (!content) {
        skipped++;
        yield { path: filePath, chunks: [], skipped: true, skipReason: 'Failed to fetch' };
        continue;
      }

      const language = this.detectLanguage(filePath);

      // Stages 2-5: Quality assessment
      const quality = await this.assessFileQuality(filePath, content, language);

      if (!quality.shouldIndex) {
        console.log(`  ✗ Skipped: ${quality.rejectionReason}`);
        skipped++;
        yield { path: filePath, chunks: [], skipped: true, skipReason: quality.rejectionReason };
        continue;
      }

      const docScore = quality.documentationScore.score;
      const llmScore = quality.llmResult?.score ?? 0;
      console.log(`  ✓ Accepted (doc: ${docScore}, llm: ${llmScore})`);

      // Parse and enrich chunks
      const chunks = this.parseSourceFile(filePath, content);
      this.enrichChunks(chunks, quality);

      indexed++;
      yield {
        path: filePath,
        chunks,
        skipped: false,
        qualityMetrics: {
          documentationScore: docScore,
          llmScore,
          exampleDescription: quality.llmResult?.exampleDescription || 'N/A',
        },
      };

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Completed: ${indexed} indexed, ${skipped} skipped`);
    console.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Convenience method to scrape and collect all chunks
   */
  async scrapeAll(): Promise<{ chunks: DocumentChunk[]; stats: ScrapeStats }> {
    const chunks: DocumentChunk[] = [];
    const stats: ScrapeStats = {
      totalFiles: 0,
      indexed: 0,
      skipped: 0,
      skipReasons: {},
    };

    for await (const result of this.scrape()) {
      stats.totalFiles++;

      if (result.skipped) {
        stats.skipped++;
        const reason = result.skipReason || 'Unknown';
        stats.skipReasons[reason] = (stats.skipReasons[reason] || 0) + 1;
      } else {
        stats.indexed++;
        chunks.push(...result.chunks);
      }
    }

    return { chunks, stats };
  }
}

/**
 * Scrape all GitHub sources for a project
 */
export async function scrapeProjectGitHubSources(
  projectId: string,
  sources: GitHubSourceEntry[],
  options: { openaiApiKey: string; githubToken?: string; dryRun?: boolean }
): Promise<{ sourceId: string; chunks: DocumentChunk[]; stats: ScrapeStats }[]> {
  const results = [];

  for (const source of sources) {
    console.log(`\n${'#'.repeat(70)}`);
    console.log(`# Source: ${source.id}`);
    console.log(`# ${source.description || 'No description'}`);
    console.log(`${'#'.repeat(70)}`);

    const scraper = new IntelligentGitHubScraper({
      source,
      project: projectId,
      openaiApiKey: options.openaiApiKey,
      githubToken: options.githubToken,
      dryRun: options.dryRun,
    });

    const { chunks, stats } = await scraper.scrapeAll();

    results.push({
      sourceId: source.id,
      chunks,
      stats,
    });

    // Log skip reason summary
    if (Object.keys(stats.skipReasons).length > 0) {
      console.log('\nSkip reasons summary:');
      for (const [reason, count] of Object.entries(stats.skipReasons)) {
        console.log(`  ${reason}: ${count}`);
      }
    }
  }

  return results;
}
