import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { querySearchAnalytics, getSiteUrl } from '../../services/search-console';
import { db } from '../../database/connection';
import { articles } from '../../database/schema';
import { eq, gte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { logger } from '../../config/logger';

export class AnalyticsAgent extends BaseAgent {
  constructor() {
    super('Analytics');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, articleId } = input;

    switch (action) {
      case 'sync-all':
        return this.syncAllAnalytics();
      case 'sync-article':
        return this.syncArticleAnalytics(articleId as number);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async syncAllAnalytics(): Promise<AgentOutput> {
    try {
      const siteUrl = await getSiteUrl();
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

      const response = await querySearchAnalytics(siteUrl, {
        startDate,
        endDate,
        dimensions: ['page', 'date'],
        rowLimit: 2500,
      });

      if (!response.rows) {
        return { success: true, data: { message: 'No analytics data available' } };
      }

      let syncedCount = 0;
      for (const row of response.rows) {
        const url = row.keys[0];
        const dateStr = row.keys[1];
        const articleResult = await db.execute(
          sql`SELECT id FROM articles WHERE blogger_url = ${url} LIMIT 1`
        );
        const articleRows = articleResult.rows as Array<{ id: number }>;

        if (articleRows.length > 0) {
          const articleId = articleRows[0].id;
          await db.execute(sql`
            INSERT INTO analytics (article_id, date, clicks, impressions, ctr, position)
            VALUES (${articleId}, ${new Date(dateStr)}, ${row.clicks}, ${row.impressions}, ${row.ctr}, ${row.position})
            ON CONFLICT DO NOTHING
          `);
          syncedCount++;
        }
      }

      logger.info('Analytics sync completed', { syncedCount });
      return { success: true, data: { syncedCount, totalRows: response.rows.length } };
    } catch (error) {
      logger.error('Analytics sync failed', { error });
      return { success: false, error: 'Analytics sync failed' };
    }
  }

  private async syncArticleAnalytics(articleId: number): Promise<AgentOutput> {
    try {
      const article = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);
      if (article.length === 0 || !article[0].bloggerUrl) {
        return { success: false, error: 'Article not found or not published' };
      }

      const siteUrl = await getSiteUrl();
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

      const response = await querySearchAnalytics(siteUrl, {
        startDate,
        endDate,
        dimensions: ['date'],
        rowLimit: 30,
      });

      if (!response.rows) {
        return { success: true, data: { message: 'No data for this article' } };
      }

      for (const row of response.rows) {
        await db.execute(sql`
          INSERT INTO analytics (article_id, date, clicks, impressions, ctr, position)
          VALUES (${articleId}, ${new Date(row.keys[0])}, ${row.clicks}, ${row.impressions}, ${row.ctr}, ${row.position})
          ON CONFLICT DO NOTHING
        `);
      }

      return { success: true, data: { articleId, rows: response.rows.length } };
    } catch (error) {
      logger.error('Article analytics sync failed', { articleId, error });
      return { success: false, error: 'Article analytics sync failed' };
    }
  }
}
