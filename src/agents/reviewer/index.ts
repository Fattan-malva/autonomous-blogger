import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';

const REVIEWER_SYSTEM_PROMPT = `You are a Reviewer Agent. Validate content quality before publishing.

Check:
- Grammar and spelling
- Readability and flow
- Completeness against the outline
- SEO quality and keyword usage
- Duplicate or repetitive content
- Factual accuracy
- Value to the reader

Score each category out of 100. Minimum overall score: 85/100`;

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
    const prompt = `Review the following content for quality and completeness:

${articlePlan ? `Original plan: ${JSON.stringify(articlePlan)}` : ''}

Content to review:
${content}

Provide scores (0-100) for:
1. Grammar and spelling
2. Readability and flow
3. Completeness against intent
4. SEO quality
5. Originality
6. Reader value

Also note any issues found and whether the content passes (minimum 85/100 overall).

Return as structured JSON with: scores, issues[], overallScore, passed (boolean)`;

    const result = await generateWithSystemPrompt(REVIEWER_SYSTEM_PROMPT, prompt);
    const review = JSON.parse(result);

    return {
      success: true,
      data: review,
    };
  }
}
