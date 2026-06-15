import { Router, Request, Response } from 'express';
import { readdirSync, readFileSync, existsSync, statSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { exec } from 'child_process';
import { getStatus, setStatus, getAllStatuses, removeStatus, getSchedulerConfig, updateSchedulerConfig } from '../services/content-store';
import { restartContentScheduler } from '../services/scheduler-service';
import { submitUrlForIndexing } from '../services/search-console';
import { startGenerationJob, completeGenerationJob, getRecentJobs, getGenerationStats } from '../services/generation-tracker';

const router = Router();
const RESULT_DIR = resolve(__dirname, '../../result');

function parseContentSlug(filename: string): string {
  return filename.replace(/\.html$/, '');
}

function getWordCount(html: string): number {
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return text.split(/\s+/).length;
}

function extractTitle(html: string, filename: string): string {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].replace(/\s*—\s*Fattan Dev\s*$/, '');
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1];
  return filename.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// List all content files with status
router.get('/files', (_req: Request, res: Response) => {
  try {
    if (!existsSync(RESULT_DIR)) {
      return res.json([]);
    }
    const files = readdirSync(RESULT_DIR).filter(f => f.endsWith('.html'));
    const statuses = getAllStatuses();

    const contents = files.map(filename => {
      const slug = parseContentSlug(filename);
      const filepath = join(RESULT_DIR, filename);
      const stat = statSync(filepath);
      const html = readFileSync(filepath, 'utf-8');
      const status = statuses[slug] || { posted: false };
      return {
        slug,
        filename,
        title: extractTitle(html, filename),
        words: getWordCount(html),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        status: status.posted ? 'posted' : 'draft',
        postedAt: status.postedAt || null,
        bloggerUrl: status.bloggerUrl || null,
        indexed: status.indexed || false,
        indexedAt: status.indexedAt || null,
        indexError: status.indexError || null,
      };
    });

    // Sort: drafts first, then by modified date desc
    contents.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'draft' ? -1 : 1;
      return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
    });

    res.json(contents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single file content
router.get('/files/:slug', (req: Request, res: Response) => {
  try {
    const slug = req.params.slug.replace(/\.\.\//g, '');
    const filepath = join(RESULT_DIR, `${slug}.html`);
    if (!existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const html = readFileSync(filepath, 'utf-8');
    res.json({ slug, html, title: extractTitle(html, slug) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update status (mark as posted / unpost)
router.post('/files/:slug/status', (req: Request, res: Response) => {
  try {
    const slug = req.params.slug.replace(/\.\.\//g, '');
    const { posted, bloggerUrl } = req.body;
    const status = setStatus(slug, {
      posted: !!posted,
      postedAt: posted ? new Date().toISOString() : undefined,
      bloggerUrl: bloggerUrl || undefined,
    });
    res.json({ slug, status: status.posted ? 'posted' : 'draft' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger content generation
const activeGeneration: { jobId: string; res: Response }[] = [];
router.post('/generate', (req: Request, res: Response) => {
  if (activeGeneration.length > 0) {
    return res.status(429).json({ error: 'Already generating' });
  }
  const jobId = startGenerationJob('manual');
  const isProd = process.env.NODE_ENV === 'production';
  const cmd = isProd
    ? 'node dist/generate-content.js'
    : (process.platform === 'win32' ? 'npx.cmd ts-node src/generate-content.ts' : 'npx ts-node src/generate-content.ts');
  const child = exec(cmd, { cwd: resolve(__dirname, '../..'), timeout: 300000 }, (error, stdout, stderr) => {
    const output = stdout + '\n' + stderr;
    completeGenerationJob(jobId, output, !error);
    const idx = activeGeneration.findIndex(a => a.jobId === jobId);
    if (idx !== -1) activeGeneration.splice(idx, 1);
    if (error) {
      return res.json({ success: false, output });
    }
    res.json({ success: true, output });
  });
  activeGeneration.push({ jobId, res });
});

// Get generation status
router.get('/generate/status', (_req: Request, res: Response) => {
  res.json({ generating: activeGeneration.length > 0 });
});

// Delete content file + status
router.delete('/files/:slug', (req: Request, res: Response) => {
  try {
    const slug = req.params.slug.replace(/\.\.\//g, '');
    const filepath = join(RESULT_DIR, `${slug}.html`);
    if (existsSync(filepath)) unlinkSync(filepath);
    removeStatus(slug);
    res.json({ success: true, slug });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit URL to Google Indexing API
router.post('/files/:slug/index', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug.replace(/\.\.\//g, '');
    const status = getStatus(slug);
    const bloggerUrl = req.body.bloggerUrl || status.bloggerUrl;

    if (!bloggerUrl) {
      return res.status(400).json({ error: 'No bloggerUrl provided. Mark as posted first.' });
    }

    const success = await submitUrlForIndexing(bloggerUrl);

    if (success) {
      setStatus(slug, { indexed: true, indexedAt: new Date().toISOString(), indexError: undefined });
      res.json({ success: true, slug, indexed: true });
    } else {
      setStatus(slug, { indexed: false, indexError: 'Indexing API returned failure' });
      res.status(502).json({ success: false, slug, error: 'Indexing API returned failure. Cek log app untuk detail.' });
    }
  } catch (error: any) {
    const msg = error.message || 'Unknown error';
    setStatus(req.params.slug, { indexed: false, indexError: msg });
    res.status(502).json({ success: false, error: msg });
  }
});

// Scheduler config
router.get('/scheduler', (_req: Request, res: Response) => {
  res.json(getSchedulerConfig());
});

router.post('/scheduler', (req: Request, res: Response) => {
  const { enabled, perDay, intervalMinutes } = req.body;
  const config = updateSchedulerConfig({
    enabled: typeof enabled === 'boolean' ? enabled : undefined,
    perDay: typeof perDay === 'number' ? perDay : undefined,
    intervalMinutes: typeof intervalMinutes === 'number' ? intervalMinutes : undefined,
  });
  restartContentScheduler();
  res.json(config);
});

// Generation jobs & stats
router.get('/jobs', (_req: Request, res: Response) => {
  res.json({
    jobs: getRecentJobs(100),
    stats: getGenerationStats(),
  });
});

export default router;
