import * as cron from 'node-cron';
import { logger } from '../../config/logger';
import { getQueue, QueueName } from '../queue';

export class Scheduler {
  private jobs: cron.ScheduledTask[] = [];

  start(): void {
    logger.info('Starting scheduler...');

    // Full pipeline run once daily at 00:00
    this.schedule('00 00 * * *', 'pipeline', 'full-pipeline', {});

    // Individual jobs (legacy / per-step)
    this.schedule('00 00 * * *', 'research', 'discover-topics', {});     // 00:00 - Topic Discovery
    this.schedule('00 01 * * *', 'research', 'deep-research', {});       // 01:00 - Research
    this.schedule('00 02 * * *', 'research', 'competitor-analysis', {}); // 02:00 - Competitor Analysis
    this.schedule('00 03 * * *', 'planning', 'plan-articles', {});       // 03:00 - Planning
    this.schedule('00 04 * * *', 'writing', 'write-articles', {});       // 04:00 - Writing
    this.schedule('00 05 * * *', 'writing', 'humanize', {});            // 05:00 - Humanization
    this.schedule('00 06 * * *', 'review', 'review-articles', {});       // 06:00 - Review
    this.schedule('00 07 * * *', 'seo', 'optimize', {});                 // 07:00 - SEO
    this.schedule('00 08 * * *', 'seo', 'generate-images', {});          // 08:00 - Image Generation
    this.schedule('00 09 * * *', 'publishing', 'publish', {});           // 09:00 - Publish
    this.schedule('00 10 * * *', 'indexing', 'batch-submit', {});        // 10:00 - Indexing
    this.schedule('00 11 * * *', 'analytics', 'sync-all', {});           // 11:00 - Analytics Sync
    this.schedule('00 12 * * *', 'revenue', 'calculate', {});            // 12:00 - Revenue Sync

    this.schedule('00 */2 * * *', 'learning', 'analyze-performance', {}); // Every 2 hours - Analysis

    logger.info(`Scheduler started with ${this.jobs.length} scheduled jobs`);
  }

  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    logger.info('Scheduler stopped');
  }

  private schedule(cronExpression: string, queueName: string, jobName: string, data: Record<string, unknown>): void {
    if (!cron.validate(cronExpression)) {
      logger.error(`Invalid cron expression: ${cronExpression}`);
      return;
    }

    const task = cron.schedule(cronExpression, async () => {
      try {
        const queue = getQueue(queueName as QueueName);
        await queue.add(jobName, data);
        logger.info(`Scheduled job "${jobName}" added to queue "${queueName}"`);
      } catch (error) {
        logger.error(`Failed to execute scheduled job "${jobName}"`, { error });
      }
    });

    this.jobs.push(task);
    logger.debug(`Scheduled: ${cronExpression} -> ${queueName}:${jobName}`);
  }
}
