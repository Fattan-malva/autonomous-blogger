import { env } from '../../config/env';
import { logger } from '../../config/logger';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

interface Part {
  text?: string;
  thought?: boolean;
}

interface Candidate {
  content?: { parts?: Part[] };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractText(parts: Part[] | undefined): string {
  if (!parts || parts.length === 0) return '';
  const lastNonThought = parts.filter(p => !p.thought).pop();
  return lastNonThought?.text || parts[0]?.text || '';
}

async function fetchWithRetry(url: string, body: unknown): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json() as { candidates?: Candidate[] };
        return extractText(data.candidates?.[0]?.content?.parts);
      }

      if (response.status === 429 || response.status === 500) {
        lastError = new Error(`Google AI API error: ${response.status} ${response.statusText}`);
        if (attempt < MAX_RETRIES) {
          logger.warn(`Attempt ${attempt}/${MAX_RETRIES} failed (${response.status}), retrying in ${RETRY_DELAY_MS / 1000}s...`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }
      }

      throw new Error(`Google AI API error: ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_RETRIES) {
        logger.warn(`Attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

export function initGoogleAI(): void {
  if (!env.GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY is not configured');
  }
  logger.info('Google AI initialized', { model: env.GOOGLE_AI_MODEL });
}

export async function generateContent(prompt: string): Promise<string> {
  const url = `${BASE_URL}/models/${env.GOOGLE_AI_MODEL}:generateContent?key=${env.GOOGLE_AI_API_KEY}`;

  try {
    const text = await fetchWithRetry(url, {
      contents: [{ parts: [{ text: prompt }] }],
    });
    return text;
  } catch (error) {
    logger.error('Google AI generation failed', { error });
    throw error;
  }
}

export async function generateContentStream(
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const url = `${BASE_URL}/models/${env.GOOGLE_AI_MODEL}:streamGenerateContent?key=${env.GOOGLE_AI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Google AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as Array<{ candidates?: Candidate[] }>;
    let fullText = '';

    for (const chunk of data) {
      const text = extractText(chunk.candidates?.[0]?.content?.parts);
      fullText += text;
      onChunk(text);
    }

    return fullText;
  } catch (error) {
    logger.error('Google AI stream generation failed', { error });
    throw error;
  }
}

export async function generateWithSystemPrompt(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const url = `${BASE_URL}/models/${env.GOOGLE_AI_MODEL}:generateContent?key=${env.GOOGLE_AI_API_KEY}`;

  try {
    const text = await fetchWithRetry(url, {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
    });
    return text;
  } catch (error) {
    logger.error('Google AI system prompt generation failed', { error });
    throw error;
  }
}
