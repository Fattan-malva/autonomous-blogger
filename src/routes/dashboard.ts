import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { sql } from 'drizzle-orm';
import { getQueueJobCounts, QueueName } from '../services/queue';

const router = Router();

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const articleResult = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'published')::int AS published,
        COUNT(*) FILTER (WHERE status = 'draft')::int AS drafts,
        COUNT(*) FILTER (WHERE status = 'error')::int AS errors
      FROM articles
    `);
    const topicResult = await db.execute(sql`SELECT COUNT(*)::int AS count FROM topics`);
    const errorResult = await db.execute(sql`SELECT COUNT(*)::int AS count FROM error_logs`);
    const pipelineResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM agent_runs WHERE agent = 'Orchestrator' AND started_at >= NOW() - INTERVAL '24 hours'
    `);
    const analyticsResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(impressions)::int, 0) AS total_impressions,
        COALESCE(SUM(clicks)::int, 0) AS total_clicks,
        COALESCE(SUM(revenues.amount)::numeric(12,4), 0) AS total_revenue
      FROM analytics
      LEFT JOIN revenues ON revenues.article_id = analytics.article_id AND revenues.date = analytics.date
    `);
    const schedulerResult = await db.execute(sql`
      SELECT status, COUNT(*)::int AS count FROM agent_runs
      WHERE agent = 'Orchestrator' AND started_at >= NOW() - INTERVAL '7 days'
      GROUP BY status
    `);

    const articles = (articleResult.rows?.[0] || {}) as any;
    const topicRow = (topicResult.rows?.[0] || {}) as any;
    const errorRow = (errorResult.rows?.[0] || {}) as any;
    const pipelineRow = (pipelineResult.rows?.[0] || {}) as any;
    const analyticsRow = (analyticsResult.rows?.[0] || {}) as any;

    res.json({
      articles: {
        total: articles.total || 0,
        published: articles.published || 0,
        drafts: articles.drafts || 0,
        errors: articles.errors || 0,
      },
      topics: topicRow.count || 0,
      errorLogs: errorRow.count || 0,
      pipelines24h: pipelineRow.count || 0,
      analytics: {
        total_impressions: analyticsRow.total_impressions || 0,
        total_clicks: analyticsRow.total_clicks || 0,
        total_revenue: analyticsRow.total_revenue || 0,
      },
      scheduler: (schedulerResult.rows || []) as any[],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/articles', async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        a.id, a.title, a.slug, a.status, a.blogger_url, a.published_at, a.word_count,
        a.quality_score, a.readability_score, a.created_at,
        t.keyword, t.cluster,
        COALESCE(an.clicks, 0)::int AS clicks,
        COALESCE(an.impressions, 0)::int AS impressions,
        COALESCE(an.ctr, 0)::numeric(8,4) AS ctr,
        COALESCE(an.position, 0)::numeric(5,2) AS position,
        COALESCE(rv.amount, 0)::numeric(12,4) AS revenue
      FROM articles a
      LEFT JOIN topics t ON t.id = a.topic_id
      LEFT JOIN LATERAL (
        SELECT SUM(clicks)::int AS clicks, SUM(impressions)::int AS impressions,
               AVG(ctr)::numeric(8,4) AS ctr, AVG(position)::numeric(5,2) AS position
        FROM analytics WHERE article_id = a.id
      ) an ON true
      LEFT JOIN LATERAL (
        SELECT SUM(amount)::numeric(12,4) AS amount FROM revenues WHERE article_id = a.id
      ) rv ON true
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/runs', async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT id, agent, action, status, duration_ms, started_at, completed_at
      FROM agent_runs
      ORDER BY started_at DESC
      LIMIT 50
    `);
    res.json(result.rows || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics', async (_req: Request, res: Response) => {
  try {
    const dailyResult = await db.execute(sql`
      SELECT
        date::date AS day,
        SUM(impressions)::int AS impressions,
        SUM(clicks)::int AS clicks,
        AVG(position)::numeric(5,2) AS avg_position
      FROM analytics
      WHERE date >= NOW() - INTERVAL '30 days'
      GROUP BY date::date
      ORDER BY day
    `);
    const byArticleResult = await db.execute(sql`
      SELECT
        a.id, a.title, a.blogger_url,
        SUM(an.impressions)::int AS impressions,
        SUM(an.clicks)::int AS clicks,
        AVG(an.position)::numeric(5,2) AS avg_position
      FROM analytics an
      JOIN articles a ON a.id = an.article_id
      GROUP BY a.id, a.title, a.blogger_url
      ORDER BY SUM(an.impressions) DESC
      LIMIT 20
    `);
    res.json({ daily: dailyResult.rows || [], byArticle: byArticleResult.rows || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/revenue', async (_req: Request, res: Response) => {
  try {
    const dailyResult = await db.execute(sql`
      SELECT
        date::date AS day,
        SUM(amount)::numeric(12,4) AS amount,
        COUNT(*)::int AS entries
      FROM revenues
      WHERE date >= NOW() - INTERVAL '30 days'
      GROUP BY date::date
      ORDER BY day
    `);
    const totalResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount), 0)::numeric(12,4) AS total,
        COALESCE(AVG(rpm), 0)::numeric(10,4) AS avg_rpm,
        COUNT(*)::int AS entries
      FROM revenues
    `);
    const totalRow = (totalResult.rows?.[0] || {}) as any;
    res.json({
      daily: dailyResult.rows || [],
      total: { total: totalRow.total || 0, avg_rpm: totalRow.avg_rpm || 0, entries: totalRow.entries || 0 },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/queues', async (_req: Request, res: Response) => {
  try {
    const counts: Record<string, unknown> = {};
    for (const name of Object.values(QueueName)) {
      counts[name] = await getQueueJobCounts(name as QueueName);
    }
    res.json(counts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
