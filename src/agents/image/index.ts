import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';

const IMAGE_SYSTEM_PROMPT = `You are an Image Agent for an SEO blog. Plan and describe images for articles.

Tasks:
- Describe featured image concept
- Describe Open Graph image concept
- Generate detailed alt text
- Generate image captions
- Suggest SEO filenames
- Describe image content in detail for AI image generation`;

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
    const prompt = `Plan images for an article.

Title: "${title}"
${sections ? `Key sections: ${sections}` : ''}
Content preview: ${content.substring(0, 1500)}

For each image needed, provide:
1. Image purpose (featured/in-article/infographic)
2. Detailed visual description
3. Alt text (descriptive, SEO-friendly)
4. Image caption
5. SEO filename (e.g., "what-is-docker-container.webp")
6. Placement within article (which section)

Return as JSON array with: purpose, description, altText, caption, filename, placement`;

    const result = await generateWithSystemPrompt(IMAGE_SYSTEM_PROMPT, prompt);
    const images = JSON.parse(result);

    return { success: true, data: { images } };
  }
}
