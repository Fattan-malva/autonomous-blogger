# AGENT.md

# Autonomous Blogger SEO Business

## Vision

Build a fully autonomous publishing business capable of:

* Discovering profitable topics
* Researching competitors
* Understanding search intent
* Generating high-quality content
* Building topical authority
* Publishing automatically to Blogger
* Monetizing with Adsterra
* Tracking rankings and revenue
* Updating old content
* Learning from performance data
* Improving itself continuously

The system should behave like a digital publishing company.

Not like an article generator.

---

# Primary Objective

Maximize:

Organic Traffic
+
Indexed Pages
+
Adsterra Revenue

while maintaining content quality.

---

# Core Philosophy

Never optimize for article count.

Always optimize for:

* User value
* Search intent satisfaction
* Topical authority
* Long-term rankings
* Revenue growth

---

# AI Provider

Provider:

Google AI Studio

Default Model:

Gemma 3 31B

Requirements:

* Dynamic context only
* No static article prompts
* No keyword stuffing
* No fixed article templates

The model should receive:

Research Package
+
Competitor Intelligence
+
Topic Cluster Data
+
Existing Content Memory
+
Search Intent Analysis

---

# Agent Hierarchy

CEO Agent

├── Research Agent
├── Competitor Agent
├── SERP Gap Agent
├── Planning Agent
├── Writer Agent
├── Humanizer Agent
├── Reviewer Agent
├── SEO Agent
├── Image Agent
├── Internal Link Agent
├── Content Memory Agent
├── Topical Authority Agent
├── Blogger Agent
├── Adsterra Agent
├── Indexing Agent
├── Analytics Agent
├── Revenue Agent
├── Decay Agent
└── Business Brain Agent

---

# CEO Agent

Responsibilities:

* Coordinate all agents
* Manage workflow
* Approve publishing
* Schedule tasks
* Handle failures

Acts as system orchestrator.

---

# Research Agent

Responsibilities:

* Discover topics
* Discover long-tail opportunities
* Analyze trends
* Analyze topic demand
* Generate research packages

Output:

research-package.json

---

# Competitor Agent

Responsibilities:

Analyze ranking competitors.

Identify:

* Missing topics
* Weak coverage
* Content opportunities
* SERP structure

Output:

competitor-analysis.json

---

# SERP Gap Agent

Responsibilities:

Analyze competitor content.

Find:

* Missing questions
* Missing sections
* Missing examples
* Untapped opportunities

Output:

serp-gap-report.json

---

# Planning Agent

Responsibilities:

Build article blueprint.

Determine:

* Search intent
* Audience
* Outline
* Entities
* FAQs
* Content flow

Output:

article-plan.json

---

# Writer Agent

Responsibilities:

Generate article draft.

Rules:

* Natural writing
* Intent driven
* Useful content
* Human readable
* Markdown output

Never:

* Force keywords
* Force word counts
* Generate fluff

Output:

article.md

---

# Humanizer Agent

Responsibilities:

Reduce AI fingerprints.

Tasks:

* Vary sentence structure
* Improve transitions
* Add examples
* Add context
* Remove repetition

Output:

humanized-article.md

---

# Reviewer Agent

Responsibilities:

Validate content quality.

Checks:

* Grammar
* Readability
* Completeness
* SEO quality
* Duplicate detection

Minimum score:

85/100

If failed:

Return to Humanizer Agent.

---

# SEO Agent

Responsibilities:

Generate:

* Meta Title
* Meta Description
* URL Slug
* Canonical URL
* Open Graph Tags
* Twitter Tags

Generate Schema:

* BlogPosting
* FAQPage
* BreadcrumbList
* Organization

Output:

seo-package.json

---

# Image Agent

Responsibilities:

Generate:

* Featured Image
* Open Graph Image
* Alt Text
* Image Caption
* SEO Filename

Example:

install-docker-ubuntu.webp

Never:

image1.webp

Output:

images/

---

# Internal Link Agent

Responsibilities:

Connect articles automatically.

Tasks:

* Find relevant articles
* Generate contextual links
* Improve crawlability

Output:

internal-links.json

---

# Content Memory Agent

Responsibilities:

Store every article.

Before creating content:

* Search memory
* Detect overlap
* Prevent duplication
* Suggest internal links

Output:

content-memory.json

---

# Topical Authority Agent

Responsibilities:

Maintain topic clusters.

Example:

Docker

* Installation
* Compose
* Swarm
* Networking
* Security
* Monitoring
* VPS Deployment

System must fill clusters systematically.

Never create random content.

Output:

topic-clusters.json

---

# Blogger Agent

Responsibilities:

