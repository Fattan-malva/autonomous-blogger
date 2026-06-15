import { env } from '../../config/env';
import { logger } from '../../config/logger';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface Part {
  text?: string;
  thought?: boolean;
}

interface Candidate {
  content?: { parts?: Part[] };
}

function extractText(parts: Part[] | undefined): string {
  if (!parts || parts.length === 0) return '';
  const lastNonThought = parts.filter(p => !p.thought).pop();
  return lastNonThought?.text || parts[0]?.text || '';
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

    const data = await response.json() as { candidates?: Candidate[] };
    return extractText(data.candidates?.[0]?.content?.parts);
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { candidates?: Candidate[] };
    return extractText(data.candidates?.[0]?.content?.parts);
  } catch (error) {
    logger.error('Google AI system prompt generation failed', { error });
    throw error;
  }
}
