import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || '',

  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || '',
  GOOGLE_AI_MODEL: process.env.GOOGLE_AI_MODEL || 'gemma-4-26b-a4b-it',

  BLOGGER_BLOG_ID: process.env.BLOGGER_BLOG_ID || '',
  BLOGGER_CLIENT_ID: process.env.BLOGGER_CLIENT_ID || '',
  BLOGGER_CLIENT_SECRET: process.env.BLOGGER_CLIENT_SECRET || '',
  BLOGGER_REFRESH_TOKEN: process.env.BLOGGER_REFRESH_TOKEN || '',

  SEARCH_CONSOLE_CLIENT_ID: process.env.SEARCH_CONSOLE_CLIENT_ID || '',
  SEARCH_CONSOLE_CLIENT_SECRET: process.env.SEARCH_CONSOLE_CLIENT_SECRET || '',
  SEARCH_CONSOLE_REFRESH_TOKEN: process.env.SEARCH_CONSOLE_REFRESH_TOKEN || '',

    ADSTERRA_API_TOKEN: process.env.ADSTERRA_API_TOKEN || '',

    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY || '',

    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
} as const;
