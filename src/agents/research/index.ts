import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { db } from '../../database/connection';
import { topics } from '../../database/schema';
import { sql } from 'drizzle-orm';
import { jsonPrompt, safeParseJson } from '../../utils/json';

export class ResearchAgent extends BaseAgent {
  constructor() {
    super('Research');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, topic, cluster } = input;

    switch (action) {
      case 'discover-topics':
        return this.discoverTopics();
      case 'deep-research':
        return this.deepResearch(topic as string, cluster as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async discoverTopics(): Promise<AgentOutput> {
    const prompt = jsonPrompt(`Research and discover 10 profitable long-tail topics for an SEO blog.

For each topic provide:
- keyword: string
- cluster: string (topic category like "blogging", "docker", "linux", "marketing", etc.)
- searchVolume: number (1-10000)
- difficulty: number (0-1)
- intent: string ("informational" | "commercial" | "transactional" | "navigational")

Return a JSON array`);

    const result = await generateContent(prompt);
    const discovered = safeParseJson<Array<Record<string, unknown>>>(result, [])!;

    if (discovered.length === 0) {
      return { success: false, error: 'AI returned no valid topics' };
    }

    for (const item of discovered) {
      await db.execute(sql`
        INSERT INTO topics (keyword, cluster, search_volume, difficulty, intent, status)
        VALUES (${item.keyword}, ${item.cluster}, ${item.searchVolume}, ${item.difficulty}, ${item.intent}, 'discovered')
        ON CONFLICT (keyword) DO NOTHING
      `);
    }

    return { success: true, data: { discovered: discovered.length, topics: discovered } };
  }

  private async deepResearch(topic: string, cluster?: string): Promise<AgentOutput> {
    const prompt = jsonPrompt(`Perform deep research on the topic: "${topic}"${cluster ? ` in cluster: "${cluster}"` : ''}

Provide comprehensive research with these fields:
- searchIntent: string
- targetAudience: string
- keyQuestions: string[]
- competitorSummary: string
- contentOpportunities: string[]
- relatedKeywords: string[]
- entities: string[]

Return a JSON object`);

    const result = await generateContent(prompt);
    const researchData = safeParseJson(result);

    if (!researchData) {
      return { success: false, error: 'AI returned no valid research data' };
    }

    const topicResult = await db.execute(
      sql`SELECT id FROM topics WHERE keyword = ${topic} LIMIT 1`
    );
    const topicRecord = topicResult.rows as Array<{ id: number }>;

    if (topicRecord.length > 0) {
      await db.execute(sql`
        INSERT INTO research_packages (topic_id, data)
        VALUES (${topicRecord[0].id}, ${JSON.stringify(researchData)}::jsonb)
      `);
    }

    return { success: true, data: researchData };
  }
}
