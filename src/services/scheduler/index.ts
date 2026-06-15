import * as cron from 'node-cron';
import { logger } from '../../config/logger';
import { getQueue, QueueName } from '../queue';

export class Scheduler {
  private jobs: cron.ScheduledTask[] = [];

  start(): void {
    logger.info('Starting scheduler...');

    // Full pipeline run 5x daily (every ~5 hours)
    this.schedule('00 00 * * *', 'pipeline', 'full-pipeline', {});  // 00:00
    this.schedule('00 05 * * *', 'pipeline', 'full-pipeline', {});  // 05:00
    this.schedule('00 10 * * *', 'pipeline', 'full-pipeline', {});  // 10:00
    this.schedule('00 15 * * *', 'pipeline', 'full-pipeline', {});  // 15:00
    this.schedule('00 20 * * *', 'pipeline', 'full-pipeline', {});  // 20:00

    logger.info(`Scheduler started with ${this.jobs.length} jobs — 5x daily pipeline`);
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
