import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of content
 * Used for detecting page content changes
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
