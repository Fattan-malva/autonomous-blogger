import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';
import { db } from '../../database/connection';
import { topicClusters } from '../../database/schema';
import { sql } from 'drizzle-orm';

const TOPICAL_SYSTEM_PROMPT = `You are a Topical Authority Agent. Maintain and expand topic clusters strategically.

Goal: Build comprehensive topic clusters that establish authoritative coverage.
Each cluster should have a pillar topic with supporting articles that cover every subtopic systematically.`;

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
    const prompt = `Analyze the topic cluster "${clusterName}" and suggest missing subtopics.

Current coverage: List what subtopics should exist in a comprehensive "${clusterName}" cluster.

For each subtopic suggest:
1. Subtopic name
2. Priority (1-5)
3. Why it's important for topical authority
4. Example article title

Return as JSON array sorted by priority.`;

    const result = await generateWithSystemPrompt(TOPICAL_SYSTEM_PROMPT, prompt);
    const suggestions = JSON.parse(result);

    return { success: true, data: { clusterName, suggestions } };
  }
}
