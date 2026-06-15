import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';
import { db } from '../../database/connection';
import { topics } from '../../database/schema';
import { sql } from 'drizzle-orm';

const RESEARCH_SYSTEM_PROMPT = `You are a Research Agent for an autonomous SEO blog. Your role is to discover profitable topics, analyze trends, and generate comprehensive research packages. Focus on:
- Long-tail keyword opportunities
- Search demand and trends
- Topic profitability potential
- User search intent
- Content gap analysis

Output structured JSON research data.`;

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
    const prompt = `${RESEARCH_SYSTEM_PROMPT}

Research and discover 10 profitable long-tail topics for an SEO blog. For each topic provide:
1. Keyword
2. Topic cluster
3. Estimated search volume (1-10000)
4. Difficulty (0-1)
5. Search intent (informational/commercial/transactional/navigational)

Return as JSON array with fields: keyword, cluster, searchVolume, difficulty, intent`;

    const result = await generateWithSystemPrompt(RESEARCH_SYSTEM_PROMPT, prompt);
    const discovered = JSON.parse(result);

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
    const prompt = `Perform deep research on the topic: "${topic}"${cluster ? ` in cluster: "${cluster}"` : ''}

Provide comprehensive research including:
1. Search intent analysis
2. Target audience
3. Key questions people ask
4. Competitor content summary
5. Content opportunities
6. Related long-tail keywords
7. Entity relationships

Return as structured JSON.`;

    const result = await generateWithSystemPrompt(RESEARCH_SYSTEM_PROMPT, prompt);
    const researchData = JSON.parse(result);

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
