import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import puppeteer, { Browser, Page } from 'puppeteer';

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
  excludePatterns?: string[];
  userAgent?: string;
  useBrowser?: boolean; // Use Puppeteer for Cloudflare-protected sites
}

export class Crawler {
  private visited = new Set<string>();
  private queue: string[] = [];
  private limit: ReturnType<typeof pLimit>;
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(private options: CrawlerOptions) {
    this.limit = pLimit(options.concurrency);
  }

  async *crawl(): AsyncGenerator<CrawlResult> {
    // Initialize browser if needed
    if (this.options.useBrowser) {
      await this.initBrowser();
    }

    this.queue.push(this.options.baseUrl);

    try {
      while (this.queue.length > 0) {
        const url = this.queue.shift()!;
        const normalizedUrl = this.normalizeUrl(url);

        if (this.visited.has(normalizedUrl)) continue;
        if (this.options.maxPages && this.visited.size >= this.options.maxPages) break;

        this.visited.add(normalizedUrl);

        try {
          const result = this.options.useBrowser
            ? await this.fetchPageWithBrowser(normalizedUrl)
            : await this.fetchPage(normalizedUrl);

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
    } finally {
      await this.closeBrowser();
    }
  }

  private async initBrowser(): Promise<void> {
    console.log('Launching browser for Cloudflare-protected site...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    this.page = await this.browser.newPage();

    // Set realistic viewport and user agent
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      this.options.userAgent ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set extra headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  private async fetchPageWithBrowser(url: string): Promise<CrawlResult> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    console.log(`  [Browser] Fetching: ${url}`);

    // Navigate and wait for content to load
    const response = await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    if (!response) {
      throw new Error('No response received');
    }

    const status = response.status();

    // Check for Cloudflare challenge
    if (status === 403 || status === 503) {
      console.log('  [Browser] Cloudflare challenge detected, waiting for resolution...');
      // Wait for challenge to resolve
      await this.page.waitForFunction(
        () => !document.body.innerText.includes('Just a moment') &&
              !document.body.innerText.includes('Checking your browser'),
        { timeout: 15000 }
      ).catch(() => {
        // If we timeout, continue anyway - might work
      });

      // Give extra time for page to fully load after challenge
      await this.delay(2000);
    }

    const html = await this.page.content();
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

  private async fetchPage(url: string): Promise<CrawlResult> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.options.userAgent || 'CryptoDocsMCP/1.0 (Documentation Indexer)',
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

      // Check configurable exclusion patterns
      for (const pattern of this.options.excludePatterns || []) {
        if (pathname.includes(pattern)) {
          return false;
        }
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
