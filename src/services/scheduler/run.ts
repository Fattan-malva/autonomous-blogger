import { Scheduler } from './index';
import { logger } from '../../config/logger';

const scheduler = new Scheduler();
scheduler.start();

process.on('SIGTERM', async () => {
  logger.info('Scheduler received SIGTERM, shutting down...');
  scheduler.stop();
  process.exit(0);
});
