import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { db } from '../../database/connection';
import { topics } from '../../database/schema';
import { sql, eq } from 'drizzle-orm';
import { jsonPrompt, safeParseJson } from '../../utils/json';
import { fetchAllTrends, formatTrendsForPrompt } from '../../providers/trends';
import { cacheGet, cacheSet, cacheKey } from '../../services/cache';

interface TopicDiscovery {
  keyword: string;
  category: string;
  trendScore: number;
  searchVolume: number;
  difficulty: number;
  monetizationScore: number;
  intent: string;
  contentType: string;
  reason: string;
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function computeSeoScore(item: TopicDiscovery): number {
  const volScore = normalize(item.searchVolume, 0, 10000) * 0.30;
  const diffScore = (1 - normalize(item.difficulty, 0, 1)) * 0.30;
  const trendScore = normalize(item.trendScore, 0, 100) * 0.20;
  const monetScore = normalize(item.monetizationScore, 0, 100) * 0.20;
  return Math.round((volScore + diffScore + trendScore + monetScore) * 100);
}

export class ResearchAgent extends BaseAgent {
  constructor() {
    super('Research');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, topic, cluster } = input;

    switch (action) {
      case 'discover-topics':
        return this.discoverTopics();

      case 'discover-trending':
        return this.discoverTrendingTopics();

      case 'deep-research':
        return this.deepResearch(topic as string, cluster as string);

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async discoverTopics(): Promise<AgentOutput> {
    const prompt = jsonPrompt(`You are an expert SEO strategist.

Discover 30 profitable blog topics.

Mix categories:
- Artificial Intelligence
- Software
- Technology
- Programming
- Business
- Entrepreneurship
- Finance
- Investing
- Productivity
- Career
- Education
- Travel
- Lifestyle
- Gaming
- Entertainment
- Home Improvement
- E-commerce
- Marketing
- Health & Fitness
- Pets

Prioritize:
1. High search demand
2. Low competition
3. Affiliate opportunities
4. Display ad revenue potential
5. Evergreen value

Return JSON array:
[
  {
    "keyword": "",
    "category": "",
    "trendScore": 0,
    "searchVolume": 0,
    "difficulty": 0,
    "monetizationScore": 0,
    "intent": "",
    "contentType": "",
    "reason": ""
  }
]

Return JSON only.`);

    const result = await generateContent(prompt);
    const discovered = safeParseJson<TopicDiscovery[]>(result, []) || [];

    if (discovered.length === 0) {
      return { success: false, error: 'AI returned no valid topics' };
    }

    let inserted = 0;
    for (const item of discovered) {
      try {
        const seoScore = computeSeoScore(item);
        await db.insert(topics).values({
          keyword: item.keyword,
          cluster: item.category,
          searchVolume: item.searchVolume || 0,
          difficulty: String(item.difficulty || 0),
          intent: item.intent || 'informational',
          trendScore: item.trendScore || 0,
          monetizationScore: item.monetizationScore || 0,
          contentType: item.contentType || 'article',
          reason: item.reason || '',
          status: 'discovered',
          lastVerifiedAt: new Date(),
        }).onConflictDoNothing({ target: topics.keyword });
        inserted++;
      } catch {}
    }

    const ranked = discovered
      .map(t => ({ ...t, seoScore: computeSeoScore(t) }))
      .sort((a, b) => b.seoScore - a.seoScore);

    return {
      success: true,
      data: {
        discovered: inserted,
        total: ranked.length,
        topics: ranked,
      },
    };
  }

  private async discoverTrendingTopics(): Promise<AgentOutput> {
    const cacheKeyStr = cacheKey('trending', 'discovered');
    const cached = await cacheGet<AgentOutput['data']>(cacheKeyStr);
    if (cached) {
      return { success: true, data: cached };
    }

    const trends = await fetchAllTrends();
    const trendDataText = formatTrendsForPrompt(trends);

    const prompt = jsonPrompt(`You are a trend analyst.

Based on this real-time trend data, identify 20 trending content opportunities:

${trendDataText}

For each trending topic return:
{
  "keyword": "",
  "category": "",
  "trendScore": 0,
  "whyTrending": "",
  "articleAngles": [],
  "estimatedInterestDuration": ""
}

Return JSON array only.`);

    const result = await generateContent(prompt);
    const trending = safeParseJson<Array<Record<string, unknown>>>(result, []) || [];

    let inserted = 0;
    for (const item of trending) {
      try {
        await db.insert(topics).values({
          keyword: item.keyword as string,
          cluster: (item.category || 'trending') as string,
          trendScore: (item.trendScore as number) || 0,
          intent: 'informational',
          status: 'trending',
          reason: (item.whyTrending as string) || '',
          lastVerifiedAt: new Date(),
        }).onConflictDoNothing({ target: topics.keyword });
        inserted++;
      } catch {}
    }

    const outputData = {
      count: trending.length,
      inserted,
      sources: {
        reddit: trends.sources.reddit.length,
        hackernews: trends.sources.hackernews.length,
        googleNews: trends.sources.googleNews.length,
      },
      trendingKeywords: trends.trendingKeywords,
      topics: trending,
    };

    await cacheSet(cacheKeyStr, outputData, 3600);

    return { success: true, data: outputData };
  }

  private async deepResearch(topic: string, cluster?: string): Promise<AgentOutput> {
    const trends = await fetchAllTrends();
    const trendContext = formatTrendsForPrompt(trends);

    const keywordTrending = trends.trendingKeywords
      .filter(kw => topic.toLowerCase().includes(kw))
      .length > 0;

    const prompt = jsonPrompt(`Perform professional SEO research.

Topic: "${topic}"
Category: "${cluster || 'General'}"
${keywordTrending ? 'NOTE: This topic is currently trending.' : ''}

Real-time trend context for reference:
${trendContext}

Return:
{
  "searchIntent": "",
  "targetAudience": "",
  "painPoints": [],
  "contentGaps": [],
  "competitorAnalysis": "",
  "relatedKeywords": [],
  "entities": [],
  "faq": [],
  "articleOutline": [],
  "internalLinkIdeas": [],
  "externalReferenceIdeas": [],
  "monetizationIdeas": [],
  "affiliateOpportunities": [],
  "youtubeIdeas": [],
  "socialMediaAngles": []
}

Return JSON only.`);

    const result = await generateContent(prompt);
    const researchData = safeParseJson(result);

    if (!researchData) {
      return { success: false, error: 'AI returned no valid research data' };
    }

    const topicResult = await db
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.keyword, topic))
      .limit(1)
      .execute();

    if (topicResult.length > 0) {
      await db.execute(
        sql`INSERT INTO research_packages (topic_id, data) VALUES (${topicResult[0].id}, ${JSON.stringify(researchData)}::jsonb)`
      );
    }

    return {
      success: true,
      data: {
        ...researchData,
        _trendContext: {
          trendingKeyword: keywordTrending,
          sources: {
            reddit: trends.sources.reddit.length,
            hackernews: trends.sources.hackernews.length,
            googleNews: trends.sources.googleNews.length,
          },
          trendingKeywords: trends.trendingKeywords,
        },
      },
    };
  }
}
