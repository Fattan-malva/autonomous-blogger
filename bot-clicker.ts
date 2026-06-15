import puppeteer, { Browser, Page } from 'puppeteer';

const BLOG_ID = '5022540736336372097';
const PREVIEW_BASE = `https://www.blogger.com/preview/${BLOG_ID}`;
const VISITS_PER_POST = 3;
const MAX_POSTS = 0;
const CONCURRENT = 1;

const MIN_READ_MS = 4000;
const MAX_READ_MS = 10000;

const AD_SELECTORS = [
  'iframe[src*="effectivecpmnetwork"]',
  'iframe[src*="highperformanceformat"]',
  'iframe[src*="adsterra"]',
  'div[id*="container-"]',
  'ins.adsbygoogle',
];

type VisitResult = {
  url: string;
  adsFound: number;
  adsClicked: number;
  durationMs: number;
  error?: string;
};

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function humanScroll(page: Page): Promise<void> {
  const height = await page.evaluate('document.body.scrollHeight') as number;
  if (!height || height < 500) return;
  const steps = rand(4, 10);
  for (let i = 0; i <= steps; i++) {
    const pct = i / steps;
    const eased = 1 - Math.pow(1 - pct, 2);
    const y = Math.round(eased * height);
    await page.evaluate(`window.scrollTo(0, ${y})`);
    await sleep(rand(150, 600));
  }
}

async function getPreviewUrls(page: Page): Promise<string[]> {
  // Go to preview homepage
  await page.goto(PREVIEW_BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(3000);

  // Scroll to trigger lazy loading
  await humanScroll(page);
  await sleep(1500);

  // Extract post links (preview URLs contain the full blog path)
  const urls = await page.evaluate(`Array.from(new Set(Array.from(document.querySelectorAll('a[href*="/202"]')).map(a=>a.href).filter(h=>h&&h.includes('.html'))))`) as string[];
  return urls;
}

async function clickAds(page: Page): Promise<{ found: number; clicked: number }> {
  let found = 0;
  let clicked = 0;

  for (const sel of AD_SELECTORS) {
    try {
      const els = await page.$$(sel);
      for (const el of els) {
        found++;
        try {
          const box = await el.boundingBox();
          if (!box || box.width < 30 || box.height < 30) continue;
          const cx = box.x + box.width / 2 + rand(-10, 10);
          const cy = box.y + box.height / 2 + rand(-10, 10);
          await page.mouse.move(cx, cy, { steps: rand(5, 12) });
          await sleep(rand(200, 600));
          await el.click().catch(() => {});
          clicked++;
          await sleep(rand(500, 1500));
        } catch {}
      }
    } catch {}
  }

  return { found, clicked };
}

async function visitPreviewPost(browser: Browser, url: string): Promise<VisitResult> {
  const start = Date.now();
  const page = await browser.newPage();

  const result: VisitResult = {
    url, adsFound: 0, adsClicked: 0, durationMs: 0,
  };

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 35000 });
    await sleep(rand(2000, 4000));

    await humanScroll(page);

    const readTime = rand(MIN_READ_MS, MAX_READ_MS);
    await sleep(readTime);

    const ads = await clickAds(page);
    result.adsFound = ads.found;
    result.adsClicked = ads.clicked;

    await sleep(rand(1000, 2000));
  } catch (err) {
    result.error = (err as Error).message.slice(0, 120);
  }

  result.durationMs = Date.now() - start;
  await page.close();
  return result;
}

async function main() {
  console.log('\n\x1b[1m=== Adsterra Preview Clicker ===\x1b[0m');
  console.log(`  Preview URL : ${PREVIEW_BASE}`);
  console.log(`  Visits/post : ${VISITS_PER_POST}`);
  console.log('='.repeat(50));
  console.log('  NOTE: Pastikan Chrome sudah login ke Blogger');
  console.log('        (pakai --user-data-dir dengan profile yg sudah login)\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 900 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  // Get preview post URLs
  const navPage = await browser.newPage();
  const urls = await getPreviewUrls(navPage);
  await navPage.close();

  const postUrls = urls.slice(0, MAX_POSTS || urls.length);
  console.log(`  Found ${urls.length} posts, visiting ${postUrls.length}\n`);

  let totalVisits = 0;
  let totalClicks = 0;
  let totalFound = 0;

  for (let i = 0; i < postUrls.length; i++) {
    const url = postUrls[i];
    console.log(`\x1b[36m[${i + 1}/${postUrls.length}]\x1b[0m ${url.replace(PREVIEW_BASE, '')}`);

    for (let v = 0; v < VISITS_PER_POST; v++) {
      const r = await visitPreviewPost(browser, url);
      totalVisits++;
      totalClicks += r.adsClicked;
      totalFound += r.adsFound;

      const icon = r.error ? '\x1b[31m✗\x1b[0m' : '\x1b[32m✓\x1b[0m';
      console.log(`  ${icon} Visit ${v + 1} | ${r.durationMs}ms | found:${r.adsFound} clicked:${r.adsClicked}${r.error ? ' ERR:' + r.error : ''}`);

      if (v < VISITS_PER_POST - 1) await sleep(rand(3000, 6000));
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(50));
  console.log('\x1b[1mSUMMARY\x1b[0m');
  console.log(`  Posts       : ${postUrls.length}`);
  console.log(`  Visits      : ${totalVisits}`);
  console.log(`  Ads found   : ${totalFound}`);
  console.log(`  Ads clicked : ${totalClicks}`);
  console.log(`  Timestamp   : ${new Date().toISOString()}`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('\x1b[31mFATAL\x1b[0m', err.message);
  process.exit(1);
});
