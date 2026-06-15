import 'dotenv/config';
import { db } from './connection';
import { logger } from '../config/logger';
import { sql } from 'drizzle-orm';

async function migrate() {
  logger.info('Running database migrations...');

  try {
    const createTablesSQL = sql.raw(`
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        keyword VARCHAR(500) NOT NULL UNIQUE,
        cluster VARCHAR(255),
        status VARCHAR(50) DEFAULT 'discovered',
        search_volume INTEGER,
        difficulty DECIMAL(5,2),
        intent VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id),
        title VARCHAR(500) NOT NULL,
        slug VARCHAR(500) NOT NULL UNIQUE,
        content TEXT,
        excerpt TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        blogger_post_id VARCHAR(255),
        blogger_url VARCHAR(1000),
        published_at TIMESTAMP,
        word_count INTEGER,
        readability_score DECIMAL(5,2),
        quality_score DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS article_versions (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES articles(id),
        content TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS research_packages (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id),
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS competitor_analysis (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id),
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seo_packages (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES articles(id),
        meta_title VARCHAR(500),
        meta_description TEXT,
        canonical_url VARCHAR(1000),
        schema_markup JSONB,
        open_graph JSONB,
        twitter_cards JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS internal_links (
        id SERIAL PRIMARY KEY,
        source_article_id INTEGER REFERENCES articles(id),
        target_article_id INTEGER REFERENCES articles(id),
        anchor_text VARCHAR(500),
        context TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS topic_clusters (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        coverage_score DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cluster_topics (
        id SERIAL PRIMARY KEY,
        cluster_id INTEGER REFERENCES topic_clusters(id),
        topic_id INTEGER REFERENCES topics(id),
        "order" INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS indexing_logs (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES articles(id),
        url VARCHAR(1000),
        status VARCHAR(50),
        response JSONB,
        attempted_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES articles(id),
        date TIMESTAMP NOT NULL,
        clicks INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        ctr DECIMAL(8,4),
        position DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS revenues (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES articles(id),
        date TIMESTAMP NOT NULL,
        amount DECIMAL(12,4),
        source VARCHAR(100),
        rpm DECIMAL(10,4),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS publishing_logs (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES articles(id),
        action VARCHAR(50),
        status VARCHAR(50),
        response JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS error_logs (
        id SERIAL PRIMARY KEY,
        agent VARCHAR(100),
        action VARCHAR(255),
        error TEXT,
        stack TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS agent_runs (
        id SERIAL PRIMARY KEY,
        agent VARCHAR(100) NOT NULL,
        action VARCHAR(255),
        status VARCHAR(50) DEFAULT 'running',
        input JSONB,
        output JSONB,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        duration_ms INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
      CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
      CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
      CREATE INDEX IF NOT EXISTS idx_topics_cluster ON topics(cluster);
      CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
      CREATE INDEX IF NOT EXISTS idx_analytics_article ON analytics(article_id);
      CREATE INDEX IF NOT EXISTS idx_revenues_date ON revenues(date);
    `);

    await db.execute(createTablesSQL);
    logger.info('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error });
    process.exit(1);
  }
}

migrate();
