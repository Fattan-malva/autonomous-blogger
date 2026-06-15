import puppeteer, { Browser, Page } from 'puppeteer';

const BLOG_HOME = 'https://fattan-dev.blogspot.com';
const VISITS_PER_POST = 3;
const MAX_POSTS = 0; // 0 = all posts
const CONCURRENT = 2;
const MIN_READ_MS = 4000;
const MAX_READ_MS = 12000;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
];

const VIEWPORTS = [
  { w: 1920, h: 1080 }, { w: 1366, h: 768 },
  { w: 1440, h: 900 }, { w: 1536, h: 864 },
  { w: 390, h: 844 }, { w: 414, h: 896 },
  { w: 768, h: 1024 }, { w: 834, h: 1194 },
];

const AD_SELECTORS = [
  'iframe[src*="effectivecpmnetwork"]',
  'iframe[src*="highperformanceformat"]',
  'iframe[src*="adsterra"]',
  'iframe[src*="ad"]',
  'div[id*="container-"][id*="ad"]',
  'div[id*="adsterra"]',
  'ins.adsbygoogle',
  'a[target="_blank"]',
];

type VisitResult = {
  url: string;
  visit: number;
  adsClicked: number;
  adLinksFound: number;
  iframes: number;
  adDivs: number;
  durationMs: number;
  error?: string;
};

type PostResult = {
  url: string;
  visits: VisitResult[];
  totalClicks: number;
  avgIframes: number;
  avgDivs: number;
};

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function applyStealth(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    (navigator as any).languages = ['en-US', 'en'];
    (navigator as any).deviceMemory = 8;
    (navigator as any).hardwareConcurrency = [4, 6, 8, 12][Math.floor(Math.random() * 4)];
    const originalQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions);
    if (originalQuery) {
      (window.navigator.permissions as any).query = (p: PermissionDescriptor) =>
        p.name === 'notifications' ? Promise.resolve({ state: 'denied' } as PermissionStatus) : originalQuery(p);
    }
  });
}

function bezierMouse(page: Page, x: number, y: number): Promise<void> {
  return page.evaluate(([tx, ty]) => {
    const event = new MouseEvent('mousemove', { clientX: tx, clientY: ty, bubbles: true });
    document.dispatchEvent(event);
  }, [x, y]);
}

async function humanScroll(page: Page): Promise<void> {
  const height = await page.evaluate('document.body.scrollHeight') as number;
  if (!height || height < 500) return;
  const steps = rand(6, 15);
  let prev = 0;
  for (let i = 0; i <= steps; i++) {
    const progress = (i / steps);
    const eased = 1 - Math.pow(1 - progress, 2.5);
    const target = Math.round(eased * height);
    const delta = Math.abs(target - prev);
    await page.evaluate(`window.scrollTo(0, ${target})`);
    prev = target;
    const pause = rand(200, Math.min(800, delta));
    await sleep(pause);
  }
}

async function getPostUrls(page: Page): Promise<string[]> {
  await page.goto(BLOG_HOME, { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(2000);

  await humanScroll(page);
  await sleep(1000);

  const urls = await page.evaluate(`Array.from(new Set(Array.from(document.querySelectorAll('a[href*="/2026/"]')).map(a=>a.href).filter(h=>h&&h.includes('.html'))))`) as string[];

  await page.goto(BLOG_HOME + '/p/privacy-policy.html', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  return urls;
}

async function findAdLinks(page: Page): Promise<number> {
  return page.evaluate(`Array.from(document.querySelectorAll('a')).filter(a=>a.href&&(a.href.includes('effectivecpmnetwork')||a.href.includes('highperformanceformat')||a.href.includes('adsterra')||a.href.includes('ad')||a.href.includes('click'))).length`) as Promise<number>;
}

async function clickAds(page: Page): Promise<number> {
  let clicked = 0;

  for (const sel of AD_SELECTORS) {
    try {
      const els = await page.$$(sel);
      for (const el of els) {
        try {
          const box = await el.boundingBox();
          if (!box || box.width < 30 || box.height < 30) continue;

          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          const ox = rand(-15, 15);
          const oy = rand(-15, 15);

          await sleep(rand(200, 800));
          await bezierMouse(page, cx + ox, cy + oy);
          await sleep(rand(100, 300));
          await el.click();
          clicked++;
        } catch {}
      }
    } catch {}
  }

  return clicked;
}

async function visit(page: Page, url: string, visitNum: number): Promise<VisitResult> {
  const start = Date.now();
  const ua = USER_AGENTS[visitNum % USER_AGENTS.length];
  const vp = VIEWPORTS[visitNum % VIEWPORTS.length];

  await page.setUserAgent(ua);
  await page.setViewport({ width: vp.w, height: vp.h });

  const result: VisitResult = {
    url, visit: visitNum + 1,
    adsClicked: 0, adLinksFound: 0, iframes: 0, adDivs: 0, durationMs: 0,
  };

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 35000 });
    await sleep(rand(1500, 3000));

    const adLinksFound = await findAdLinks(page);
    result.adLinksFound = adLinksFound;

    await humanScroll(page);

    const readTime = rand(MIN_READ_MS, MAX_READ_MS);
    await sleep(readTime);

    const adsClicked = await clickAds(page);
    result.adsClicked = adsClicked;

    await sleep(rand(1000, 2500));

    const stats = await page.evaluate(`({iframes:document.querySelectorAll('iframe[src*="effectivecpmnetwork"],iframe[src*="highperformanceformat"],iframe[src*="ad"],ins.adsbygoogle').length,adDivs:document.querySelectorAll('div[id*="container"],div[id*="adsterra"],div[class*="ad"]').length})`) as {iframes: number; adDivs: number};
    result.iframes = stats.iframes;
    result.adDivs = stats.adDivs;
  } catch (err) {
    result.error = (err as Error).message.slice(0, 120);
  }

  result.durationMs = Date.now() - start;
  return result;
}

