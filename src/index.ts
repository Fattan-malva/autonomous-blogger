import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { logger } from './config/logger';
import { testConnection } from './database/connection';
import { getQueue, QueueName, getQueueJobCounts, closeAllQueues } from './services/queue';
import dashboardRoutes from './routes/dashboard';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('combined', { stream: { write: (msg: string) => logger.info(msg.trim()) } }));
app.use(express.json());

// Serve dashboard static files
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/metrics', async (_req, res) => {
  try {
    const counts: Record<string, unknown> = {};
    for (const name of Object.values(QueueName)) {
      counts[name] = await getQueueJobCounts(name as QueueName);
    }
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get queue metrics' });
  }
});

app.get('/api/status', async (_req, res) => {
  res.json({
    app: 'Autonomous Blogger SEO Business',
    version: '1.0.0',
    environment: env.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Dashboard API routes
app.use('/api/dashboard', dashboardRoutes);

// SPA fallback — serve dashboard for all unmatched routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function start(): Promise<void> {
  const dbConnected = await testConnection();

  if (!dbConnected) {
    logger.error('Database connection failed, exiting');
    process.exit(1);
  }

  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    logger.info(`Health check: http://localhost:${env.PORT}/health`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await closeAllQueues();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});
