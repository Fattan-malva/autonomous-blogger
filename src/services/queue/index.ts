import { Queue, Worker, ConnectionOptions, Job } from 'bullmq';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const connection: ConnectionOptions = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export enum QueueName {
  RESEARCH = 'research',
  PLANNING = 'planning',
  WRITING = 'writing',
  REVIEW = 'review',
  SEO = 'seo',
  PUBLISHING = 'publishing',
  INDEXING = 'indexing',
  ANALYTICS = 'analytics',
  REVENUE = 'revenue',
  LEARNING = 'learning',
}

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, { connection });
    queues.set(name, queue);
    logger.debug(`Queue created: ${name}`);
  }
  return queues.get(name)!;
}

export function createWorker(
  queueName: QueueName,
  handler: (job: Job) => Promise<void>,
  concurrency: number = 1
): Worker {
  const worker = new Worker(queueName, handler, {
    connection,
    concurrency,
    lockDuration: 300000,
    stalledInterval: 30000,
    maxStalledCount: 3,
  });

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed in queue ${queueName}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed in queue ${queueName}`, { error: err.message });
  });

  worker.on('error', (err) => {
    logger.error(`Worker error in queue ${queueName}`, { error: err.message });
  });

  return worker;
}

export async function addJob(
  queueName: QueueName,
  name: string,
  data: Record<string, unknown>,
  opts?: { delay?: number; priority?: number }
): Promise<Job> {
  const queue = getQueue(queueName);
  const job = await queue.add(name, data, {
    removeOnComplete: { age: 3600 * 24 * 7 },
    removeOnFail: { age: 3600 * 24 * 30 },
    ...opts,
  });
  logger.info(`Job ${job.id} added to queue ${queueName}`, { jobName: name });
  return job;
}

export async function getQueueJobCounts(queueName: QueueName) {
  const queue = getQueue(queueName);
  return queue.getJobCounts();
}

export async function closeAllQueues(): Promise<void> {
  for (const [name, queue] of queues) {
    await queue.close();
    logger.debug(`Queue closed: ${name}`);
  }
  queues.clear();
}
