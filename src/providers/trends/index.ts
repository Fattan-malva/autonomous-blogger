import axios from 'axios';
import { logger } from '../../config/logger';
import { cacheGet, cacheSet, cacheKey } from '../../services/cache';

const REDDIT_SUBREDDITS = [
  'technology', 'programming', 'webdev', 'startups', 'Entrepreneur',
  'ArtificialIntelligence', 'MachineLearning', 'SideProject', 'SaaS',
  'Productivity', 'gadgets', 'androiddev', 'selfhosted', 'devops',
];

const REQUEST_TIMEOUT = 8000;

export interface TrendItem {
  source: string;
  title: string;
  score: number;
  url: string;
  category?: string;
  mentions?: number;
}

export interface TrendSummary {
  sources: {
    reddit: TrendItem[];
    hackernews: TrendItem[];
    googleNews: TrendItem[];
  };
  trendingKeywords: string[];
  fetchedAt: string;
}

async function fetchRedditTrends(): Promise<TrendItem[]> {
  try {
    const results: TrendItem[] = [];
    const batch = REDDIT_SUBREDDITS.slice(0, 5);

    for (const sub of batch) {
      try {
        const { data } = await axios.get(
          `https://www.reddit.com/r/${sub}/hot.json?limit=15`,
          { timeout: REQUEST_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 TrendAnalyzer/1.0' } }
        );
        for (const post of data.data.children.slice(0, 10)) {
          const d = post.data;
          if (d.score > 10) {
            results.push({
              source: `reddit/r/${sub}`,
              title: d.title,
              score: d.score,
              url: `https://reddit.com${d.permalink}`,
              category: sub,
              mentions: d.num_comments || 0,
            });
          }
        }
      } catch {}
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 30);
  } catch (error) {
    logger.warn('Reddit fetch failed', { error: (error as Error).message });
    return [];
  }
}

async function fetchHackerNewsTrends(): Promise<TrendItem[]> {
  try {
    const { data: storyIds } = await axios.get<number[]>(
      'https://hacker-news.firebaseio.com/v0/topstories.json',
      { timeout: REQUEST_TIMEOUT }
    );

    const topIds = storyIds.slice(0, 30);
    const batchSize = 10;
    const results: TrendItem[] = [];

    for (let i = 0; i < topIds.length; i += batchSize) {
      const batch = topIds.slice(i, i + batchSize);
      const items = await Promise.all(
        batch.map(async (id) => {
          try {
            const { data } = await axios.get(
              `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
              { timeout: 5000 }
            );
            return data;
          } catch {
            return null;
          }
        })
      );

      for (const item of items) {
        if (item && item.title && item.score > 5) {
          results.push({
            source: 'hackernews',
            title: item.title,
            score: item.score,
            url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
            mentions: item.descendants || 0,
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 20);
  } catch (error) {
    logger.warn('HackerNews fetch failed', { error: (error as Error).message });
    return [];
  }
}

async function fetchGoogleNewsTrends(): Promise<TrendItem[]> {
  try {
    const categories = ['technology', 'business', 'science', 'startups'];
    const results: TrendItem[] = [];

    for (const cat of categories) {
      try {
        const { data } = await axios.get(
          `https://news.google.com/rss/search?q=${cat}&hl=en-US&gl=US&ceid=US:en`,
          { timeout: REQUEST_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0' } }
        );

        const titleMatches = data.match(/<title>(.+?)<\/title>/g) || [];
        const seen = new Set<string>();

        for (const match of titleMatches.slice(1, 11)) {
          const title = match.replace(/<\/?title>/g, '').trim();
          if (!seen.has(title)) {
            seen.add(title);
            results.push({
              source: 'googlenews',
              title,
              score: 50,
              url: `https://news.google.com/search?q=${encodeURIComponent(title)}`,
              category: cat,
            });
          }
        }
      } catch {}
    }

    return results.slice(0, 20);
  } catch (error) {
    logger.warn('GoogleNews fetch failed', { error: (error as Error).message });
    return [];
  }
}

export async function fetchAllTrends(forceRefresh = false): Promise<TrendSummary> {
  const cacheKeyStr = cacheKey('trends', 'summary');
  if (!forceRefresh) {
    const cached = await cacheGet<TrendSummary>(cacheKeyStr);
    if (cached) return cached;
  }

  const [reddit, hackernews, googleNews] = await Promise.all([
    fetchRedditTrends(),
    fetchHackerNewsTrends(),
    fetchGoogleNewsTrends(),
  ]);

  const allTitles = [
    ...reddit.map(t => t.title),
    ...hackernews.map(t => t.title),
    ...googleNews.map(t => t.title),
  ];

  const freq = new Map<string, number>();
  for (const t of allTitles) {
    const words = t.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    for (const w of words) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }

  const trendingKeywords = [...freq.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  const summary: TrendSummary = {
    sources: { reddit, hackernews, googleNews },
    trendingKeywords,
    fetchedAt: new Date().toISOString(),
  };

  await cacheSet(cacheKeyStr, summary, 1800);
  return summary;
}

export function formatTrendsForPrompt(summary: TrendSummary): string {
  const lines: string[] = ['### REAL-TIME TREND DATA'];

  if (summary.sources.reddit.length > 0) {
    lines.push('\n--- Reddit Hot Topics ---');
    for (const t of summary.sources.reddit.slice(0, 10)) {
      lines.push(`- [r/${t.category}] ${t.title} (${t.score} pts, ${t.mentions || 0} comments)`);
    }
  }

  if (summary.sources.hackernews.length > 0) {
    lines.push('\n--- Hacker News Top Stories ---');
    for (const t of summary.sources.hackernews.slice(0, 8)) {
      lines.push(`- ${t.title} (${t.score} pts, ${t.mentions || 0} comments)`);
    }
  }

  if (summary.sources.googleNews.length > 0) {
    lines.push('\n--- Google News Headlines ---');
    for (const t of summary.sources.googleNews.slice(0, 8)) {
      lines.push(`- ${t.title}`);
    }
  }

  if (summary.trendingKeywords.length > 0) {
    lines.push('\n--- Trending Keywords ---');
    lines.push(summary.trendingKeywords.join(', '));
  }

  return lines.join('\n');
}