Automatic Blogger publishing.

Features:

* Create post
* Update post
* Delete post
* Schedule post
* Upload images
* Apply labels
* Publish HTML

API:

Google Blogger API v3

Output:

{
postId: "",
url: "",
status: "published"
}

---

# Adsterra Agent

Responsibilities:

Manage monetization.

Tasks:

* Inject Adsterra scripts
* Manage ad placement
* Optimize ad positions
* Monitor ad performance

Supported:

* Social Bar
* Native Banner
* Display Banner
* Popunder (optional)

Locations:

* After first H2
* Mid article
* Before FAQ
* End of article

Output:

ad-layout.json

---

# Indexing Agent

Responsibilities:

Google indexing automation.

Tasks:

* Submit URL
* Verify indexing
* Retry failures

Integration:

Google Search Console

Output:

indexing-report.json

---

# Analytics Agent

Responsibilities:

Collect metrics.

Sources:

* Search Console
* Blogger
* Adsterra

Metrics:

* Clicks
* Impressions
* CTR
* Position
* Revenue

Output:

analytics-report.json

---

# Revenue Agent

Responsibilities:

Track earnings.

Metrics:

* Daily Revenue
* Weekly Revenue
* Monthly Revenue
* RPM
* Revenue Per Article

Output:

revenue-report.json

---

# Decay Agent

Responsibilities:

Detect declining articles.

Signals:

* Traffic drop
* Ranking drop
* CTR drop

Actions:

* Update content
* Expand content
* Add FAQs
* Re-submit indexing

Output:

content-refresh-queue.json

---

# Business Brain Agent

Responsibilities:

Make strategic decisions.

Questions:

* Which niches generate revenue?
* Which topics rank fastest?
* Which clusters perform best?
* Which articles should be updated?

Output:

business-recommendations.json

---

# Publishing Workflow

Research

↓

Competitor Analysis

↓

SERP Gap Analysis

↓

Planning

↓

Writing

↓

Humanization

↓

Review

↓

SEO Optimization

↓

Image Generation

↓

Internal Linking

↓

Blogger Publishing

↓

Adsterra Injection

↓

Indexing

↓

Analytics Collection

↓

Revenue Analysis

↓

Learning

---

# Database

PostgreSQL

Tables:

topics

articles

article_versions

research_packages

competitor_analysis

seo_packages

internal_links

topic_clusters

indexing_logs

analytics

revenues

publishing_logs

error_logs

agent_runs

---

# Queue System

BullMQ

Queues:

research

planning

writing

review

seo

publishing

indexing

analytics

revenue

learning

---

# Scheduler

Daily:

00:00 Topic Discovery

01:00 Research

02:00 Competitor Analysis

03:00 Planning

04:00 Writing

05:00 Humanization

06:00 Review

07:00 SEO

08:00 Image Generation

09:00 Publish

10:00 Indexing

11:00 Analytics Sync

12:00 Revenue Sync

---

# Docker Services

app

worker

scheduler

postgres

redis

grafana

prometheus

nginx

---

# Environment Variables

NODE_ENV=production

PORT=3000

DATABASE_URL=

REDIS_URL=

GOOGLE_AI_API_KEY=

GOOGLE_AI_MODEL=gemma-3-31b-it

BLOGGER_BLOG_ID=

BLOGGER_CLIENT_ID=

BLOGGER_CLIENT_SECRET=

BLOGGER_REFRESH_TOKEN=

SEARCH_CONSOLE_CLIENT_ID=

SEARCH_CONSOLE_CLIENT_SECRET=

SEARCH_CONSOLE_REFRESH_TOKEN=

ADSTERRA_PUBLISHER_ID=

ADSTERRA_SOCIAL_BAR_ID=

ADSTERRA_NATIVE_ID=

ADSTERRA_BANNER_ID=

LOG_LEVEL=info

---

# Project Structure

src/

agents/
ceo/
research/
competitor/
serp-gap/
planning/
writer/
humanizer/
reviewer/
seo/
image/
internal-link/
content-memory/
topical-authority/
blogger/
adsterra/
indexing/
analytics/
revenue/
decay/
business-brain/

providers/
google-ai/
blogger/

services/
search-console/
scheduler/
queue/
storage/

database/

workers/

prompts/

config/

docker/

---

# Success Metrics

Primary:

* Indexed Pages
* Organic Clicks
* Organic Traffic
* Adsterra Revenue

Secondary:

* Topic Authority
* Ranking Growth
* CTR
* Revenue Per Article

The system's purpose is not to generate articles.

The system's purpose is to operate an autonomous Blogger publishing business that continuously grows organic traffic and Adsterra revenue.
