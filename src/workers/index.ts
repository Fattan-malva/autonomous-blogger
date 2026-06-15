import { createWorker, QueueName } from '../services/queue';
import { logger } from '../config/logger';
import { Orchestrator } from './orchestrator';
import { runFullPipeline } from '../services/pipeline';
import { Job } from 'bullmq';

const orchestrator = new Orchestrator();

async function startWorkers(): Promise<void> {
  logger.info('Starting workers...');

  createWorker(QueueName.RESEARCH, async (job: Job) => {
    await orchestrator.handleResearch(job.data);
  }, 2);

  createWorker(QueueName.PLANNING, async (job: Job) => {
    await orchestrator.handlePlanning(job.data);
  }, 2);

  createWorker(QueueName.WRITING, async (job: Job) => {
    await orchestrator.handleWriting(job.data);
  }, 3);

  createWorker(QueueName.REVIEW, async (job: Job) => {
    await orchestrator.handleReview(job.data);
  }, 2);

  createWorker(QueueName.SEO, async (job: Job) => {
    await orchestrator.handleSEO(job.data);
  }, 2);

  createWorker(QueueName.PUBLISHING, async (job: Job) => {
    await orchestrator.handlePublishing(job.data);
  }, 2);

  createWorker(QueueName.INDEXING, async (job: Job) => {
    await orchestrator.handleIndexing(job.data);
  }, 2);

  createWorker(QueueName.ANALYTICS, async (job: Job) => {
    await orchestrator.handleAnalytics(job.data);
  }, 1);

  createWorker(QueueName.REVENUE, async (job: Job) => {
    await orchestrator.handleRevenue(job.data);
  }, 1);

  createWorker(QueueName.LEARNING, async (job: Job) => {
    await orchestrator.handleLearning(job.data);
  }, 1);

  createWorker(QueueName.PIPELINE, async () => {
    const result = await runFullPipeline();
    if (result.success) {
      logger.info('Full pipeline completed', { steps: result.stepsCompleted, url: result.url });
    } else {
      logger.error('Full pipeline failed', { steps: result.stepsCompleted, error: result.error });
    }
  }, 1);

  logger.info('All workers started');
}

startWorkers().catch((err) => {
  logger.error('Workers failed to start', { error: err });
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('Workers received SIGTERM, shutting down...');
  process.exit(0);
});
