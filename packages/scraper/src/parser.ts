import * as cheerio from 'cheerio';
import type { DocumentChunk } from '@mina-docs/shared';
import { randomUUID } from 'crypto';

export function parseDocumentation(url: string, html: string, project: string): DocumentChunk[] {
  const $ = cheerio.load(html);
  const chunks: DocumentChunk[] = [];

  // Remove navigation, footer, and other non-content elements
  $('nav, footer, .sidebar, .navigation, .nav, .menu, .toc, script, style, noscript, iframe').remove();
  $('[role="navigation"]').remove();
  $('[aria-hidden="true"]').remove();

  // Get the main content area
  const mainContent = $('main, article, .content, .main-content, .documentation, .markdown-body, .prose, #main-content, [role="main"]').first();
  const content = mainContent.length ? mainContent : $('body');

  const pageTitle = $('h1').first().text().trim() || $('title').text().trim().split('|')[0].trim();
  const headings: string[] = [];

  let currentHeading = pageTitle;
  let currentContent = '';

  // Process content by sections
  content.find('*').each((_, element) => {
    const $el = $(element);
    const tagName = element.tagName?.toLowerCase();

    // Skip nested elements we'll process individually
    if ($el.parents('pre').length > 0) return;

    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
      // Save previous section if has content
      if (currentContent.trim().length > 50) {
        chunks.push(createProseChunk(url, pageTitle, currentHeading, currentContent, headings, project));
      }

      currentHeading = $el.text().trim();
      if (tagName !== 'h1') {
        headings.push(currentHeading);
      }
      currentContent = '';
    } else if (tagName === 'pre') {
      // Code block - create separate chunk
      const code = $el.text().trim();
      const language = detectLanguage($el, $);

      if (code.length > 30) {
        // Save any pending prose content first
        if (currentContent.trim().length > 50) {
          chunks.push(createProseChunk(url, pageTitle, currentHeading, currentContent, headings, project));
          currentContent = '';
        }

        chunks.push({
          id: randomUUID(),
          url,
          title: pageTitle,
          section: currentHeading,
          content: code,
          contentType: 'code',
          project,
          metadata: {
            headings: [...headings],
            codeLanguage: language,
            lastScraped: new Date().toISOString()
          }
        });
      }
    } else if (tagName === 'p' || tagName === 'li' || tagName === 'td' || tagName === 'blockquote') {
      // Regular content - only direct text content
      const text = $el.clone().children('pre, code').remove().end().text().trim();
      if (text && text.length > 10) {
        currentContent += text + '\n\n';
      }
    } else if (tagName === 'code' && $el.parents('pre').length === 0) {
      // Inline code - include in prose
      const text = $el.text().trim();
      if (text) {
        currentContent += '`' + text + '` ';
      }
    }
  });

  // Don't forget the last section
  if (currentContent.trim().length > 50) {
    chunks.push(createProseChunk(url, pageTitle, currentHeading, currentContent, headings, project));
  }

  return chunks;
}

function createProseChunk(
  url: string,
  title: string,
  section: string,
  content: string,
  headings: string[],
  project: string
): DocumentChunk {
  const isApiRef = url.includes('/reference') || url.includes('/api');

  return {
    id: randomUUID(),
    url,
    title,
    section,
    content: cleanContent(content),
    contentType: isApiRef ? 'api-reference' : 'prose',
    project,
    metadata: {
      headings: [...headings],
      lastScraped: new Date().toISOString()
    }
  };
}

function cleanContent(content: string): string {
  return content
    .replace(/\n{3,}/g, '\n\n')  // Collapse multiple newlines
    .replace(/[ \t]+/g, ' ')      // Collapse spaces
    .replace(/^\s+|\s+$/gm, '')   // Trim lines
    .trim();
}

function detectLanguage(codeEl: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string {
  // Check class names for language hints
  const classes = (codeEl.attr('class') || '') + ' ' + (codeEl.find('code').attr('class') || '');

  const languagePatterns = [
    /language-(\w+)/,
    /lang-(\w+)/,
    /highlight-(\w+)/,
    /(\w+)-code/
  ];

  for (const pattern of languagePatterns) {
    const match = classes.match(pattern);
    if (match) {
      return normalizeLanguage(match[1]);
    }
  }

  // Check data attributes
  const dataLang = codeEl.attr('data-language') || codeEl.find('code').attr('data-language');
  if (dataLang) {
    return normalizeLanguage(dataLang);
  }

  // Heuristic detection based on content
  const code = codeEl.text();

  if (code.includes('import') && (code.includes('from') || code.includes('{'))) {
    if (code.includes(': ') || code.includes('interface ') || code.includes('<')) {
      return 'typescript';
    }
    return 'javascript';
  }

  if (code.includes('npm ') || code.includes('yarn ') || code.includes('npx ') || code.startsWith('$')) {
    return 'bash';
  }

  if (code.includes('zkApp') || code.includes('o1js') || code.includes('SmartContract') || code.includes('Field')) {
    return 'typescript';
  }

  if (code.includes('{') && code.includes(':') && !code.includes('function')) {
    return 'json';
  }

  return 'text';
}

function normalizeLanguage(lang: string): string {
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'jsx': 'javascript',
    'sh': 'bash',
    'shell': 'bash',
    'zsh': 'bash',
    'console': 'bash'
  };

  const normalized = lang.toLowerCase();
  return langMap[normalized] || normalized;
}
