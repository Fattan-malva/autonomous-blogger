import 'dotenv/config';
import { env } from './config/env';
import { logger } from './config/logger';

async function main() {
  console.log('\n========================================');
  console.log('  TEST MODE — Autonomous Blogger SEO');
  console.log('========================================\n');

  // 1. Cek env vars
  console.log('[1] Memeriksa Environment Variables...');
  const checks = [
    { key: 'GOOGLE_AI_API_KEY', val: env.GOOGLE_AI_API_KEY },
    { key: 'BLOGGER_BLOG_ID', val: env.BLOGGER_BLOG_ID },
    { key: 'BLOGGER_CLIENT_ID', val: env.BLOGGER_CLIENT_ID },
    { key: 'BLOGGER_CLIENT_SECRET', val: env.BLOGGER_CLIENT_SECRET },
    { key: 'BLOGGER_REFRESH_TOKEN', val: env.BLOGGER_REFRESH_TOKEN },
    { key: 'ADSTERRA_API_TOKEN', val: env.ADSTERRA_API_TOKEN },
  ];

  let allPassed = true;
  for (const c of checks) {
    const ok = !!c.val;
    console.log(`  ${ok ? '✓' : '✗'} ${c.key} = ${c.val ? c.val.substring(0, 20) + '...' : '(kosong)'}`);
    if (!ok) allPassed = false;
  }

  if (!allPassed) {
    console.log('\n  ⚠ Beberapa env vars masih kosong. Test tetap lanjut...\n');
  } else {
    console.log('  ✓ Semua env vars terisi\n');
  }

  // 2. Test Google AI
  console.log('[2] Mengecek Google AI API...');
  try {
    const { generateContent } = await import('./providers/google-ai');
    const result = await generateContent('Katakan "Halo, sistem berjalan dengan baik!" dalam 1 kalimat.');
    console.log(`  ✓ Response: ${result}`);
  } catch (err: any) {
    console.log(`  ✗ Gagal: ${err.message}`);
  }

  // 3. Test Adsterra agent (tanpa DB)
  console.log('\n[3] Mengecek Adsterra Agent...');
  try {
    const { AdsterraAgent } = await import('./agents/adsterra');
    const agent = new AdsterraAgent();
    const result = await agent.run({
      action: 'generate-layout',
      articleContent: '# Test Article\n\n## Introduction\n\nSome content here.\n\n## Main Section\n\nMore content.\n\n## FAQ\n\nQ&A here.',
    });
    const hasScripts = result.data?.layout
      ? Object.values((result.data.layout as Record<string, string>)).some(v => typeof v === 'string' && v.includes('script'))
      : false;
    console.log(`  ✓ Layout generated: ${result.success}`);
    console.log(`  ${hasScripts ? '✓' : '✗'} Ad scripts ${hasScripts ? 'tergenerate' : 'kosong (ADSTERRA_API_TOKEN tidak diisi)'}`);
  } catch (err: any) {
    console.log(`  ✗ Gagal: ${err.message}`);
  }

  // 4. Test agents (mock, tanpa DB)
  console.log('\n[4] Mengecek Agents (mock mode)...');
  const agentTests = [
    { name: 'Research', file: './agents/research', action: 'discover-topics' },
    { name: 'Planning', file: './agents/planning', action: 'create-plan' },
    { name: 'Writer', file: './agents/writer', action: 'write-draft' },
    { name: 'Reviewer', file: './agents/reviewer', action: 'review' },
    { name: 'SEO', file: './agents/seo', action: 'generate-seo' },
  ];

  for (const test of agentTests) {
    try {
      const mod = await import(test.file);
      const AgentClass = Object.values(mod)[0] as any;
      const agent = new AgentClass();
      if (agent.execute) {
        console.log(`  ✓ ${test.name} agent: class loaded`);
      }
    } catch (err: any) {
      console.log(`  ✗ ${test.name} agent: ${err.message}`);
    }
  }

  // 5. Test Express server
  console.log('\n[5] Menjalankan Express server (port 3000)...');
  try {
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;
    const helmet = (await import('helmet')).default;

    const app = express();
    app.use(helmet());
    app.use(cors());
    app.use(express.json());

    app.get('/health', (_req: any, res: any) => {
      res.json({ status: 'ok', mode: 'test', timestamp: new Date().toISOString() });
    });

    app.get('/env-check', (_req: any, res: any) => {
      res.json({
        googleAI: !!env.GOOGLE_AI_API_KEY,
        blogger: !!env.BLOGGER_BLOG_ID && !!env.BLOGGER_REFRESH_TOKEN,
        adsterra: !!env.ADSTERRA_API_TOKEN,
        searchConsole: !!env.SEARCH_CONSOLE_REFRESH_TOKEN,
      });
    });

    return new Promise<void>((resolve) => {
      const server = app.listen(3000, () => {
        console.log('  ✓ Server running di http://localhost:3000');
        console.log('  ✓ Health check: http://localhost:3000/health');
        console.log('  ✓ Env check:    http://localhost:3000/env-check');
        console.log('\n========================================');
        console.log('  TEST SELESAI — Tekan Ctrl+C untuk berhenti');
        console.log('========================================\n');
      });
      server.on('error', (err: any) => {
        console.log(`  ✗ Server gagal: ${err.message}`);
        resolve();
      });
    });
  } catch (err: any) {
    console.log(`  ✗ Gagal: ${err.message}`);
  }
}

main().catch((err) => {
  console.error('Test gagal:', err);
  process.exit(1);
});
