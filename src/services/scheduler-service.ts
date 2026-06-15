import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import { getSchedulerConfig } from './content-store';
import { logger } from '../config/logger';
import { env } from '../config/env';

let schedulerTask: cron.ScheduledTask | null = null;

export function restartContentScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }

  const cfg = getSchedulerConfig();
  if (!cfg.enabled) {
    logger.info('Content scheduler is disabled');
    return;
  }

  const interval = Math.max(cfg.intervalMinutes || 144, 5);
  const cronExpr = `*/${interval} * * * *`;

  schedulerTask = cron.schedule(cronExpr, () => {
    logger.info('Scheduled content generation starting...');
    const isProd = env.NODE_ENV === 'production';
    const cmd = isProd
      ? 'node dist/generate-content.js'
      : process.platform === 'win32'
        ? 'npx.cmd ts-node src/generate-content.ts'
        : 'npx ts-node src/generate-content.ts';
    exec(cmd, { cwd: path.resolve(__dirname, '../..'), timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        logger.error('Scheduled generation failed', { error: stderr || stdout });
      } else {
        logger.info('Scheduled generation completed');
      }
    });
  });

  logger.info(`Content scheduler started: every ${interval} minutes`);
}

export function stopContentScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }
}
