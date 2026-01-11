import { z } from 'zod';

/**
 * Source Registry Schema
 *
 * Defines the structure for documentation sources that can be scraped.
 * Sources are stored in config/sources/ and referenced by projects.
 */

export const TrustLevelSchema = z.enum(['official', 'verified-community', 'community']);
export type TrustLevel = z.infer<typeof TrustLevelSchema>;

export const RepoTypeSchema = z.enum(['sdk', 'example-repo', 'tutorial-repo', 'ecosystem-lib']);
export type RepoType = z.infer<typeof RepoTypeSchema>;

/**
 * Scrape strategy configuration
 * Determines what files to scrape and how to filter them
 */
export const ScrapeStrategySchema = z.object({
  // For example-repos: directories to scrape broadly
  exampleDirs: z.array(z.string()).default(['examples', 'demos', 'tutorials', 'samples']),
  // For sdk-repos: specific paths to API files
  apiPaths: z.array(z.string()).optional(),
  // Patterns to always exclude
  exclude: z.array(z.string()).default(['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']),
  // File extensions to consider
  extensions: z.array(z.string()).default(['.ts', '.tsx', '.js', '.jsx', '.rs', '.go']),
});

export type ScrapeStrategy = z.infer<typeof ScrapeStrategySchema>;

/**
 * Quality thresholds for filtering content
 */
export const QualityThresholdsSchema = z.object({
  // Minimum documentation score (0-100) to index
  minDocumentationScore: z.number().min(0).max(100).default(30),
  // Minimum LLM relevance score (0-100) to index
  minLLMRelevanceScore: z.number().min(0).max(100).default(50),
  // Require README in directory
  requireReadme: z.boolean().default(true),
});

export type QualityThresholds = z.infer<typeof QualityThresholdsSchema>;

/**
 * GitHub source entry configuration
 */
export const GitHubSourceEntrySchema = z.object({
  // Unique source ID (lowercase, alphanumeric with dashes)
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  type: z.literal('github'),
  // Type of repository determines scrape strategy
  repoType: RepoTypeSchema,
  // Trust level affects search ranking
  trustLevel: TrustLevelSchema,

  // GitHub repository (org/repo format)
  repo: z.string(),
  branch: z.string().default('main'),

  // Scrape strategy configuration
  scrapeStrategy: ScrapeStrategySchema.default({}),

  // Quality filtering thresholds
  qualityThresholds: QualityThresholdsSchema.default({}),

  // Metadata
  description: z.string().optional(),
  maintainer: z.string().optional(),
  addedAt: z.string().optional(),
  lastScraped: z.string().optional(),

  // Project-specific packages for version detection
  versionPackages: z.array(z.string()).optional(), // e.g., ['o1js', '@o1labs/snarkyjs']
});

export type GitHubSourceEntry = z.infer<typeof GitHubSourceEntrySchema>;

/**
 * Blog/tutorial source entry (for future expansion)
 */
export const BlogSourceEntrySchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  type: z.literal('blog'),
  trustLevel: TrustLevelSchema,
  url: z.string().url(),
  // Selectors for content extraction
  selectors: z.object({
    content: z.string().optional(),
    title: z.string().optional(),
    codeBlocks: z.string().optional(),
  }).optional(),
  description: z.string().optional(),
  addedAt: z.string().optional(),
  lastScraped: z.string().optional(),
});

export type BlogSourceEntry = z.infer<typeof BlogSourceEntrySchema>;

/**
 * Union of all source entry types
 */
export const SourceEntrySchema = z.discriminatedUnion('type', [
  GitHubSourceEntrySchema,
  BlogSourceEntrySchema,
]);

export type SourceEntry = z.infer<typeof SourceEntrySchema>;

/**
 * Project-to-sources mapping
 * Defines which sources belong to which project
 */
export const ProjectSourcesSchema = z.object({
  projectId: z.string(),
  sources: z.array(z.string()), // Source IDs
});

export type ProjectSources = z.infer<typeof ProjectSourcesSchema>;

/**
 * Full project sources configuration file schema
 */
export const ProjectSourcesConfigSchema = z.array(ProjectSourcesSchema);

export type ProjectSourcesConfig = z.infer<typeof ProjectSourcesConfigSchema>;