async function processPost(browser: Browser, url: string, index: number, total: number): Promise<PostResult> {
  const post: PostResult = { url, visits: [], totalClicks: 0, avgIframes: 0, avgDivs: 0 };

  console.log(`\n\x1b[36m[${index}/${total}]\x1b[0m ${url.replace(BLOG_HOME, '')}`);

  for (let v = 0; v < VISITS_PER_POST; v++) {
    const page = await browser.newPage();
    await applyStealth(page);
    const r = await visit(page, url, v);
    await page.close();

    post.visits.push(r);
    post.totalClicks += r.adsClicked;

    const icon = r.error ? '\x1b[31m✗\x1b[0m' : '\x1b[32m✓\x1b[0m';
    console.log(`  ${icon} Visit ${v + 1} | ${r.durationMs}ms | clicks:${r.adsClicked} links:${r.adLinksFound} ifr:${r.iframes} divs:${r.adDivs}${r.error ? ' ERR:' + r.error : ''}`);

    if (v < VISITS_PER_POST - 1) await sleep(rand(4000, 8000));
  }

  post.avgIframes = Math.round(post.visits.reduce((s, r) => s + r.iframes, 0) / post.visits.length);
  post.avgDivs = Math.round(post.visits.reduce((s, r) => s + r.adDivs, 0) / post.visits.length);

  return post;
}

async function main() {
  console.log('\x1b[1m=== Adsterra Bot Clicker ===\x1b[0m');
  console.log(`  Target     : ${BLOG_HOME}`);
  console.log(`  Visits/post: ${VISITS_PER_POST}`);
  console.log(`  Concurrent : ${CONCURRENT}`);
  console.log(`  User agents: ${USER_AGENTS.length}`);
  console.log('='.repeat(50));

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });

  const tempPage = await browser.newPage();
  const allUrls = await getPostUrls(tempPage);
  await tempPage.close();

  const urls = allUrls.slice(0, MAX_POSTS || allUrls.length);
  console.log(`\n  Found ${allUrls.length} posts, processing ${urls.length}`);

  const results: PostResult[] = [];
  for (let i = 0; i < urls.length; i += CONCURRENT) {
    const batch = urls.slice(i, i + CONCURRENT);
    const batchResults = await Promise.all(batch.map((url, j) => processPost(browser, url, i + j + 1, urls.length)));
    results.push(...batchResults);
  }

  await browser.close();

  const totalVisits = results.reduce((s, p) => s + p.visits.length, 0);
  const totalClicks = results.reduce((s, p) => s + p.totalClicks, 0);
  const totalAdLinks = results.reduce((s, p) => s + p.visits.reduce((s2, r) => s2 + r.adLinksFound, 0), 0);
  const totalErrors = results.reduce((s, p) => s + p.visits.filter(r => r.error).length, 0);
  const totalTimeMs = results.reduce((s, p) => s + p.visits.reduce((s2, r) => s2 + r.durationMs, 0), 0);

  console.log('\n' + '='.repeat(50));
  console.log('\x1b[1mSUMMARY\x1b[0m');
  console.log(`  Posts visited : ${results.length}`);
  console.log(`  Total visits  : ${totalVisits}`);
  console.log(`  Total clicks  : ${totalClicks}`);
  console.log(`  Ad links found: ${totalAdLinks}`);
  console.log(`  Errors        : ${totalErrors}`);
  console.log(`  Avg duration  : ${Math.round(totalTimeMs / totalVisits)}ms`);
  console.log(`  Timestamp     : ${new Date().toISOString()}`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('\x1b[31mFATAL\x1b[0m', err.message);
  process.exit(1);
});
