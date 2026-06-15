import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';
import { db } from '../../database/connection';
import { revenues, analytics, articles, topics } from '../../database/schema';
import { eq, gte, desc, sql, and } from 'drizzle-orm';
import { logger } from '../../config/logger';

const BUSINESS_BRAIN_SYSTEM_PROMPT = `You are the Business Brain Agent. Make strategic decisions for the autonomous publishing business.

Analyze performance data and answer:
- Which niches generate the most revenue?
- Which topics rank fastest?
- Which clusters perform best?
- Which articles need updates?
- What new topics should be explored?
- What strategic shifts should be made?`;

export class BusinessBrainAgent extends BaseAgent {
  constructor() {
    super('Business-Brain');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action } = input;

    switch (action) {
      case 'analyze':
        return this.analyzeBusiness();
      case 'recommend':
        return this.generateRecommendations();
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async analyzeBusiness(): Promise<AgentOutput> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const topArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        cluster: topics.cluster,
        clicks: sql<number>`SUM(${analytics.clicks})`.as('clicks'),
        impressions: sql<number>`SUM(${analytics.impressions})`.as('impressions'),
        position: sql<number>`AVG(${analytics.position})`.as('position'),
        revenue: sql<number>`COALESCE(SUM(${revenues.amount}), 0)`.as('revenue'),
      })
      .from(articles)
      .leftJoin(analytics, eq(articles.id, analytics.articleId))
      .leftJoin(revenues, eq(articles.id, revenues.articleId))
      .leftJoin(topics, eq(articles.topicId, topics.id))
      .where(gte(analytics.date, thirtyDaysAgo))
      .groupBy(articles.id, topics.cluster)
      .orderBy(desc(sql`SUM(${analytics.clicks})`))
      .limit(20);

    const clusterPerformance = await db
      .select({
        cluster: topics.cluster,
        totalClicks: sql<number>`SUM(${analytics.clicks})`.as('total_clicks'),
        totalImpressions: sql<number>`SUM(${analytics.impressions})`.as('total_impressions'),
        articleCount: sql<number>`COUNT(DISTINCT ${articles.id})`.as('article_count'),
        totalRevenue: sql<number>`COALESCE(SUM(${revenues.amount}), 0)`.as('total_revenue'),
      })
      .from(topics)
      .leftJoin(articles, eq(topics.id, articles.topicId))
      .leftJoin(analytics, eq(articles.id, analytics.articleId))
      .leftJoin(revenues, eq(articles.id, revenues.articleId))
      .where(and(
        gte(analytics.date, thirtyDaysAgo),
        sql`${topics.cluster} IS NOT NULL`
      ))
      .groupBy(topics.cluster)
      .orderBy(desc(sql`SUM(${analytics.clicks})`));

    return {
      success: true,
      data: {
        topArticles,
        clusterPerformance,
        analysisPeriod: '30 days',
      },
    };
  }

  private async generateRecommendations(): Promise<AgentOutput> {
    const analysis = await this.analyzeBusiness();
    const data = analysis.data as Record<string, unknown>;

    const prompt = `Analyze this business data and provide strategic recommendations.

Top articles: ${JSON.stringify(data.topArticles)}
Cluster performance: ${JSON.stringify(data.clusterPerformance)}

Provide recommendations for:
1. Which clusters to expand
2. Which topics to create next
3. Which articles to update
4. Strategic opportunities
5. Revenue optimization suggestions

Return as structured JSON with priority rankings.`;

    const result = await generateWithSystemPrompt(BUSINESS_BRAIN_SYSTEM_PROMPT, prompt);
    const recommendations = JSON.parse(result);

    return {
      success: true,
      data: {
        recommendations,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}


