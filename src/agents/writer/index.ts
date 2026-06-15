import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';

const WRITER_SYSTEM_PROMPT = `You are a Writer Agent for an SEO blog. Write high-quality, natural, human-readable content.

Rules:
- Write naturally as a human expert
- Match search intent precisely
- Provide genuine value and actionable information
- Use clear headings and structure
- Include examples and practical advice
- Never force keywords
- Never use cliches or filler
- Write in Markdown format
- Use short paragraphs and sentences
- Include real-world examples where relevant`;

export class WriterAgent extends BaseAgent {
  constructor() {
    super('Writer');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, articlePlan, researchData } = input;

    switch (action) {
      case 'write-draft':
        return this.writeDraft(articlePlan as string, researchData as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async writeDraft(articlePlan: string, researchData?: string): Promise<AgentOutput> {
    const plan = typeof articlePlan === 'string' ? JSON.parse(articlePlan) : articlePlan;

    const prompt = `Write a complete article based on this plan:

Title: ${plan.title || plan.plan?.title || 'Untitled'}
Outline: ${JSON.stringify(plan.outline || plan.plan?.outline || 'Not specified')}
Target audience: ${plan.targetAudience || plan.plan?.targetAudience || 'General'}
Key entities: ${JSON.stringify(plan.keyEntities || plan.plan?.keyEntities || [])}
FAQs to answer: ${JSON.stringify(plan.faqs || plan.plan?.faqs || [])}
${researchData ? `Research data: ${researchData}` : ''}

Write the complete article in Markdown. Include:
1. An engaging introduction
2. Well-structured H2 and H3 sections
3. Practical examples and tips
4. FAQ section at the end
5. A conclusion with key takeaways`;

    const result = await generateWithSystemPrompt(WRITER_SYSTEM_PROMPT, prompt);

    return {
      success: true,
      data: {
        content: result,
        wordCount: result.split(/\s+/).length,
      },
    };
  }
}
