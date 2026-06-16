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
    const prompt = jsonPrompt(`Generate comprehensive SEO metadata for this article.

Title: "${title}"
Keyword: "${keyword}"
Content preview: ${content.substring(0, 500)}

Provide:
- metaTitle: string (max 60 chars, engaging SEO title without blog name prefix)
- metaDescription: string (max 160 chars, compelling meta description with keyword)
- canonicalUrl: string (SEO-friendly slug URL like "/2026/06/your-article-slug.html")
- schemaMarkup: object (Article schema.org JSON-LD with headline, description, author "Fattan Dev", publisher name, datePublished, dateModified, image url)
- openGraph: object (og:title, og:description — max 200 chars, og:image — use a generic tech image URL)
- twitterCard: object (twitter:title, twitter:description — each max 200 chars)

Return a JSON object`);

    const result = await generateContent(prompt);
    const seoData = safeParseJson(result, {});

    return { success: true, data: { seo: seoData } };
  }
}
