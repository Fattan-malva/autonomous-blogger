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
Content preview: ${content.substring(0, 500)}

Provide:
- metaTitle: string (max 60 chars, engaging SEO title)
- metaDescription: string (max 160 chars, compelling meta description with keyword)
- canonicalUrl: string (full URL using format: https://fattan-dev.blogspot.com/YYYY/MM/url-slug.html)
- openGraph: { title: string, description: string, image: string }
- twitterCard: { title: string, description: string }
- schemaMarkup: { "@context": "https://schema.org", "@type": "BlogPosting", ... }

Return a JSON object`);

    const result = await generateContent(prompt);
    const seoData = safeParseJson(result, {});

    return { success: true, data: { seo: seoData } };
  }
}
