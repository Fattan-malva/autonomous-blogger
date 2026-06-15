import puppeteer, { Browser, Page } from 'puppeteer';

const BLOG_URL = 'https://fattan-dev.blogspot.com/2026/06/how-to-containerize-react-app-with.html';
const VISITS = 5;
const DELAY_BETWEEN_VISITS_MS = 8000;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function humanScroll(page: Page): Promise<void> {
  const height = await page.evaluate('document.body.scrollHeight') as number;
  const steps = rand(5, 12);
  for (let i = 0; i <= steps; i++) {
    const target = (height / steps) * i;
    await page.evaluate(`window.scrollTo(0, ${target})`);
    await sleep(rand(300, 1200));
  }
}

async function findAndClickAds(page: Page): Promise<string[]> {
  const clicked: string[] = [];

  const frames = await page.frames();
  for (const frame of frames) {
    const adLinks = await frame.evaluate(`
      Array.from(document.querySelectorAll('a'))
        .filter(a => a.href && (a.href.includes('adsterra') || a.href.includes('effectivecpmnetwork') || a.href.includes('highperformanceformat') || a.href.includes('click') || a.href.includes('zone')))
        .map(a => a.href)
    `) as string[];
    if (adLinks.length > 0) {
      clicked.push(...adLinks);
    }
  }

  const ads = await page.$$('iframe, ins, div[class*="ad"], div[id*="ad"], a[target="_blank"]');
  for (const ad of ads) {
    try {
      const box = await ad.boundingBox();
      if (box && box.width > 50 && box.height > 50) {
        const cx = box.x + box.width / 2 + rand(-20, 20);
        const cy = box.y + box.height / 2 + rand(-20, 20);
        await page.mouse.move(cx, cy, { steps: rand(5, 15) });
        await sleep(rand(100, 400));
        await page.mouse.click(cx, cy);
        clicked.push(`clicked ad at (${Math.round(cx)}, ${Math.round(cy)})`);
      }
    } catch {
      // element gone or hidden
    }
  }

  return clicked;
}

async function visit(page: Page, visitNum: number): Promise<void> {
  const agent = USER_AGENTS[visitNum % USER_AGENTS.length];
  const vp = VIEWPORTS[visitNum % VIEWPORTS.length];

  await page.setUserAgent(agent);
  await page.setViewport(vp);

  console.log(`\n--- Visit ${visitNum + 1}/${VISITS} ---`);
  console.log(`UA: ${agent.slice(0, 60)}...`);
  console.log(`Viewport: ${vp.width}x${vp.height}`);

  try {
    await page.goto(BLOG_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded');

    await sleep(rand(2000, 5000));
    await humanScroll(page);

    await sleep(rand(1000, 3000));
    const clicked = await findAndClickAds(page);

    if (clicked.length > 0) {
      console.log(`Interactions: ${clicked.length}`);
      clicked.slice(0, 5).forEach(c => console.log(`  ${c}`));
    } else {
      console.log('No ad elements found to click');
    }

    const adCount = await page.evaluate(`
      ({
        iframes: document.querySelectorAll('iframe[src*="adsterra"], iframe[src*="effectivecpmnetwork"], iframe[src*="highperformanceformat"], iframe[src*="ad"], ins.adsbygoogle').length,
        adDivs: document.querySelectorAll('div[class*="ad"], div[id*="ad"]').length,
      })
    `) as { iframes: number; adDivs: number };
    console.log(`Ad elements detected: ${adCount.iframes} iframes, ${adCount.adDivs} divs`);

    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);
  } catch (err) {
    console.error(`Visit ${visitNum + 1} failed:`, (err as Error).message);
  }
}

async function main() {
  console.log('=== Adsterra Bot Clicker Test ===');
  console.log(`Target: ${BLOG_URL}`);
  console.log(`Visits: ${VISITS}`);
  console.log('='.repeat(40));

  const browser: Browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });

  for (let i = 0; i < VISITS; i++) {
    await visit(page, i);
    if (i < VISITS - 1) {
      console.log(`Waiting ${DELAY_BETWEEN_VISITS_MS / 1000}s until next visit...`);
      await sleep(DELAY_BETWEEN_VISITS_MS);
    }
  }

  await browser.close();
  console.log('\n=== Done ===');
}

main().catch(console.error);
