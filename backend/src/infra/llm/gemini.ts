import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';

if (!config.google?.apiKey) {
  throw new Error('GOOGLE_AI_API_KEY is required');
}

export const genAI = new GoogleGenerativeAI(config.google.apiKey);

// Embedding model - FREE!
export const embeddingModel = genAI.getGenerativeModel({
  model: 'text-embedding-004',
});

// Chat model - Gemini 2.0 Flash
export const chatModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
  },
});

/**
 * Generate embedding for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

/**
 * Generate embedding for product
 */
export async function generateProductEmbedding(product: {
  title: string;
  description?: string | null;
  tags?: string[];
  vendor?: string | null;
  product_type?: string | null;
}): Promise<number[]> {
  const text = [
    product.title,
    product.description,
    product.vendor,
    product.product_type,
    ...(product.tags || []),
  ]
    .filter(Boolean)
    .join(' ');

  return generateEmbedding(text);
}
