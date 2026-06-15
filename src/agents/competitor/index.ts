import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';
import { db } from '../../database/connection';
import { sql } from 'drizzle-orm';

const COMPETITOR_SYSTEM_PROMPT = `You are a Competitor Analysis Agent. Analyze ranking competitors to find content gaps and opportunities.

Identify:
- Top ranking competitors
- Their content strengths and weaknesses
- Missing topics they haven't covered
- Weak coverage areas
- SERP feature opportunities`;

export class CompetitorAgent extends BaseAgent {
  constructor() {
    super('Competitor');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, topicId, keyword } = input;

    switch (action) {
      case 'analyze':
        return this.analyzeCompetitors(topicId as number, keyword as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async analyzeCompetitors(topicId: number, keyword: string): Promise<AgentOutput> {
    const prompt = `Analyze the top 10 competitors ranking for the keyword: "${keyword}"

For each competitor provide:
1. URL
2. Title
3. Estimated word count
4. Content strengths
5. Content weaknesses
6. Missing subtopics
7. SERP features they rank for

Return as JSON array.`;

    const result = await generateWithSystemPrompt(COMPETITOR_SYSTEM_PROMPT, prompt);
    const analysis = JSON.parse(result);

    await db.execute(sql`
      INSERT INTO competitor_analysis (topic_id, data)
      VALUES (${topicId}, ${JSON.stringify(analysis)}::jsonb)
    `);

    return { success: true, data: { competitors: analysis } };
  }
}
