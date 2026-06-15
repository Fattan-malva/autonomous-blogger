import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { jsonPrompt, safeParseJson } from '../../utils/json';

export class ReviewerAgent extends BaseAgent {
  constructor() {
    super('Reviewer');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, content, articlePlan } = input;

    switch (action) {
      case 'review':
        return this.reviewContent(content as string, articlePlan as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async reviewContent(content: string, articlePlan?: string): Promise<AgentOutput> {
    const prompt = jsonPrompt(`Review this content for quality.

${articlePlan ? `Original plan: ${JSON.stringify(articlePlan)}` : ''}

Content:
${content.substring(0, 3000)}

Score each 0-100: grammar, readability, completeness, seoQuality, originality, readerValue
Also list issues found (string[]).
Minimum pass: overallScore >= 85.

Return JSON: { scores: { grammar, readability, completeness, seoQuality, originality, readerValue }, issues: string[], overallScore: number, passed: boolean }`);

    const result = await generateContent(prompt);
    const review = safeParseJson(result, { scores: {}, issues: [], overallScore: 0, passed: false })!;

    return { success: true, data: review };
  }
}
