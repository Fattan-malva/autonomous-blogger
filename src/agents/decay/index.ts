import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { db } from '../../database/connection';
import { analytics, articles } from '../../database/schema';
import { eq, and, gte, lt, desc, sql } from 'drizzle-orm';
import { logger } from '../../config/logger';

const DECAY_SYSTEM_PROMPT = `You are a Decay Agent. Detect articles with declining performance and recommend updates.

Signals to detect:
- Traffic drops > 20% month over month
- Ranking position drops
- CTR decline
- Outdated information
- New competitor content surpassing the article`;

export class DecayAgent extends BaseAgent {
  constructor() {
    super('Decay');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, articleId } = input;

    switch (action) {
      case 'detect-decay':
        return this.detectDecay(articleId as number | undefined);
      case 'refresh-queue':
        return this.generateRefreshQueue();
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async detectDecay(articleId?: number): Promise<AgentOutput> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const metricsResult = await db.execute(sql`
      SELECT
        article_id,
        to_char(date, 'YYYY-MM') as month,
        SUM(clicks) as total_clicks,
        SUM(impressions) as total_impressions,
        AVG(position) as avg_position
      FROM analytics
      WHERE date >= ${lastMonthStart}
      ${articleId ? sql`AND article_id = ${articleId}` : sql``}
      GROUP BY article_id, to_char(date, 'YYYY-MM')
      HAVING SUM(clicks) > 0
    `);
    const articleMetrics = metricsResult.rows as Array<Record<string, unknown>>;

    const decaying: Array<Record<string, unknown>> = [];

    for (const record of articleMetrics) {
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);

      const prevResult = await db.execute(sql`
        SELECT SUM(clicks) as clicks
        FROM analytics
        WHERE article_id = ${record.article_id}
          AND date >= ${prevMonthStart}
          AND date < ${lastMonthStart}
        GROUP BY article_id
      `);
      const prevMonth = prevResult.rows as Array<{ clicks: number }>;

      if (prevMonth.length > 0) {
        const prevClicks = Number(prevMonth[0].clicks);
        const currClicks = Number(record.total_clicks);
        const decline = prevClicks > 0 ? ((prevClicks - currClicks) / prevClicks) * 100 : 0;

        if (decline > 20) {
          const article = await db.select().from(articles).where(eq(articles.id, record.article_id as number)).limit(1);
          decaying.push({
            articleId: record.article_id,
            title: article[0]?.title || 'Unknown',
            declinePercent: decline,
            currentClicks: currClicks,
            previousClicks: prevClicks,
            avgPosition: Number(record.avg_position),
          });
        }
      }
    }

    return {
      success: true,
      data: {
        decayingArticles: decaying,
        totalAnalyzed: articleMetrics.length,
        decayingCount: decaying.length,
      },
    };
  }

  private async generateRefreshQueue(): Promise<AgentOutput> {
    const decayResult = await this.detectDecay();
    const decaying = (decayResult.data?.decayingArticles || []) as Array<Record<string, unknown>>;

    const refreshQueue = decaying.map((article) => ({
      articleId: article.articleId,
      title: article.title,
      declinePercent: article.declinePercent,
      priority: (article.declinePercent as number) > 50 ? 'high' : 'medium',
      suggestedActions: ['update-content', 'expand-sections', 'add-faqs', 'refresh-links', 'resubmit-indexing'],
    }));

    return {
      success: true,
      data: {
        refreshQueue,
        count: refreshQueue.length,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
