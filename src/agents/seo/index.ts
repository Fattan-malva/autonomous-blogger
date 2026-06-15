import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';

const SEO_SYSTEM_PROMPT = `You are an SEO Agent. Generate comprehensive SEO metadata and schema markup for articles.

Generate:
- Meta title (max 60 chars)
- Meta description (max 160 chars)
- URL slug
- Canonical URL
- Open Graph tags
- Twitter Card tags
- Schema.org markup (BlogPosting, FAQPage, BreadcrumbList, Organization)`;

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
    const prompt = `Generate comprehensive SEO metadata for an article.

Article title: "${title}"
Target keyword: "${keyword}"
Content preview: ${content.substring(0, 1000)}

Provide:
1. Meta title (under 60 chars, include keyword naturally)
2. Meta description (under 160 chars, compelling, include keyword)
3. URL slug (SEO-friendly)
4. Open Graph title and description
5. Twitter Card title and description
6. Complete schema.org markup (BlogPosting with FAQPage if FAQs exist)
7. BreadcrumbList schema
8. Organization schema

Return as structured JSON.`;

    const result = await generateWithSystemPrompt(SEO_SYSTEM_PROMPT, prompt);
    const seoData = JSON.parse(result);

    return { success: true, data: { seo: seoData } };
  }
}
