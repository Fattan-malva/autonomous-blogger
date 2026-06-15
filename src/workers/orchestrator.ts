import { logger } from '../config/logger';
import { CEOAgent } from '../agents/ceo';
import { ResearchAgent } from '../agents/research';
import { CompetitorAgent } from '../agents/competitor';
import { SERPGapAgent } from '../agents/serp-gap';
import { PlanningAgent } from '../agents/planning';
import { WriterAgent } from '../agents/writer';
import { HumanizerAgent } from '../agents/humanizer';
import { ReviewerAgent } from '../agents/reviewer';
import { SEOAgent } from '../agents/seo';
import { ImageAgent } from '../agents/image';
import { InternalLinkAgent } from '../agents/internal-link';
import { ContentMemoryAgent } from '../agents/content-memory';
import { TopicalAuthorityAgent } from '../agents/topical-authority';
import { BloggerAgent } from '../agents/blogger';
import { AdsterraAgent } from '../agents/adsterra';
import { IndexingAgent } from '../agents/indexing';
import { AnalyticsAgent } from '../agents/analytics';
import { RevenueAgent } from '../agents/revenue';
import { DecayAgent } from '../agents/decay';
import { BusinessBrainAgent } from '../agents/business-brain';
import { db } from '../database/connection';
import { agentRuns } from '../database/schema';
import { eq } from 'drizzle-orm';

export class Orchestrator {
  private ceo: CEOAgent;
  private research: ResearchAgent;
  private competitor: CompetitorAgent;
  private serpGap: SERPGapAgent;
  private planning: PlanningAgent;
  private writer: WriterAgent;
  private humanizer: HumanizerAgent;
  private reviewer: ReviewerAgent;
  private seo: SEOAgent;
  private image: ImageAgent;
  private internalLink: InternalLinkAgent;
  private contentMemory: ContentMemoryAgent;
  private topicalAuthority: TopicalAuthorityAgent;
  private blogger: BloggerAgent;
  private adsterra: AdsterraAgent;
  private indexing: IndexingAgent;
  private analytics: AnalyticsAgent;
  private revenue: RevenueAgent;
  private decay: DecayAgent;
  private businessBrain: BusinessBrainAgent;

  constructor() {
    this.ceo = new CEOAgent();
    this.research = new ResearchAgent();
    this.competitor = new CompetitorAgent();
    this.serpGap = new SERPGapAgent();
    this.planning = new PlanningAgent();
    this.writer = new WriterAgent();
    this.humanizer = new HumanizerAgent();
    this.reviewer = new ReviewerAgent();
    this.seo = new SEOAgent();
    this.image = new ImageAgent();
    this.internalLink = new InternalLinkAgent();
    this.contentMemory = new ContentMemoryAgent();
    this.topicalAuthority = new TopicalAuthorityAgent();
    this.blogger = new BloggerAgent();
    this.adsterra = new AdsterraAgent();
    this.indexing = new IndexingAgent();
    this.analytics = new AnalyticsAgent();
    this.revenue = new RevenueAgent();
    this.decay = new DecayAgent();
    this.businessBrain = new BusinessBrainAgent();
  }

  async handleResearch(data: Record<string, unknown>): Promise<void> {
    const runId = await this.logRun('Research', data);
    try {
      if (data.topic) {
        await this.research.run({ action: 'deep-research', topic: data.topic, cluster: data.cluster });
      } else {
        await this.research.run({ action: 'discover-topics' });
      }

      if (data.keyword && data.topicId) {
        await this.competitor.run({ action: 'analyze', topicId: data.topicId, keyword: data.keyword });
        await this.serpGap.run({ action: 'find-gaps', keyword: data.keyword });
      }
    } finally {
      await this.completeRun(runId);
    }
  }

  async handlePlanning(data: Record<string, unknown>): Promise<void> {
    const runId = await this.logRun('Planning', data);
    try {
      await this.planning.run({
        action: 'create-plan',
        keyword: data.keyword,
        researchData: data.researchData,
        competitorData: data.competitorData,
        serpGaps: data.serpGaps,
      });
    } finally {
      await this.completeRun(runId);
    }
  }

