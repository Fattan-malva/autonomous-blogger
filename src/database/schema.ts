import { pgTable, serial, text, integer, timestamp, varchar, jsonb, boolean, decimal } from 'drizzle-orm/pg-core';

export const topics = pgTable('topics', {
  id: serial('id').primaryKey(),
  keyword: varchar('keyword', { length: 500 }).notNull().unique(),
  cluster: varchar('cluster', { length: 255 }),
  status: varchar('status', { length: 50 }).default('discovered'),
  searchVolume: integer('search_volume'),
  difficulty: decimal('difficulty', { precision: 5, scale: 2 }),
  intent: varchar('intent', { length: 50 }),
  trendScore: integer('trend_score').default(0),
  monetizationScore: integer('monetization_score').default(0),
  contentType: varchar('content_type', { length: 50 }),
  reason: text('reason'),
  lastVerifiedAt: timestamp('last_verified_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const articles = pgTable('articles', {
  id: serial('id').primaryKey(),
  topicId: integer('topic_id').references(() => topics.id),
  title: varchar('title', { length: 500 }).notNull(),
  slug: varchar('slug', { length: 500 }).notNull().unique(),
  content: text('content'),
  excerpt: text('excerpt'),
  status: varchar('status', { length: 50 }).default('draft'),
  bloggerPostId: varchar('blogger_post_id', { length: 255 }),
  bloggerUrl: varchar('blogger_url', { length: 1000 }),
  publishedAt: timestamp('published_at'),
  wordCount: integer('word_count'),
  readabilityScore: decimal('readability_score', { precision: 5, scale: 2 }),
  qualityScore: decimal('quality_score', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const articleVersions = pgTable('article_versions', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').references(() => articles.id),
  content: text('content').notNull(),
  version: integer('version').notNull(),
  createdBy: varchar('created_by', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const researchPackages = pgTable('research_packages', {
  id: serial('id').primaryKey(),
  topicId: integer('topic_id').references(() => topics.id),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const competitorAnalysis = pgTable('competitor_analysis', {
  id: serial('id').primaryKey(),
  topicId: integer('topic_id').references(() => topics.id),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const seoPackages = pgTable('seo_packages', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').references(() => articles.id),
  metaTitle: varchar('meta_title', { length: 500 }),
  metaDescription: text('meta_description'),
  canonicalUrl: varchar('canonical_url', { length: 1000 }),
  schemaMarkup: jsonb('schema_markup'),
  openGraph: jsonb('open_graph'),
  twitterCards: jsonb('twitter_cards'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const internalLinks = pgTable('internal_links', {
  id: serial('id').primaryKey(),
  sourceArticleId: integer('source_article_id').references(() => articles.id),
  targetArticleId: integer('target_article_id').references(() => articles.id),
  anchorText: varchar('anchor_text', { length: 500 }),
  context: text('context'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const topicClusters = pgTable('topic_clusters', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  coverageScore: decimal('coverage_score', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const clusterTopics = pgTable('cluster_topics', {
  id: serial('id').primaryKey(),
  clusterId: integer('cluster_id').references(() => topicClusters.id),
  topicId: integer('topic_id').references(() => topics.id),
  order: integer('order'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const indexingLogs = pgTable('indexing_logs', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').references(() => articles.id),
  url: varchar('url', { length: 1000 }),
  status: varchar('status', { length: 50 }),
  response: jsonb('response'),
  attemptedAt: timestamp('attempted_at').defaultNow(),
});

export const analytics = pgTable('analytics', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').references(() => articles.id),
  date: timestamp('date').notNull(),
  clicks: integer('clicks').default(0),
  impressions: integer('impressions').default(0),
  ctr: decimal('ctr', { precision: 8, scale: 4 }),
  position: decimal('position', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const revenues = pgTable('revenues', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').references(() => articles.id),
  date: timestamp('date').notNull(),
  amount: decimal('amount', { precision: 12, scale: 4 }),
  source: varchar('source', { length: 100 }),
  rpm: decimal('rpm', { precision: 10, scale: 4 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const publishingLogs = pgTable('publishing_logs', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').references(() => articles.id),
  action: varchar('action', { length: 50 }),
  status: varchar('status', { length: 50 }),
  response: jsonb('response'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const errorLogs = pgTable('error_logs', {
  id: serial('id').primaryKey(),
  agent: varchar('agent', { length: 100 }),
  action: varchar('action', { length: 255 }),
  error: text('error'),
  stack: text('stack'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const agentRuns = pgTable('agent_runs', {
  id: serial('id').primaryKey(),
  agent: varchar('agent', { length: 100 }).notNull(),
  action: varchar('action', { length: 255 }),
  status: varchar('status', { length: 50 }).default('running'),
  input: jsonb('input'),
  output: jsonb('output'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),
});
