# AGENT.md — Autonomous Blogger SEO Business

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

The system should behave like a digital publishing company. Not like an article generator.

---

## Primary Objective

Maximize: Organic Traffic + Indexed Pages + Adsterra Revenue

while maintaining content quality.

---

## Core Philosophy

Never optimize for article count. Always optimize for:

* User value
* Search intent satisfaction
* Topical authority
* Long-term rankings
* Revenue growth

---

## AI Provider

Provider: Google AI Studio

Default Model: `gemma-4-26b-a4b-it`

Note: Gemma 4 returns responses with `thought` parts — code picks the last non-`thought` part. Gemma 4 does NOT support `systemInstruction` parameter; system prompt is merged into user prompt.

---

## Agent Hierarchy

CEO Agent (Orchestrator)

├── Research Agent        — Topic discovery & deep research
├── Competitor Agent      — Competitor content analysis
├── SERP Gap Agent        — Missing opportunities in SERP
├── Planning Agent        — Article blueprint
├── Writer Agent          — Draft generation (2000+ words)
├── Humanizer Agent       — Remove AI fingerprints
├── Reviewer Agent        — Quality validation (pass >= 85)
├── SEO Agent             — Meta tags, schema, OG, Twitter, canonical
├── Image Agent           — Visual planning with Picsum
├── Internal Link Agent   — Contextual internal linking
├── Content Memory Agent  — Duplicate prevention
├── Topical Authority     — Topic cluster management
├── Blogger Agent         — Publish to Blogger API v3
├── Adsterra Agent        — Inject ad scripts (hardcoded from dashboard)
├── Indexing Agent        — Google Indexing API
├── Analytics Agent       — Search Console data sync
├── Revenue Agent         — Revenue tracking
├── Decay Agent           — Detect traffic decline
└── Business Brain        — Strategic recommendations

---

## CEO Agent

Coordinates all agents via the 13-step pipeline (runFullPipeline). Handles failures with retry. Scheduled 5x daily via node-cron.

---

## Research Agent

Discover topics with search volume, difficulty, intent. Save to `topics` and `research_packages` tables.

Output: research-package.json

---

## Competitor Agent

Analyze ranking competitors — find weak coverage, content gaps, SERP structures.

Output: competitor-analysis.json

---

## SERP Gap Agent

Analyze competitor content — find missing questions, sections, examples, untapped subtopics.

Output: serp-gap-report.json

---

## Planning Agent

Build article blueprint with intent, audience, outline, key entities, FAQs, word count range (2000+).

Output: article-plan.json

---

## Writer Agent

Generate article draft in Markdown. Natural, intent-driven, human-readable. Each H2 section >= 100-150 words.

Output: article.md

---

## Humanizer Agent

Reduce AI fingerprints — vary sentence structure, improve transitions, add examples, remove repetition, fix awkward phrasing.

Output: humanized-article.md

---

## Reviewer Agent

Validate content quality on grammar, readability, completeness, seoQuality, originality, readerValue.

Minimum pass: 85/100. If failed, the draft raw content is used as fallback (the review is logged but does not block publishing).

---

## SEO Agent

Generate:

* metaTitle (max 60 chars)
* metaDescription (max 160 chars)
* canonicalUrl
* openGraph: { title, description, image }
* twitterCard: { title, description }
* schemaMarkup: BlogPosting, FAQPage, etc.

Note: All OG/Twitter/canonical tags are now injected into the published article by the Blogger Agent (previously only og:image was injected).

---

## Image Agent

Plan images with SEO-friendly filenames, alt text, captions. Uses Picsum Photos (placeholders). Outputs `<figure>` with `<img loading="lazy">`.

Currently uses `https://picsum.photos` — replace with a real stock photo API for production.

---

## Internal Link Agent

Connect articles automatically — find relevant articles, generate contextual links, improve crawlability.

Output: internal-links.json

---

## Content Memory Agent

Store every article. Before creating content, search memory, detect overlap, prevent duplication.

Output: content-memory.json

