import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';

const PLANNING_SYSTEM_PROMPT = `You are a Planning Agent. Create detailed article blueprints based on research data.

Determine:
- Primary search intent
- Target audience
- Content structure and outline
- Key entities to include
- FAQ questions to answer
- Content flow and narrative
- Related internal linking opportunities`;

export class PlanningAgent extends BaseAgent {
  constructor() {
    super('Planning');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, keyword, researchData, competitorData, serpGaps } = input;

    switch (action) {
      case 'create-plan':
        return this.createArticlePlan(
          keyword as string,
          researchData as string,
          competitorData as string,
          serpGaps as string
        );
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async createArticlePlan(
    keyword: string,
    researchData?: string,
    competitorData?: string,
    serpGaps?: string
  ): Promise<AgentOutput> {
    const prompt = `Create a detailed article blueprint for the keyword: "${keyword}"

Research data: ${researchData || 'Not provided'}
Competitor data: ${competitorData || 'Not provided'}
SERP gaps: ${serpGaps || 'Not provided'}

Provide:
1. Exact search intent (informational/commercial/transactional)
2. Target audience description
3. Working title
4. Detailed outline with H2 and H3 sections
5. Key entities and concepts to explain
6. FAQ questions (5-10)
7. Content flow narrative
8. Suggested word count range
9. Key takeaways for reader

Return as structured JSON.`;

    const result = await generateWithSystemPrompt(PLANNING_SYSTEM_PROMPT, prompt);
    const plan = JSON.parse(result);

    return { success: true, data: { plan } };
  }
}
