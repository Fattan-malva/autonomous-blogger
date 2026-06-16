import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { getBotConfig, BotConfig } from './bot-config';
import { getTodayLog, updateTodayLog, endTodayLog, getClickStats } from './click-log';
import { logger } from '../config/logger';

puppeteer.use(StealthPlugin());

const BLOG_URL = process.env.BLOG_URL || 'https://fattan-dev.blogspot.com';
const SITEMAP_URL = `${BLOG_URL}/sitemap.xml`;

const AD_SELECTORS = [
  'iframe[src*="effectivecpmnetwork"]',
  'iframe[src*="highperformanceformat"]',
  'iframe[src*="adsterra"]',
  'div[id*="container-"]',
  'ins.adsbygoogle',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
];

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
];

type BotStatus = {
  running: boolean;
  currentVisitor: number;
  totalVisitors: number;
  startedAt: string | null;
  adClicksToday: number;
};

let botRunning = false;
let botStopRequested = false;
let currentVisitor = 0;
let botStartedAt: string | null = null;
let browserInstance: Browser | null = null;

function rand(min: number, max: number): number {
  if (min > max) { const t = min; min = max; max = t; }
  if (max === min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomViewport(): { width: number; height: number } {
  return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

async function humanScroll(page: Page, minSteps?: number): Promise<void> {
  try {
    const height = await page.evaluate('document.body.scrollHeight') as number;
    if (!height || height < 500) return;
    const steps = minSteps ? rand(minSteps, minSteps + 6) : rand(4, 10);

    if (Math.random() < 0.3) {
      // Random scroll pattern: scroll to middle, pause, then continue
      const midY = Math.round(height * (0.2 + Math.random() * 0.4));
      await page.evaluate(`window.scrollTo(0, ${midY})`);
      await sleep(rand(2000, 8000));
    }

    for (let i = 0; i <= steps; i++) {
      const pct = i / steps;
      const eased = 1 - Math.pow(1 - pct, 2);
      const y = Math.round(eased * height);
      await page.evaluate(`window.scrollTo(0, ${y})`);
      await sleep(rand(100, 800));
    }

    // Sometimes scroll back up a bit
    if (Math.random() < 0.25) {
      const scrollUp = Math.round(height * (0.1 + Math.random() * 0.3));
      await page.evaluate(`window.scrollTo(0, ${height - scrollUp})`);
      await sleep(rand(1000, 4000));
      // Then scroll down again
      await page.evaluate(`window.scrollTo(0, ${height})`);
    }
  } catch {}
}

async function fetchPostUrls(): Promise<string[]> {
  try {
    const resp = await fetch(SITEMAP_URL);
    const xml = await resp.text();
    const urls: string[] = [];
    const regex = /<loc>(https:\/\/fattan-dev\.blogspot\.com\/\d{4}\/\d{2}\/[^<]+\.html)<\/loc>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      urls.push(match[1]);
    }
    return urls;
  } catch (err) {
    logger.error('Failed to fetch sitemap', { error: (err as Error).message });
    return [];
  }
}

async function findAds(page: Page): Promise<{ el: any; selector: string }[]> {
  const found: { el: any; selector: string }[] = [];
  for (const sel of AD_SELECTORS) {
    try {
      const els = await page.$$(sel);
      for (const el of els) {
        try {
          const box = await el.boundingBox();
          if (box && box.width >= 30 && box.height >= 30) {
            found.push({ el, selector: sel });
          }
        } catch {}
      }
    } catch {}
  }
  return found;
}

async function clickAd(page: Page, ad: { el: any; selector: string }): Promise<boolean> {
  try {
    const box = await ad.el.boundingBox();
    if (!box) return false;
    const cx = box.x + box.width * (0.3 + Math.random() * 0.4);
    const cy = box.y + box.height * (0.3 + Math.random() * 0.4);
    await page.mouse.move(cx, cy, { steps: rand(5, 15) });
    await sleep(rand(200, 800));
    await page.mouse.click(cx, cy);
    await sleep(rand(1000, 3000));
    return true;
  } catch {
    return false;
  }
}

async function clickInternalLink(page: Page): Promise<boolean> {
  try {
    const links = await page.$$('a[href*="fattan-dev.blogspot.com"][href*=".html"]');
    if (links.length === 0) return false;
    const link = links[Math.floor(Math.random() * links.length)];
    const box = await link.boundingBox();
    if (!box) return false;
    const cx = box.x + box.width / 2 + rand(-5, 5);
    const cy = box.y + box.height / 2 + rand(-5, 5);
    await page.mouse.move(cx, cy, { steps: rand(5, 12) });
    await sleep(rand(200, 600));
    await link.click().catch(() => {});
    await sleep(rand(2000, 5000));
    return true;
  } catch {
    return false;
  }
}

async function visitPost(browser: Browser, url: string, config: BotConfig): Promise<{ adClicks: number; internalClicks: number; error: boolean }> {
  const page = await browser.newPage();
  const viewport = randomViewport();
  await page.setViewport(viewport);
  await page.setUserAgent(randomUA());

  let adClicks = 0;
  let internalClicks = 0;
  let hasError = false;

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });

    // Extra anti-detection: override webdriver after page load
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Wait for ad elements to render (max 8 seconds)
    try {
      await page.waitForSelector(
        'iframe[src*="effectivecpmnetwork"], iframe[src*="highperformanceformat"], div[id*="container-"]',
        { timeout: 8000 }
      );
    } catch {}

    await sleep(rand(2000, 5000));

    // Initial scroll
    await humanScroll(page);
    await sleep(rand(config.readTimeMin, config.readTimeMax));

    // Find all ads
    const ads = await findAds(page);
    const maxClicks = rand(config.clicksPerVisitorMin, config.clicksPerVisitorMax);
    const visitedInternal: string[] = [];

    if (ads.length > 0) {
      logger.debug(`Visitor ${currentVisitor}: found ${ads.length} ad elements: ${ads.map(a => a.selector).join(', ')}`);
    } else {
      logger.debug(`Visitor ${currentVisitor}: no ad elements found`);
    }

    // Decide if this visitor should click ads (only ~30% of visitors click ads)
    const shouldClickAds = ads.length > 0 && Math.random() < 0.3;

    for (let i = 0; i < maxClicks; i++) {
      if (botStopRequested) break;

      const action = pickWeighted(
        ['ad', 'internal', 'scroll'],
        [
          shouldClickAds ? config.adClickChance : 0,
          config.internalLinkChance,
          1 - (shouldClickAds ? config.adClickChance : 0) - config.internalLinkChance
        ]
      );

      if (action === 'ad' && ads.length > 0) {
        const ad = ads[Math.floor(Math.random() * ads.length)];
        if (await clickAd(page, ad)) {
          adClicks++;
          // After clicking an ad, sometimes wait longer or scroll more
          if (Math.random() < 0.4) {
            await sleep(rand(3000, 10000));
            await humanScroll(page);
          }
          // Max 2 ad clicks per visitor
          if (adClicks >= 2) break;
        }
      } else if (action === 'internal' && visitedInternal.length < 2) {
        if (await clickInternalLink(page)) {
          internalClicks++;
          visitedInternal.push(url);
          await sleep(rand(config.readTimeMin / 3, config.readTimeMax / 2));
          await humanScroll(page);
        }
      } else {
        // Scroll action — no click, just scroll with variable timing
        if (Math.random() < 0.3) {
          await sleep(rand(3000, 15000));
        }
        await humanScroll(page);
        await sleep(rand(2000, 12000));
      }

      await sleep(rand(config.betweenClicksMin, config.betweenClicksMax));
    }

    await page.close();
  } catch (err) {
    hasError = true;
    try { await page.close(); } catch {}
  }

  return { adClicks, internalClicks, error: hasError };
}

