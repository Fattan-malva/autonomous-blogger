import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { jsonPrompt, safeParseJson } from '../../utils/json';

export class ImageAgent extends BaseAgent {
  constructor() {
    super('Image');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, content, title, sections } = input;

    switch (action) {
      case 'plan-images':
        return this.planImages(content as string, title as string, sections as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async planImages(content: string, title: string, sections?: string): Promise<AgentOutput> {
    const prompt = jsonPrompt(`Plan images for this article.

Title: "${title}"
${sections ? `Sections: ${sections}` : ''}
Content: ${content.substring(0, 2000)}

For each image provide:
- purpose: string (featured/in-article/infographic)
- description: string
- altText: string
- caption: string
- filename: string (seo-friendly, e.g. "what-is-docker-container.webp")
- placement: string

Return a JSON array`);

    const result = await generateContent(prompt);
    const images = safeParseJson<Array<Record<string, unknown>>>(result, []);

    return { success: true, data: { images } };
  }
}
