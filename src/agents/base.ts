import { logger } from '../config/logger';

export interface AgentInput {
  [key: string]: unknown;
}

export interface AgentOutput {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export abstract class BaseAgent {
  public name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract execute(input: AgentInput): Promise<AgentOutput>;

  public async run(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    await this.logStart(input);

    try {
      const output = await this.execute(input);
      output.success = true;
      await this.logSuccess(output);
      return output;
    } catch (error) {
      const err = error as Error;
      const failedOutput: AgentOutput = {
        success: false,
        error: err.message,
      };
      await this.logError(err);
      return failedOutput;
    } finally {
      const duration = Date.now() - startTime;
      logger.debug(`Agent ${this.name} took ${duration}ms`);
    }
  }

  protected async logStart(input: AgentInput): Promise<void> {
    logger.info(`Agent ${this.name} started`, { input });
  }

  protected async logSuccess(output: AgentOutput): Promise<void> {
    logger.info(`Agent ${this.name} completed successfully`, { output });
  }

  protected async logError(error: Error): Promise<void> {
    logger.error(`Agent ${this.name} failed`, {
      error: error.message,
      stack: error.stack,
    });
  }
}
