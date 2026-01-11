import { z } from 'zod';

export const GitHubSourceConfigSchema = z.object({
  repo: z.string(), // e.g., "o1-labs/o1js"
  branch: z.string().default('main'),
  // Glob patterns for files to scrape
  include: z.array(z.string()), // e.g., ["src/lib/**/*.ts"]
  // Glob patterns to exclude
  exclude: z.array(z.string()).default([]),
});

export const ProjectConfigSchema = z.object({
  // Unique identifier (used in queries)
  id: z.string().regex(/^[a-z][a-z0-9-]*$/), // e.g., "mina", "solana", "cosmos"

  // Display name
  name: z.string(), // e.g., "Mina Protocol"

  // Documentation site configuration
  docs: z.object({
    baseUrl: z.string().url(),
    // URL patterns to include (optional, defaults to all under baseUrl)
    includePatterns: z.array(z.string()).default([]),
    // URL patterns to exclude
    excludePatterns: z.array(z.string()).default([]),
    // Max pages to crawl
    maxPages: z.number().default(200),
    // Use Puppeteer browser for Cloudflare-protected sites
    useBrowser: z.boolean().default(false),
    // Custom selectors for content extraction (optional)
    selectors: z.object({
      content: z.string().optional(), // CSS selector for main content
      title: z.string().optional(),
      exclude: z.array(z.string()).optional(), // Elements to remove
    }).optional(),
  }),

  // GitHub source code scraping (optional)
  github: GitHubSourceConfigSchema.optional(),

  // Crawler settings
  crawler: z.object({
    concurrency: z.number().default(3),
    delayMs: z.number().default(1000),
    userAgent: z.string().optional(),
  }).default({}),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type GitHubSourceConfig = z.infer<typeof GitHubSourceConfigSchema>;
