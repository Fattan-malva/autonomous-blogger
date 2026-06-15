import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { jsonPrompt, safeParseJson } from '../../utils/json';

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
    const prompt = jsonPrompt(`Analyze content gaps in the SERP for "${keyword}".

${competitorData ? `Competitor data: ${JSON.stringify(competitorData)}` : ''}

Identify what competitors are missing:
- missingQuestions: string[]
- missingSections: string[]
- missingExamples: string[]
- missingData: string[]
- formatOpportunities: string[]
- untappedSubtopics: string[]

Return a JSON object`);

    const result = await generateContent(prompt);
    const gaps = safeParseJson(result, {});

    return { success: true, data: { gaps } };
  }
}
