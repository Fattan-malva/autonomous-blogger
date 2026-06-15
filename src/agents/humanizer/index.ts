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
- Make it read like a human expert wrote it`;

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
    const prompt = `${HUMANIZER_SYSTEM_PROMPT}

Humanize the following content. Make it read naturally, as if written by a human expert:

${content}

Return only the humanized version. Keep all Markdown formatting, headings, and structure intact.`;

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
