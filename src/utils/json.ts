import { logger } from '../config/logger';

export function safeParseJson<T = Record<string, unknown>>(text: string, fallback: T | null = null): T | null {
  try {
    const cleaned = text
      .replace(/```(?:json)?\n?/gi, '')
      .replace(/\n```/g, '')
      .replace(/^[\s\S]*?(\[[\s\S]*\]|\{[\s\S]*\})[\s\S]*$/, (_, json) => json)
      .trim();

    if (!cleaned.startsWith('[') && !cleaned.startsWith('{')) {
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      const match = arrayMatch || objMatch;
      if (match) return JSON.parse(match[0]) as T;
      throw new Error('No JSON structure found');
    }

    return JSON.parse(cleaned) as T;
  } catch (err) {
    logger.warn('JSON parse failed, returning fallback', { text: text.substring(0, 200), error: (err as Error).message });
    return fallback;
  }
}

export function jsonPrompt(instruction: string): string {
  return `${instruction}

IMPORTANT RULES:
- Return ONLY valid JSON.
- Do NOT include markdown code blocks, backticks, or formatting.
- Do NOT add explanations, greetings, or extra text.
- Output must be parseable by JSON.parse() directly.
- Use double quotes for strings, no trailing commas.`;
}
