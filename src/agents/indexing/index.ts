import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { submitUrlForIndexing } from '../../services/search-console';
import { db } from '../../database/connection';
import { articles, indexingLogs } from '../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '../../config/logger';

export class IndexingAgent extends BaseAgent {
  constructor() {
    super('Indexing');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, articleId, url } = input;

    switch (action) {
      case 'submit-url':
        return this.submitUrl(articleId as number, url as string);
      case 'batch-submit':
        return this.batchSubmit();
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async submitUrl(articleId: number, url: string): Promise<AgentOutput> {
    const success = await submitUrlForIndexing(url);

    await db.insert(indexingLogs).values({
      articleId,
      url,
      status: success ? 'submitted' : 'failed',
      response: { success },
    });

    if (success) {
      logger.info('URL submitted to Google Indexing API', { articleId, url });
    } else {
      logger.warn('URL submission failed', { articleId, url });
    }

    return {
      success,
      data: { articleId, url, submitted: success },
    };
  }

  private async batchSubmit(): Promise<AgentOutput> {
    const published = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.status, 'published'),
          isNull(articles.bloggerUrl)
        )
      )
      .limit(20);

    const results = [];
    for (const article of published) {
      if (article.bloggerUrl) {
        const result = await this.submitUrl(article.id, article.bloggerUrl);
        results.push(result);
      }
    }

    return {
      success: true,
      data: {
        submitted: results.length,
        results,
      },
    };
  }
}
