import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateWithSystemPrompt } from '../../providers/google-ai';
import { getQueue, QueueName } from '../../services/queue';
import { db } from '../../database/connection';
import { agentRuns, topics } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../config/logger';

export class CEOAgent extends BaseAgent {
  constructor() {
    super('CEO');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, topicId } = input;

    switch (action) {
      case 'discover-topics':
        return this.triggerTopicDiscovery();
      case 'orchestrate-publishing':
        return this.orchestratePublishing(topicId as number);
      case 'approve-publication':
        return this.approvePublication(topicId as number);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async triggerTopicDiscovery(): Promise<AgentOutput> {
    await getQueue(QueueName.RESEARCH).add('discover-topics', {});
    return { success: true, data: { message: 'Topic discovery queued' } };
  }

  private async orchestratePublishing(topicId: number): Promise<AgentOutput> {
    const topic = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
    if (topic.length === 0) {
      return { success: false, error: 'Topic not found' };
    }

    await getQueue(QueueName.PLANNING).add('plan-article', { topicId });
    return { success: true, data: { topicId, message: 'Publishing pipeline started' } };
  }

  private async approvePublication(topicId: number): Promise<AgentOutput> {
    const article = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
    if (article.length === 0) {
      return { success: false, error: 'Article not found' };
    }

    await getQueue(QueueName.PUBLISHING).add('publish-article', { topicId });
    return { success: true, data: { topicId, message: 'Publication approved' } };
  }
}
