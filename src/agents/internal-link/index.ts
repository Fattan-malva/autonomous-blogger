import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';
import { db } from '../../database/connection';
import { articles, internalLinks } from '../../database/schema';
import { and, ne, eq } from 'drizzle-orm';

const LINKING_SYSTEM_PROMPT = `You are an Internal Link Agent. Connect articles intelligently to improve SEO and user experience.

Guidelines:
- Only link contextually relevant articles
- Use natural, descriptive anchor text
- Link to cornerstone content when possible
- Avoid over-linking (max 3-5 internal links per article)
- Prioritize articles that support and enhance the current content`;

export class InternalLinkAgent extends BaseAgent {
  constructor() {
    super('Internal-Link');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, articleId, articleContent, articleTitle } = input;

    switch (action) {
      case 'find-links':
        return this.findInternalLinks(articleId as number, articleContent as string, articleTitle as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async findInternalLinks(
    articleId: number,
    articleContent: string,
    articleTitle: string
  ): Promise<AgentOutput> {
    const existingLinks = await db
      .select()
      .from(internalLinks)
      .where(eq(internalLinks.sourceArticleId, articleId));

    if (existingLinks.length > 0) {
      return { success: true, data: { links: existingLinks, cached: true } };
    }

    const allArticles = await db
      .select()
      .from(articles)
      .where(and(ne(articles.id, articleId), eq(articles.status, 'published')))
      .limit(50);

    if (allArticles.length === 0) {
      return { success: true, data: { links: [], message: 'No published articles to link to' } };
    }

    const candidateArticles = allArticles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
    }));

    const prompt = `Find contextual internal linking opportunities for this article.

Current article title: "${articleTitle}"
Current article content: ${articleContent.substring(0, 2000)}

Available articles to link to:
${JSON.stringify(candidateArticles, null, 2)}

For each relevant link, provide:
1. Source text context (the sentence where the link fits naturally)
2. Target article ID
3. Anchor text to use
4. Reason for the link

Return up to 5 links. Return as JSON array.`;

    const result = await generateWithSystemPrompt(LINKING_SYSTEM_PROMPT, prompt);
    const linkSuggestions = JSON.parse(result);

    const insertedLinks = [];
    for (const link of linkSuggestions) {
      const inserted = await db.insert(internalLinks).values({
        sourceArticleId: articleId,
        targetArticleId: link.targetArticleId,
        anchorText: link.anchorText,
        context: link.context || link.sourceText,
      }).returning();
      insertedLinks.push(inserted[0]);
    }

    return { success: true, data: { links: insertedLinks } };
  }
}