// Exported for API control
export function getBotStatus(): BotStatus {
  const today = getTodayLog();
  return {
    running: botRunning,
    currentVisitor,
    totalVisitors: getBotConfig().totalVisitors,
    startedAt: botStartedAt,
    adClicksToday: today?.adClicks || 0,
  };
}

export async function startBot(): Promise<void> {
  if (botRunning) return;
  botRunning = true;
  botStopRequested = false;
  botStartedAt = new Date().toISOString();
  currentVisitor = 0;

  const config = getBotConfig();
  logger.info('Bot starting', { visitors: config.totalVisitors });

  // Initialize today's log
  updateTodayLog({ sessions: 0, adClicks: 0, internalClicks: 0, scrolls: 0, errors: 0, startTime: botStartedAt });

  try {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const urls = await fetchPostUrls();
    if (urls.length === 0) {
      logger.error('Bot: no post URLs found from sitemap');
      await stopBot();
      return;
    }
    logger.info(`Bot: found ${urls.length} posts`);

    for (let i = 0; i < config.totalVisitors && !botStopRequested; i++) {
      currentVisitor = i + 1;
      const url = urls[Math.floor(Math.random() * urls.length)];

      logger.info(`Bot visitor ${currentVisitor}/${config.totalVisitors}: ${url}`);
      const result = await visitPost(browserInstance, url, config);

      updateTodayLog({
        sessions: (getTodayLog()?.sessions || 0) + 1,
        adClicks: (getTodayLog()?.adClicks || 0) + result.adClicks,
        internalClicks: (getTodayLog()?.internalClicks || 0) + result.internalClicks,
        errors: (getTodayLog()?.errors || 0) + (result.error ? 1 : 0),
      });

      if (result.adClicks > 0) {
        logger.info(`Bot visitor ${currentVisitor}: +${result.adClicks} ad clicks`);
      } else {
        logger.debug(`Visitor ${currentVisitor}: 0 ad clicks`);
      }

      // Delay between visitors
      if (i < config.totalVisitors - 1 && !botStopRequested) {
        const delay = rand(config.visitorDelayMin, config.visitorDelayMax);
        logger.info(`Bot: waiting ${Math.round(delay / 1000)}s before next visitor`);
        await sleep(delay);
      }
    }
  } catch (err) {
    logger.error('Bot error', { error: (err as Error).message });
  } finally {
    if (browserInstance) {
      try { await browserInstance.close(); } catch {}
      browserInstance = null;
    }
    endTodayLog();
    botRunning = false;
    logger.info('Bot stopped');
  }
}

export async function stopBot(): Promise<void> {
  botStopRequested = true;
  if (browserInstance) {
    try {
      const pages = await browserInstance.pages();
      for (const page of pages) {
        try { await page.close(); } catch {}
      }
    } catch {}
    try { await browserInstance.close(); } catch {}
    browserInstance = null;
  }
  endTodayLog();
  botRunning = false;
  logger.info('Bot stop requested');
}

export { getClickStats };

// CLI mode
if (require.main === module) {
  (async () => {
    console.log('\n=== Adsterra Bot Clicker ===');
    console.log(`  Blog: ${BLOG_URL}`);
    console.log(`  Visitors: ${getBotConfig().totalVisitors}\n`);

    await startBot();

    const stats = getClickStats(1);
    console.log('\n=== SUMMARY ===');
    console.log(`  Visitors    : ${currentVisitor}`);
    console.log(`  Ad clicks   : ${stats.totalAdClicks}`);
    console.log(`  Int. clicks : ${stats.totalInternalClicks}`);
    console.log(`  Errors      : ${stats.totalErrors}`);
    console.log(`  Timestamp   : ${new Date().toISOString()}\n`);
    process.exit(0);
  })().catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}
