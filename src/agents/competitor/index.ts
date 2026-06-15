import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { db } from '../../database/connection';
import { sql } from 'drizzle-orm';
import { jsonPrompt, safeParseJson } from '../../utils/json';

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
    const prompt = jsonPrompt(`Analyze the top 10 competitors ranking for the keyword: "${keyword}"

For each competitor provide:
- url: string
- title: string
- estimatedWordCount: number
- contentStrengths: string[]
- contentWeaknesses: string[]
- missingSubtopics: string[]
- serpFeatures: string[]

Return a JSON array`);

    const result = await generateContent(prompt);
    const analysis = safeParseJson<Array<Record<string, unknown>>>(result, []);

    await db.execute(sql`
      INSERT INTO competitor_analysis (topic_id, data)
      VALUES (${topicId}, ${JSON.stringify(analysis)}::jsonb)
    `);

    return { success: true, data: { competitors: analysis } };
  }
}
