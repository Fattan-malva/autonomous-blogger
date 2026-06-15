import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { db } from '../../database/connection';
import { articles, internalLinks } from '../../database/schema';
import { and, ne, eq } from 'drizzle-orm';
import { jsonPrompt, safeParseJson } from '../../utils/json';

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

    const prompt = jsonPrompt(`Find contextual internal linking opportunities.

Current article: "${articleTitle}"
${articleContent.substring(0, 1500)}

Available articles:
${JSON.stringify(candidateArticles, null, 2)}

For each relevant link provide:
- sourceText: string (sentence where link fits)
- targetArticleId: number
- anchorText: string

Return a JSON array (max 5 links)`);

    const result = await generateContent(prompt);
    const linkSuggestions = safeParseJson<Array<Record<string, unknown>>>(result, [])!;

    const insertedLinks = [];
    for (const link of linkSuggestions) {
      const inserted = await db.insert(internalLinks).values({
        sourceArticleId: articleId,
        targetArticleId: link.targetArticleId as number,
        anchorText: link.anchorText as string,
        context: (link.context || link.sourceText) as string,
      }).returning();
      insertedLinks.push(inserted[0]);
    }

    return { success: true, data: { links: insertedLinks } };
  }
}
