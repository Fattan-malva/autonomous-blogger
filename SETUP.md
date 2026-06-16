# Setup Guide — Autonomous Blogger SEO Business

## 1. Copy Environment File

```bash
cp .env.example .env
```

---

## 2. Google AI Studio API Key

Digunakan oleh semua agen AI (Research, Writer, SEO, dll).

1. Buka https://aistudio.google.com/apikey
2. Login dengan Google account
3. Klik **Create API Key**
4. Pilih project atau buat baru
5. Copy key dan isi:

```
GOOGLE_AI_API_KEY=AIzaSy...
GOOGLE_AI_MODEL=gemma-4-26b-a4b-it
```

> Model default saat ini adalah **Gemma 4 26B**. Jika terjadi 500 error, retry otomatis 3x dengan delay 10s.

---

## 3. Blogger API Credentials

### 3.1. Dapatkan Blog ID

1. Login ke https://www.blogger.com
2. Buka blog kamu
3. Lihat URL: `https://www.blogger.com/blog/posts/1234567890123456789`
4. Angka terakhir adalah **Blog ID**

```
BLOGGER_BLOG_ID=1234567890123456789
```

### 3.2. Buat OAuth 2.0 Client ID

1. Buka https://console.cloud.google.com
2. Buat project baru (atau pilih existing)
3. Pergi ke **APIs & Services > Library**
4. Cari **Blogger API v3** → **Enable**
5. Pergi ke **APIs & Services > Credentials**
6. Klik **Create Credentials > OAuth client ID**
7. Pilih **Web application**
8. Authorized redirect URIs tambahkan:
   - `http://localhost:3000`
   - `https://developers.google.com/oauthplayground`
9. Simpan, copy **Client ID** dan **Client Secret**

```
BLOGGER_CLIENT_ID=xxx.apps.googleusercontent.com
BLOGGER_CLIENT_SECRET=GOCSPX-...
```

### 3.3. Dapatkan Refresh Token

Menggunakan OAuth 2.0 Playground:

1. Buka https://developers.google.com/oauthplayground
2. Klik gear icon (⚙️) → centang **Use your own OAuth credentials**
3. Masukkan Client ID dan Client Secret dari langkah sebelumnya
4. Di **Step 1**, pilih scope: `https://www.googleapis.com/auth/blogger`
5. Klik **Authorize APIs** → login dengan Google account
6. Di **Step 2**, klik **Exchange authorization code for tokens**
7. Copy **Refresh token**

```
BLOGGER_REFRESH_TOKEN=1//0g...
```

---

## 4. Google Search Console API

Digunakan oleh Analytics Agent dan Indexing Agent.

### 4.1. Enable API

1. Buka https://console.cloud.google.com
2. **APIs & Services > Library**
3. Cari dan enable:
   - **Google Search Console API**
   - **Google Indexing API**
4. **APIs & Services > Credentials**
5. Buat **OAuth client ID** (Web application)
6. Copy Client ID dan Client Secret

```
SEARCH_CONSOLE_CLIENT_ID=xxx.apps.googleusercontent.com
SEARCH_CONSOLE_CLIENT_SECRET=GOCSPX-...
```

### 4.2. Dapatkan Refresh Token (Langkah Detail)

> ⚠️ **Harus regenerate refresh token** jika sebelumnya cuma pake scope `webmasters.readonly` doang. Indexing API butuh scope tambahan `indexing`.

1. **Buka OAuth Playground**
   - Buka https://developers.google.com/oauthplayground
   - Hilangkan centang **"Auto-include basic Google scopes"** di toolbar kanan bawah

2. **Set OAuth Client credentials**
   - Klik gear icon ⚙️ di kanan atas
   - Centang **"Use your own OAuth credentials"**
   - Isi:
     - **OAuth Client ID**: `SEARCH_CONSOLE_CLIENT_ID` (dari `.env`)
     - **OAuth Client Secret**: `SEARCH_CONSOLE_CLIENT_SECRET` (dari `.env`)
   - Klik **Close**

3. **Masukkan Scopes** (paling penting!)
   - Di kolom **"Input your own scopes"**, paste persis ini (harus satu baris, pisah spasi):
     ```
     https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/indexing
     ```
   - Klik tombol **"Authorize APIs"**

4. **Login & Authorize**
   - Pilih Google account yang dipake buat Search Console
   - Klik **Allow / Continue** (mungkin muncul peringatan "unverified app" — lanjutkan)
   - Setelah authorize, URL akan berubah dan muncul **Authorization code** di panel kiri

5. **Exchange Authorization Code ke Token**
   - Klik tombol **"Exchange authorization code for tokens"** (biru, di panel kiri)
   - Tunggu sampai response muncul di panel kanan
   - Akan muncul JSON response dengan field `access_token` dan `refresh_token`

