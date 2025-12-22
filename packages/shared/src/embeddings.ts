import OpenAI from 'openai';

const BATCH_SIZE = 100;
const MODEL = 'text-embedding-3-small';

export async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const client = new OpenAI({ apiKey });
  const embeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await client.embeddings.create({
      model: MODEL,
      input: batch
    });

    for (const item of response.data) {
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}

export async function generateSingleEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const client = new OpenAI({ apiKey });

  const response = await client.embeddings.create({
    model: MODEL,
    input: text
  });

  return response.data[0].embedding;
}
