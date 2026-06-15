# Autonomous Blogger SEO Business

Sistem penerbitan blog otomatis yang menemukan topik, menulis artikel, mengoptimasi SEO, dan menerbitkan ke Blogger — dengan monetisasi Adsterra.

## Arsitektur

```
CEO Agent (Orchestrator)
├── Research Agent       — Menemukan topik profitable
├── Competitor Agent     — Analisis kompetitor
├── SERP Gap Agent       — Celah konten di SERP
├── Planning Agent       — Blueprint artikel
├── Writer Agent         — Menulis konten (Gemma 4)
├── Humanizer Agent      — Humanisasi tulisan AI
├── Reviewer Agent       — Validasi kualitas (min 85)
├── SEO Agent            — Meta, schema, OG tags, Canonical
├── Image Agent          — Perencanaan gambar (Picsum)
├── Internal Link Agent  — Internal linking otomatis
├── Content Memory Agent — Cegah duplikasi
├── Topical Authority    — Topic clusters
├── Blogger Agent        — Publisher ke Blogger API + GitHub-style Formatting
├── Adsterra Agent       — Inject script iklan (Dashboard hardcoded)
├── Indexing Agent       — Google Indexing API
├── Analytics Agent      — Sync Search Console
├── Revenue Agent        — Tracking pendapatan
├── Decay Agent          — Deteksi artikel menurun
└── Business Brain       — Rekomendasi strategis
```

## Flow Penerbitan (13-Step Pipeline)

```
Research → Competitor Analysis → SERP Gap → Planning
→ Writing → Humanization → Review → SEO → Images
→ Internal Links → Blogger Publish → Adsterra Injection
→ Indexing → Analytics → Revenue → Learning
```

## Technology Stack

| Komponen | Teknologi |
|----------|-----------|
| Runtime | Node.js 20 + TypeScript |
| AI | Google AI Studio (Gemma 4 26B) |
| Database | PostgreSQL 16 (via Drizzle ORM) |
| Queue | BullMQ + Redis |
| Scheduler | node-cron (5x Daily) |
| API | Express, Google Blogger API v3, Google Search Console |
| Monitoring | Custom Dashboard (Port 3000), Grafana, Prometheus |
| Deployment | Docker Compose |

## Dashboard Monitoring

Akses dashboard terpadu untuk memonitor semua aktivitas bisnis:
**URL:** `http://<your-vps-ip>:3000/`

**Fitur Dashboard:**
- **Overview:** Total articles, topics, impressions, revenue, and pipeline status.
- **Articles:** List all published posts with SEO scores and analytics.
- **Analytics:** Daily traffic charts (impressions/clicks) and top performing articles.
- **Revenue:** Daily earnings chart and total revenue summary.
- **Pipeline:** Real-time log of recent agent runs.
- **Queues:** Monitoring of BullMQ queue health.

## Persyaratan

- Node.js 20+
- Docker & Docker Compose (untuk production)
- Akun Google AI Studio (API key)
- Blog di Blogger
- Google Search Console (site terverifikasi)
- Akun Adsterra

## Quick Start

```bash
# 1. Clone & install
git clone <repo>
cd autonomous-blogger-seo-business
cp .env.example .env
npm install

# 2. Isi .env (lihat SETUP.md untuk panduan lengkap)
# 3. Build
npm run build

# 4. Deploy dengan Docker
docker-compose up -d
```

## Environment Variables

| Variable | Required | Deskripsi |
|----------|----------|-----------|
| `GOOGLE_AI_API_KEY` | ✓ | Google AI Studio API key |
| `BLOGGER_*` | ✓ | Credentials for Blogger API v3 |
| `ADSTERRA_API_TOKEN` | ✓ | Token dari Settings > API |
| `SEARCH_CONSOLE_*` | ✓ | For analytics & indexing |
| `DATABASE_URL` | ✓ | PostgreSQL connection |
| `REDIS_URL` | ✓ | Redis connection |

Panduan lengkap dapatkan semua credential: [SETUP.md](./SETUP.md)

## Docker Services

| Service | Port | Fungsi |
|---------|------|--------|
| app | 3000 | Express server + Dashboard + API |
| worker | - | Process queue jobs |
| scheduler | - | Cron scheduler (5x daily) |
| postgres | 5432 | Database |
| redis | 6379 | Queue backend |
| grafana | 3001 | Monitoring dashboard |
| prometheus | 9090 | Metrics collection |
| nginx | 80 | Reverse proxy |

## Scheduler (5x Daily Full Pipeline)

Pipeline dijalankan otomatis 5x sehari untuk memastikan pertumbuhan konten yang konsisten:
- **Jadwal:** 00:00, 05:00, 10:00, 15:00, 20:00 UTC.

## Scripts

```bash
npm run build      # Compile TypeScript
npm run trigger    # Manual trigger full pipeline (13 steps)
npm run scheduler  # Jalankan scheduler (cron)
npm run worker     # Jalankan workers (queue handler)
npm run migrate    # Migrasi database
```

## Struktur Project

```
src/
├── agents/          # 20 agen AI
├── providers/       # Google AI & Blogger API
├── services/        # Queue, Scheduler, Search Console
├── database/        # Schema, koneksi, migrasi
├── workers/         # Worker processes & orchestrator
├── routes/          # Dashboard API endpoints
├── public/          # Dashboard frontend (index.html)
├── config/          # Env & logger
└── index.ts         # Express server (Port 3000)
```

## Lisensi

MIT
