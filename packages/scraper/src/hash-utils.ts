import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of content
 * Used for detecting page content changes
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generate a stable document ID from a URL
 * Used to group chunks from the same source document for adjacent chunk retrieval
 */
export function generateDocumentId(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}
