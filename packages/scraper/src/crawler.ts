import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

export interface CrawlResult {
  url: string;
  html: string;
  title: string;
  links: string[];
}

export interface CrawlerOptions {
  baseUrl: string;
  concurrency: number;
  delayMs: number;
  maxPages?: number;
}

export class Crawler {
  private visited = new Set<string>();
  private queue: string[] = [];
  private limit: ReturnType<typeof pLimit>;

  constructor(private options: CrawlerOptions) {
    this.limit = pLimit(options.concurrency);
  }

  async *crawl(): AsyncGenerator<CrawlResult> {
    this.queue.push(this.options.baseUrl);

    while (this.queue.length > 0) {
      const url = this.queue.shift()!;
      const normalizedUrl = this.normalizeUrl(url);

      if (this.visited.has(normalizedUrl)) continue;
      if (this.options.maxPages && this.visited.size >= this.options.maxPages) break;

      this.visited.add(normalizedUrl);

      try {
        const result = await this.fetchPage(normalizedUrl);

        // Add new links to queue
        for (const link of result.links) {
          const normalizedLink = this.normalizeUrl(link);
          if (!this.visited.has(normalizedLink) && this.isValidUrl(normalizedLink)) {
            this.queue.push(normalizedLink);
          }
        }

        yield result;

        // Rate limiting
        await this.delay(this.options.delayMs);
      } catch (error) {
        console.error(`Failed to crawl ${normalizedUrl}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  private async fetchPage(url: string): Promise<CrawlResult> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MinaDocsMCP/1.0 (Documentation Indexer)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || $('h1').first().text().trim() || url;

    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, url).toString();
          links.push(absoluteUrl);
        } catch {
          // Invalid URL, skip
        }
      }
    });

    return { url, html, title, links };
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slashes, fragments, and common tracking params
      parsed.hash = '';
      parsed.search = '';
      let pathname = parsed.pathname;
      if (pathname.endsWith('/') && pathname !== '/') {
        pathname = pathname.slice(0, -1);
      }
      parsed.pathname = pathname;
      return parsed.toString();
    } catch {
      return url;
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const base = new URL(this.options.baseUrl);

      // Only crawl same domain
      if (parsed.hostname !== base.hostname) return false;

      // Skip non-documentation pages
      const pathname = parsed.pathname.toLowerCase();

      // Skip certain file types
      if (/\.(pdf|zip|tar|gz|png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/i.test(pathname)) {
        return false;
      }

      // Skip API endpoints that aren't documentation
      if (pathname.startsWith('/api/') && !pathname.includes('/zkapps/')) {
        return false;
      }

      // Skip external link pages
      if (pathname.includes('/external') || pathname.includes('/redirect')) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  get stats() {
    return {
      visited: this.visited.size,
      queued: this.queue.length
    };
  }
}
