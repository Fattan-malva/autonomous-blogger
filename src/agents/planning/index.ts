import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { jsonPrompt, safeParseJson } from '../../utils/json';

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
    const prompt = jsonPrompt(`Create a detailed article blueprint for: "${keyword}"

Research: ${researchData || 'N/A'}
Competitors: ${competitorData || 'N/A'}
SERP gaps: ${serpGaps || 'N/A'}

Provide:
- intent: string (informational/commercial/transactional)
- targetAudience: string
- title: string
- outline: { heading: string, subheadings: string[] }[]
- keyEntities: string[]
- faqs: string[]
- wordCountRange: { min: number, max: number }

Return a JSON object`);

    const result = await generateContent(prompt);
    const plan = safeParseJson(result, {});

    return { success: true, data: { plan } };
  }
}
