import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { db } from '../../database/connection';
import { sql } from 'drizzle-orm';
import { jsonPrompt, safeParseJson } from '../../utils/json';

export class TopicalAuthorityAgent extends BaseAgent {
  constructor() {
    super('Topical-Authority');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, clusterName } = input;

    switch (action) {
      case 'create-cluster':
        return this.createCluster(clusterName as string);
      case 'suggest-coverage':
        return this.suggestCoverage(clusterName as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async createCluster(name: string): Promise<AgentOutput> {
    const existingResult = await db.execute(
      sql`SELECT id FROM topic_clusters WHERE name = ${name} LIMIT 1`
    );
    const existing = existingResult.rows as Array<{ id: number }>;

    let clusterId: number;

    if (existing.length > 0) {
      clusterId = existing[0].id;
    } else {
      const insertResult = await db.execute(
        sql`INSERT INTO topic_clusters (name, coverage_score) VALUES (${name}, 0) RETURNING id`
      );
      clusterId = (insertResult.rows as Array<{ id: number }>)[0].id;
    }

    return { success: true, data: { clusterId, name } };
  }

  private async suggestCoverage(clusterName: string): Promise<AgentOutput> {
    const prompt = jsonPrompt(`Analyze the topic cluster "${clusterName}" and suggest missing subtopics.

For each subtopic suggest:
- subtopic: string
- priority: number (1-5)
- reason: string
- exampleTitle: string

Return a JSON array sorted by priority`);

    const result = await generateContent(prompt);
    const suggestions = safeParseJson<Array<Record<string, unknown>>>(result, []);

    return { success: true, data: { clusterName, suggestions } };
  }
}
