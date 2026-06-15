import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';

const SERP_GAP_SYSTEM_PROMPT = `You are a SERP Gap Analysis Agent. Find content gaps and untapped opportunities by analyzing what competitors are missing.

Look for:
- Missing questions
- Missing sections
- Missing examples and case studies
- Missing data and statistics
- Missing visual elements
- Untapped long-tail opportunities`;

export class SERPGapAgent extends BaseAgent {
  constructor() {
    super('SERP-Gap');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, keyword, competitorData } = input;

    switch (action) {
      case 'find-gaps':
        return this.findGaps(keyword as string, competitorData as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async findGaps(keyword: string, competitorData?: string): Promise<AgentOutput> {
    const prompt = `Analyze the SERP for "${keyword}" and identify content gaps.

${competitorData ? `Competitor data: ${JSON.stringify(competitorData)}` : ''}

Identify:
1. Questions that top results fail to answer
2. Sections missing from competitor content
3. Examples or case studies that would add value
4. Data points or statistics that are missing
5. Format opportunities (videos, infographics, tutorials)
6. Related subtopics not covered

Return as structured JSON.`;

    const result = await generateWithSystemPrompt(SERP_GAP_SYSTEM_PROMPT, prompt);
    const gaps = JSON.parse(result);

    return { success: true, data: { gaps } };
  }
}
