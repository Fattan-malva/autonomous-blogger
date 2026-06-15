# Autonomous Blogger SEO Business

Sistem penerbitan blog otomatis yang menemukan topik, menulis artikel, mengoptimasi SEO, dan menerbitkan ke Blogger — dengan monetisasi Adsterra.

## Arsitektur

```
CEO Agent (Orchestrator)
├── Research Agent       — Menemukan topik profitable
├── Competitor Agent     — Analisis kompetitor
├── SERP Gap Agent       — Celah konten di SERP
├── Planning Agent       — Blueprint artikel
├── Writer Agent         — Menulis konten (AI)
├── Humanizer Agent      — Humanisasi tulisan AI
├── Reviewer Agent       — Validasi kualitas (min 85)
├── SEO Agent            — Meta, schema, OG tags
├── Image Agent          — Perencanaan gambar
├── Internal Link Agent  — Internal linking otomatis
├── Content Memory Agent — Cegah duplikasi
├── Topical Authority    — Topic clusters
├── Blogger Agent        — Publisher ke Blogger API
├── Adsterra Agent       — Inject script iklan
├── Indexing Agent       — Google Indexing API
├── Analytics Agent      — Sync Search Console
├── Revenue Agent        — Tracking pendapatan
├── Decay Agent          — Deteksi artikel menurun
└── Business Brain       — Rekomendasi strategis
```

## Flow Penerbitan

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
| AI | Google AI Studio (Gemma 3 31B) |
| Database | PostgreSQL 16 (via Drizzle ORM) |
| Queue | BullMQ + Redis |
| Scheduler | node-cron |
| API | Express, Google Blogger API v3, Google Search Console |
| Monitoring | Grafana + Prometheus |
| Deployment | Docker Compose |

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
#    - GOOGLE_AI_API_KEY
#    - BLOGGER_* credentials
#    - ADSTERRA_API_TOKEN

# 3. Test dulu (tanpa database)
npm run test

# 4. Build
npm run build

# 5. Deploy dengan Docker
docker-compose up -d
```

## Environment Variables

| Variable | Required | Deskripsi |
|----------|----------|-----------|
| `GOOGLE_AI_API_KEY` | ✓ | Google AI Studio API key |
| `BLOGGER_BLOG_ID` | ✓ | ID blog Blogger |
| `BLOGGER_CLIENT_ID` | ✓ | OAuth Client ID |
| `BLOGGER_CLIENT_SECRET` | ✓ | OAuth Client Secret |
| `BLOGGER_REFRESH_TOKEN` | ✓ | OAuth Refresh Token |
| `ADSTERRA_API_TOKEN` | ✓ | Token dari Settings > API |
| `SEARCH_CONSOLE_*` | | Untuk analytics & indexing |
| `DATABASE_URL` | ✓ | PostgreSQL connection |
| `REDIS_URL` | ✓ | Redis connection |

Panduan lengkap dapatkan semua credential: [SETUP.md](./SETUP.md)

## Docker Services

```bash
docker-compose up -d    # Start semua service
docker-compose logs -f  # Lihat log
docker-compose down     # Stop semua service
```

| Service | Port | Fungsi |
|---------|------|--------|
| app | 3000 | Express server + API |
| worker | - | Process queue jobs |
| scheduler | - | Cron scheduler harian |
| postgres | 5432 | Database |
| redis | 6379 | Queue backend |
| grafana | 3001 | Monitoring dashboard |
| prometheus | 9090 | Metrics collection |
| nginx | 80 | Reverse proxy |

## Monitoring

- **Health check:** `http://localhost:3000/health`
- **Queue metrics:** `http://localhost:3000/metrics`
- **Grafana:** `http://localhost:3001` (admin/admin)
- **Adsterra Dashboard:** https://publishers.adsterra.com
- **Google Search Console:** https://search.google.com/search-console

## Scheduler (Daily)

| Waktu UTC | Aktivitas |
|-----------|-----------|
| 00:00 | Topic Discovery |
| 01:00 | Deep Research |
| 02:00 | Competitor Analysis |
| 03:00 | Article Planning |
| 04:00 | Content Writing |
| 05:00 | Humanization |
| 06:00 | Quality Review |
| 07:00 | SEO Optimization |
| 08:00 | Image Planning |
| 09:00 | **Publish ke Blogger** |
| 10:00 | Submit Indexing |
| 11:00 | Sync Analytics |
| 12:00 | Sync Revenue |
| Every 2h | Performance Analysis |

## Scripts

```bash
npm run dev        # Development server
npm run build      # Compile TypeScript
npm start          # Production server
npm run worker     # Jalankan workers
npm run scheduler  # Jalankan scheduler
npm run test       # Test mode (tanpa DB)
npm run migrate    # Migrasi database
```

## Struktur Project

```
src/
├── agents/          # 20 agen AI
├── providers/       # Google AI & Blogger API
├── services/        # Queue, Scheduler, Search Console, Storage
├── database/        # Schema, koneksi, migrasi
├── workers/         # Worker processes & orchestrator
├── config/          # Env & logger
└── index.ts         # Entry point

docker/
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── prometheus.yml
```

## Lisensi

MIT
