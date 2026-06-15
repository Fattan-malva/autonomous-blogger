import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { db } from '../../database/connection';
import { revenues, analytics, articles } from '../../database/schema';
import { eq, gte, sql } from 'drizzle-orm';
import { logger } from '../../config/logger';

export class RevenueAgent extends BaseAgent {
  constructor() {
    super('Revenue');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, articleId } = input;

    switch (action) {
      case 'calculate':
        return this.calculateRevenue(articleId as number | undefined);
      case 'report':
        return this.generateReport();
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async calculateRevenue(articleId?: number): Promise<AgentOutput> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const statsResult = await db.execute(sql`
      SELECT
        article_id,
        SUM(clicks) as total_clicks,
        SUM(impressions) as total_impressions,
        AVG(position) as avg_position
      FROM analytics
      WHERE date >= ${today}
      ${articleId ? sql`AND article_id = ${articleId}` : sql``}
      GROUP BY article_id
    `);
    const articleStats = statsResult.rows as Array<Record<string, unknown>>;

    for (const stat of articleStats) {
      const estimatedRPM = 1.5;
      const estimatedRevenue = (Number(stat.total_impressions) / 1000) * estimatedRPM;

      await db.execute(sql`
        INSERT INTO revenues (article_id, date, amount, source, rpm)
        VALUES (${stat.article_id}, ${new Date()}, ${estimatedRevenue}, 'adsterra', ${estimatedRPM})
        ON CONFLICT DO NOTHING
      `);
    }

    const totalRevenue = articleStats.reduce(
      (sum: number, s: Record<string, unknown>) =>
        sum + ((Number(s.total_impressions) / 1000) * 1.5),
      0
    );

    return {
      success: true,
      data: {
        articlesProcessed: articleStats.length,
        totalEstimatedRevenue: totalRevenue,
      },
    };
  }

  private async generateReport(): Promise<AgentOutput> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const revenueResult = await db.execute(sql`
      SELECT
        date,
        SUM(amount) as total,
        COUNT(DISTINCT article_id) as article_count
      FROM revenues
      WHERE date >= ${thirtyDaysAgo}
      GROUP BY date
      ORDER BY date
    `);
    const revenueData = revenueResult.rows as Array<Record<string, unknown>>;

    const totalsResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount), 0) as total_revenue,
        COALESCE(AVG(rpm), 0) as avg_rpm,
        COUNT(DISTINCT article_id) as article_count
      FROM revenues
      WHERE date >= ${thirtyDaysAgo}
    `);
    const totals = totalsResult.rows as Array<Record<string, unknown>>;

    return {
      success: true,
      data: {
        period: '30 days',
        daily: revenueData,
        totals: totals[0] || { total_revenue: 0, avg_rpm: 0, article_count: 0 },
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
