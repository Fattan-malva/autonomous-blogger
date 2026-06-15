import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { jsonPrompt, safeParseJson } from '../../utils/json';

export class SEOAgent extends BaseAgent {
  constructor() {
    super('SEO');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, content, title, keyword } = input;

    switch (action) {
      case 'generate-seo':
        return this.generateSEO(content as string, title as string, keyword as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async generateSEO(content: string, title: string, keyword: string): Promise<AgentOutput> {
    const prompt = jsonPrompt(`Generate SEO metadata for this article.

Title: "${title}"
Keyword: "${keyword}"
Content preview: ${content.substring(0, 1500)}

Provide:
- metaTitle: string (max 60 chars)
- metaDescription: string (max 160 chars)
- urlSlug: string
- openGraph: { title: string, description: string }
- twitterCard: { title: string, description: string }
- schemaMarkup: { "@context": string, "@type": string, ... }

Return a JSON object`);

    const result = await generateContent(prompt);
    const seoData = safeParseJson(result, {});

    return { success: true, data: { seo: seoData } };
  }
}
