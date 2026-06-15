import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { db } from '../../database/connection';
import { articles, internalLinks } from '../../database/schema';
import { and, eq, ne, like, or } from 'drizzle-orm';

export class ContentMemoryAgent extends BaseAgent {
  constructor() {
    super('Content-Memory');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, keyword, content, cluster } = input;

    switch (action) {
      case 'check-overlap':
        return this.checkOverlap(keyword as string, content as string);
      case 'search-memory':
        return this.searchMemory(keyword as string, cluster as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async checkOverlap(keyword: string, content?: string): Promise<AgentOutput> {
    const similarArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        status: articles.status,
      })
      .from(articles)
      .where(
        or(
          like(articles.title, `%${keyword}%`),
          like(articles.content, `%${keyword}%`)
        )
      )
      .limit(10);

    const hasOverlap = similarArticles.length > 0;

    return {
      success: true,
      data: {
        hasOverlap,
        similarArticles,
        message: hasOverlap
          ? `Found ${similarArticles.length} similar articles`
          : 'No overlapping content found',
      },
    };
  }

  private async searchMemory(keyword: string, cluster?: string): Promise<AgentOutput> {
    const conditions = [like(articles.title, `%${keyword}%`)];

    if (cluster) {
      conditions.push(eq(articles.status, 'published'));
    }

    const results = await db
      .select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        status: articles.status,
      })
      .from(articles)
      .where(and(...conditions))
      .limit(20);

    return {
      success: true,
      data: {
        results,
        totalCount: results.length,
      },
    };
  }
}