---

## Topical Authority Agent

Maintain topic clusters systematically. Never create random content. Fill cluster gaps in order.

Output: topic-clusters.json

---

## Blogger Agent

Automatic Blogger publishing via Google Blogger API v3.

Features: Create, update, delete posts, apply labels, publish HTML.

Content formatting:
- Markdown → HTML conversion (headings, lists, tables, blockquotes, code blocks)
- GitHub README-style CSS
- Copy button on every code block
- Adsterra script injection at optimal positions
- SEO metadata injection (meta, OG, Twitter, canonical, JSON-LD schema)

---

## Adsterra Agent

Manage monetization. Scripts are **hardcoded from the Adsterra dashboard** (not generated from API) because the Adsterra API only returns serving keys for popunder placements, not for all formats.

Supported placements (from dashboard Get Code):
- **Popunder** — appended at end of article
- **Social Bar** — prepended at top of article
- **Native Banner** — injected before FAQ section
- **Display Banner (728x90)** — injected after first paragraph

Each placement has a unique serving ID on `pl*.effectivecpmnetwork.com` — cannot share a single publisher key across formats.

Serving IDs: SocialBar=29751140, Popunder=29751138, Native=29751139, Display key=`04e50b86336e1cbd7fd18562f36ee01c`

---

## Indexing Agent

Submit URL to Google Indexing API after publishing. Logs to `indexing_logs` table.

Note: Requires Indexing API enabled in Google Cloud Console + refresh token scoped to both `webmasters.readonly` and `indexing`.

---

## Analytics Agent

Sync Google Search Console data (clicks, impressions, CTR, position) per article per date.

Note: `getSiteUrl()` now prefers `blogspot.com` sites to avoid querying the wrong Search Console property.

---

## Revenue Agent

Track earnings — daily revenue, RPM, revenue per article. Saves to `revenues` table.

---

## Decay Agent

Detect articles with >20% month-over-month traffic decline. Queue them for content refresh.

---

## Business Brain Agent

Make strategic decisions — which niches generate revenue, which topics rank fastest, which clusters perform best.

Output: business-recommendations.json

---

## Publishing Workflow (13-Step Pipeline)

Research → Competitor Analysis → SERP Gap Analysis → Planning → Writing → Humanization → Review → SEO → Image Planning → Adsterra Injection → Blogger Publishing → Indexing

Analysis & Revenue syncs run separately.

---

## Scheduler

Full pipeline runs **5x daily** (every ~5 hours):

| Time | Activity |
|------|----------|
| 00:00 | Full pipeline |
| 05:00 | Full pipeline |
| 10:00 | Full pipeline |
| 15:00 | Full pipeline |
| 20:00 | Full pipeline |

Legacy per-step scheduling removed — only full pipeline jobs.

---

## Dashboard

A self-contained monitoring dashboard is served at `http://<host>:3000/`.

Tabs:
- **Overview** — stat cards (articles, topics, impressions, revenue), pipeline outcomes chart, recent runs
- **Articles** — table of all articles with SEO, analytics, revenue, direct links to Blogger
- **Analytics** — daily impressions/clicks chart + top articles by traffic
- **Revenue** — daily revenue chart + totals
- **Pipeline** — 50 most recent agent runs
- **Queues** — BullMQ queue status (waiting, active, completed, failed)

Data sourced from PostgreSQL via `/api/dashboard/*` endpoints.

---

## Bot Clicker

`bot-clicker.ts` — Puppeteer script to simulate human visits on published posts:
- Fetches all post links from blog homepage dynamically
- Visits each post 3 times with random UA/viewport
- Concurrent tab processing
- Stealth patches (`webdriver` spoof, `navigator` overrides)
- Bezier mouse clicks, non-linear scroll
- Color-coded per-visit logs and summary report

Run from local Windows: `npx ts-node bot-clicker.ts`

---

## Database

PostgreSQL 16 with Drizzle ORM.