  async handleWriting(data: Record<string, unknown>): Promise<void> {
    const runId = await this.logRun('Writing', data);
    try {
      const writeResult = await this.writer.run({
        action: 'write-draft',
        articlePlan: data.articlePlan,
        researchData: data.researchData,
      });

      if (writeResult.success) {
        const humanizeResult = await this.humanizer.run({
          action: 'humanize',
          content: writeResult.data?.content,
        });

        if (humanizeResult.success) {
          const reviewResult = await this.reviewer.run({
            action: 'review',
            content: humanizeResult.data?.humanizedContent,
            articlePlan: data.articlePlan,
          });

          const reviewData = reviewResult.data as Record<string, unknown> | undefined;
          if (reviewData && !reviewData.passed && (reviewData.overallScore as number) < 85) {
            logger.warn('Article failed review, needs revision');
          }
        }
      }
    } finally {
      await this.completeRun(runId);
    }
  }

  async handleReview(data: Record<string, unknown>): Promise<void> {
    const runId = await this.logRun('Review', data);
    try {
      await this.reviewer.run({
        action: 'review',
        content: data.content,
        articlePlan: data.articlePlan,
      });
    } finally {
      await this.completeRun(runId);
    }
  }

  async handleSEO(data: Record<string, unknown>): Promise<void> {
    const runId = await this.logRun('SEO', data);
    try {
      await this.seo.run({
        action: 'generate-seo',
        content: data.content,
        title: data.title,
        keyword: data.keyword,
      });

      await this.image.run({
        action: 'plan-images',
        content: data.content,
        title: data.title,
      });
    } finally {
      await this.completeRun(runId);
    }
  }

  async handlePublishing(data: Record<string, unknown>): Promise<void> {
    const runId = await this.logRun('Publishing', data);
    try {
      const adsterraResult = await this.adsterra.run({
        action: 'generate-layout',
        articleContent: data.content,
      });

      await this.internalLink.run({
        action: 'find-links',
        articleId: data.articleId,
        articleContent: data.content,
        articleTitle: data.title,
      });

      await this.blogger.run({
        action: 'publish',
        articleId: data.articleId,
        content: data.content,
        title: data.title,
        labels: data.labels,
        seoData: data.seoData,
        adsterraLayout: JSON.stringify(adsterraResult.data?.layout || {}),
      });
    } finally {
      await this.completeRun(runId);
    }
  }

  async handleIndexing(data: Record<string, unknown>): Promise<void> {
    const runId = await this.logRun('Indexing', data);
    try {
      if (data.articleId && data.url) {
        await this.indexing.run({ action: 'submit-url', articleId: data.articleId, url: data.url });
      } else {
        await this.indexing.run({ action: 'batch-submit' });
      }
    } finally {
      await this.completeRun(runId);
    }
  }

  async handleAnalytics(data: Record<string, unknown>): Promise<void> {
    const runId = await this.logRun('Analytics', data);
    try {
      if (data.articleId) {
        await this.analytics.run({ action: 'sync-article', articleId: data.articleId });
      } else {
        await this.analytics.run({ action: 'sync-all' });
      }
    } finally {
      await this.completeRun(runId);
    }
  }

  async handleRevenue(data: Record<string, unknown>): Promise<void> {
    const runId = await this.logRun('Revenue', data);
    try {
      await this.revenue.run({ action: 'calculate' });
      await this.revenue.run({ action: 'report' });
    } finally {
      await this.completeRun(runId);
    }
  }

  async handleLearning(data: Record<string, unknown>): Promise<void> {
    const runId = await this.logRun('Learning', data);
    try {
      const decayResult = await this.decay.run({ action: 'detect-decay' });
      await this.businessBrain.run({ action: 'analyze' });

      if (decayResult.success && (decayResult.data?.decayingCount as number) > 0) {
        logger.info('Decaying articles detected, queuing updates');
      }
    } finally {
      await this.completeRun(runId);
    }
  }

  private async logRun(agentName: string, data: Record<string, unknown>): Promise<number | null> {
    try {
      const result = await db.insert(agentRuns).values({
        agent: agentName,
        action: data.action as string || 'unknown',
        status: 'running',
        input: data,
      }).returning();
      return result[0]?.id || null;
    } catch {
      return null;
    }
  }

  private async completeRun(runId: number | null): Promise<void> {
    if (!runId) return;
    try {
      await db.update(agentRuns)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(agentRuns.id, runId));
    } catch {
      // silent
    }
  }
}