6. **Copy Refresh Token**
   - Salin nilai **refresh_token** dari response JSON (format: `1//0g...`)
   - Isi ke `.env`:
     ```
     SEARCH_CONSOLE_REFRESH_TOKEN=1//0g...
     ```

> ⚠️ **Jika masih error 401 setelah regenerate**, berarti **Google Indexing API** belum di-enable di project Google Cloud Console. Enable manual:
> 1. Buka https://console.cloud.google.com/apis/library/indexing.googleapis.com
> 2. Pilih project yang sama
> 3. Klik **Enable**
> 4. Regenerate refresh token lagi dari langkah 1

### 4.3. Verifikasi Site di Search Console

1. Buka https://search.google.com/search-console
2. Tambahkan property dengan URL blog kamu (blogspot domain)
3. Ikuti verifikasi (biasanya otomatis untuk blogspot)

---

## 5. Adsterra

1. Daftar/login ke https://publishers.adsterra.com
2. **Settings > API** → copy **API Token**
3. Isi `.env`:

```
ADSTERRA_API_TOKEN=your_adsterra_api_token
```

Catatan penting:
- Script iklan saat ini **di-hardcode dari dashboard Adsterra** (`Get Code`), bukan dari API.
- API hanya dipakai untuk monitoring, bukan untuk generate semua script iklan.
- Pastikan semua placement (Social Bar, Native Banner, Display Banner, Popunder) sudah aktif di dashboard.

---

## 6. Database & Redis (Docker)

Jika pakai Docker compose, biarkan default:

```
DATABASE_URL=postgres://blogger:blogger_password@postgres:5432/blogger_seo
REDIS_URL=redis://redis:6379
```

Jika pakai lokal:

```
DATABASE_URL=postgres://user:password@localhost:5432/blogger_seo
REDIS_URL=redis://localhost:6379
```

---

## 7. Final .env Checklist

```
NODE_ENV=production
PORT=3000

DATABASE_URL=postgres://blogger:blogger_password@postgres:5432/blogger_seo
REDIS_URL=redis://redis:6379

GOOGLE_AI_API_KEY=AIzaSy...
GOOGLE_AI_MODEL=gemma-4-26b-a4b-it

BLOGGER_BLOG_ID=1234567890123456789
BLOGGER_CLIENT_ID=xxx.apps.googleusercontent.com
BLOGGER_CLIENT_SECRET=GOCSPX-...
BLOGGER_REFRESH_TOKEN=1//0g...

SEARCH_CONSOLE_CLIENT_ID=xxx.apps.googleusercontent.com
SEARCH_CONSOLE_CLIENT_SECRET=GOCSPX-...
SEARCH_CONSOLE_REFRESH_TOKEN=1//0g...

ADSTERRA_API_TOKEN=your_adsterra_api_token

LOG_LEVEL=info
```

---

## 8. Menjalankan Project

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Setup database (pastikan PostgreSQL running)
npm run migrate

# 4. Jalankan app
npm start
```

### Docker Production

```bash
docker-compose up -d

#Jika ada Update
git pull && docker compose build --no-cache app && docker compose run --rm app node dist/database/migrate.js && docker compose up -d --force-recreate app nginx && docker rm -f autonomous-blogger-scheduler-1 autonomous-blogger-worker-1 && docker compose run -d --name autonomous-blogger-scheduler-1 app node dist/services/scheduler/run.js && docker compose run -d --name autonomous-blogger-worker-1 app node dist/workers/index.js
```

### Manual Trigger & Scheduler

```bash
npm run trigger    # Jalankan full pipeline manual (13 steps)
npm run scheduler  # Jalankan cron scheduler (5x daily)
```

---

## 9. Dashboard Monitoring

Setelah deploy, buka:

```
http://<your-vps-ip>:3000/
```

Dashboard menampilkan:
- Overview artikel dan traffic
- List artikel terbaru + SEO score
- Analytics harian (impressions/clicks)
- Revenue harian dan total
- Riwayat pipeline
- Status BullMQ queues

---

## 10. Troubleshooting

### Search Console kosong
- Pastikan blog sudah diverifikasi di Search Console
- Pastikan `getSiteUrl()` membaca site `blogspot.com`
- Data baru muncul setelah beberapa hari setelah artikel terindeks

### Adsterra API 404
- Normal jika endpoint `/domains` tidak mengembalikan data
- Script iklan tetap jalan karena di-hardcode dari dashboard

### Scheduler tidak jalan
- Pastikan `src/services/scheduler/run.ts` dipanggil, bukan `index.ts`
- Pastikan container scheduler di `docker-compose.yml` menjalankan `dist/services/scheduler/run.js`
- Pastikan cron schedule sudah 5x sehari (00:00, 05:00, 10:00, 15:00, 20:00)