Tables:
- topics
- articles
- article_versions
- research_packages
- competitor_analysis
- seo_packages
- internal_links
- topic_clusters
- cluster_topics
- indexing_logs
- analytics
- revenues
- publishing_logs
- error_logs
- agent_runs

---

## Queue System

BullMQ with Redis. 11 queues:

research, planning, writing, review, seo, publishing, indexing, analytics, revenue, learning, pipeline

---

## Docker Services

| Service | Image | Function |
|---------|-------|----------|
| app | custom (Node 20) | Express server + API + Dashboard |
| worker | custom (Node 20) | BullMQ workers |
| scheduler | custom (Node 20) | Cron scheduler (5x daily) |
| postgres | postgres:16-alpine | Database |
| redis | redis:7-alpine | Queue backend |
| grafana | grafana/grafana | Monitoring (port 3001) |
| prometheus | prom/prometheus | Metrics (port 9090) |
| nginx | nginx:alpine | Reverse proxy (port 80) |

---

## Environment Variables

```
NODE_ENV=production
PORT=3000
DATABASE_URL=
REDIS_URL=
GOOGLE_AI_API_KEY=
GOOGLE_AI_MODEL=gemma-4-26b-a4b-it
BLOGGER_BLOG_ID=
BLOGGER_CLIENT_ID=
BLOGGER_CLIENT_SECRET=
BLOGGER_REFRESH_TOKEN=
SEARCH_CONSOLE_CLIENT_ID=
SEARCH_CONSOLE_CLIENT_SECRET=
SEARCH_CONSOLE_REFRESH_TOKEN=
ADSTERRA_API_TOKEN=
LOG_LEVEL=info
```

---

## Project Structure

```
src/
├── agents/              # 20 AI agents (one folder each)
│   ├── base.ts          # BaseAgent class
│   ├── index.ts         # Agent exports
│   ├── adsterra/        # Hardcoded ad scripts
│   ├── analytics/       # Search Console sync
│   ├── blogger/         # Publishing + SEO meta + content formatting
│   ├── business-brain/  # Strategic recommendations
│   ├── ceo/             # Orchestrator
│   ├── competitor/      # Competitor analysis
│   ├── content-memory/  # Duplicate detection
│   ├── decay/           # Traffic decline detection
│   ├── humanizer/       # AI fingerprint removal
│   ├── image/           # Image planning (Picsum)
│   ├── indexing/        # Google Indexing API
│   ├── internal-link/   # Internal linking
│   ├── planner/         # Article blueprint
│   ├── research/        # Topic discovery
│   ├── revenue/         # Revenue tracking
│   ├── reviewer/        # Quality check
│   ├── seo/             # Meta + schema generation
│   ├── serp-gap/        # SERP gap analysis
│   ├── topical/         # Topic clusters
│   └── writer/          # Draft generation
├── config/              # Env + logger
├── database/            # Schema, connection, migrations
├── providers/           # Google AI + Blogger API clients
│   ├── google-ai/       # Gemma 4 client w/ retry + thought extraction
│   ├── blogger/         # Blogger API v3 client
├── public/              # Dashboard frontend (index.html)
├── routes/              # Express routes
│   └── dashboard.ts     # Dashboard API endpoints
├── services/            # Queue, Scheduler, Search Console
│   ├── queue/           # BullMQ setup
│   ├── scheduler/       # Cron (5x daily)
│   └── search-console/  # Analytics + Indexing API
├── workers/             # Worker entry + orchestrator
│   ├── index.ts         # Worker setup (11 queues)
│   └── orchestrator.ts  # Agent dispatch
├── trigger.ts           # Manual pipeline trigger
├── index.ts             # Express server + dashboard
├── test.ts              # Integration test
├── utils/               # JSON helpers, image utils
docker/
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── prometheus.yml
bot-clicker.ts           # Puppeteer visit simulator
```

---

## Success Metrics

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

The system's purpose is not to generate articles. The system's purpose is to operate an autonomous Blogger publishing business that continuously grows organic traffic and Adsterra revenue.
