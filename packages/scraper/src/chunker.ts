import type { DocumentChunk } from '@mina-docs/shared';
import { randomUUID } from 'crypto';

const MAX_CHUNK_TOKENS = 1500;
const MIN_CHUNK_TOKENS = 100;
const OVERLAP_TOKENS = 150;

// Rough token estimation: ~1.3 tokens per word for English
function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return Math.ceil(words.length * 1.3);
}

export function chunkContent(chunks: DocumentChunk[]): DocumentChunk[] {
  const result: DocumentChunk[] = [];

  for (const chunk of chunks) {
    // Code chunks stay as-is (usually well-sized)
    if (chunk.contentType === 'code') {
      const tokens = estimateTokens(chunk.content);
      if (tokens >= MIN_CHUNK_TOKENS || chunk.content.length > 100) {
        result.push(chunk);
      }
      continue;
    }

    // Check if prose chunk needs splitting
    const tokens = estimateTokens(chunk.content);

    if (tokens <= MAX_CHUNK_TOKENS) {
      if (tokens >= MIN_CHUNK_TOKENS) {
        result.push(chunk);
      }
      continue;
    }

    // Split large prose chunks with overlap
    const subChunks = splitWithOverlap(
      chunk.content,
      MAX_CHUNK_TOKENS,
      OVERLAP_TOKENS
    );

    for (let i = 0; i < subChunks.length; i++) {
      const subContent = subChunks[i];
      if (estimateTokens(subContent) >= MIN_CHUNK_TOKENS) {
        result.push({
          ...chunk,
          id: randomUUID(),
          section: subChunks.length > 1
            ? `${chunk.section} (Part ${i + 1}/${subChunks.length})`
            : chunk.section,
          content: subContent
        });
      }
    }
  }

  return result;
}

function splitWithOverlap(
  text: string,
  maxTokens: number,
  overlapTokens: number
): string[] {
  // Split by sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];

  let currentChunk: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    // If single sentence is too large, split by words
    if (sentenceTokens > maxTokens) {
      // Save current chunk first
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
      }

      // Split the large sentence
      const words = sentence.split(/\s+/);
      let wordChunk: string[] = [];
      let wordTokens = 0;

      for (const word of words) {
        const wordTokenCount = estimateTokens(word);
        if (wordTokens + wordTokenCount > maxTokens && wordChunk.length > 0) {
          chunks.push(wordChunk.join(' '));
          // Keep overlap
          const overlapWords = getOverlapWords(wordChunk, overlapTokens);
          wordChunk = overlapWords;
          wordTokens = estimateTokens(overlapWords.join(' '));
        }
        wordChunk.push(word);
        wordTokens += wordTokenCount;
      }

      if (wordChunk.length > 0) {
        currentChunk = wordChunk;
        currentTokens = wordTokens;
      }
      continue;
    }

    // Check if adding this sentence would exceed limit
    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));

      // Keep overlap sentences
      const overlapSentences = getOverlapSentences(currentChunk, overlapTokens);
      currentChunk = overlapSentences;
      currentTokens = estimateTokens(currentChunk.join(' '));
    }

    currentChunk.push(sentence);
    currentTokens += sentenceTokens;
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

function getOverlapSentences(sentences: string[], targetTokens: number): string[] {
  const overlap: string[] = [];
  let tokens = 0;

  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentenceTokens = estimateTokens(sentences[i]);
    if (tokens + sentenceTokens > targetTokens) break;
    overlap.unshift(sentences[i]);
    tokens += sentenceTokens;
  }

  return overlap;
}

function getOverlapWords(words: string[], targetTokens: number): string[] {
  const overlap: string[] = [];
  let tokens = 0;

  for (let i = words.length - 1; i >= 0; i--) {
    const wordTokens = estimateTokens(words[i]);
    if (tokens + wordTokens > targetTokens) break;
    overlap.unshift(words[i]);
    tokens += wordTokens;
  }

  return overlap;
}
