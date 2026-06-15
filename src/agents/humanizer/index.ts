import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';

const HUMANIZER_SYSTEM_PROMPT = `You are a Humanizer Agent. Make AI-generated content sound completely natural and human-written.

Tasks:
- Vary sentence structure and length
- Improve flow and transitions
- Add natural examples and analogies
- Remove repetitive patterns
- Add personality where appropriate
- Ensure conversational tone
- Remove AI-sounding phrases
- Make it read like a human expert wrote it

IMPORTANT CONSTRAINTS:
- PRESERVE all original content length - do NOT cut or reduce content
- Keep ALL sections, paragraphs, and details
- If original is X words, output must be at least X words
- NEVER shorten the content - only rephrase and improve
- Maintain the same word count as original or more`;

export class HumanizerAgent extends BaseAgent {
  constructor() {
    super('Humanizer');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, content } = input;

    switch (action) {
      case 'humanize':
        return this.humanizeContent(content as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async humanizeContent(content: string): Promise<AgentOutput> {
    const wordCount = content.split(/\s+/).length;
    const prompt = `${HUMANIZER_SYSTEM_PROMPT}

Humanize the following article (${wordCount} words). CRITICAL: Preserve the full length - do NOT reduce, cut, or summarize. Keep every section, detail, and example.

Article to humanize:

${content}

Humanized version:`;

    const result = await generateContent(prompt);

    return {
      success: true,
      data: {
        humanizedContent: result,
        originalWordCount: content.split(/\s+/).length,
        humanizedWordCount: result.split(/\s+/).length,
      },
    };
  }
}
