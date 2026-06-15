import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AdsterraApiService, AdsterraData, AdsterraPlacement } from '../../services/adsterra-api';

export class AdsterraAgent extends BaseAgent {
  private api: AdsterraApiService;
  private data: AdsterraData | null = null;

  constructor() {
    super('Adsterra');
    this.api = new AdsterraApiService();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, articleContent } = input;

    switch (action) {
      case 'generate-layout':
        return this.generateAdLayout(articleContent as string);
      case 'inject-ads':
        return this.injectAds(articleContent as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async ensureData(): Promise<AdsterraData | null> {
    if (this.data) return this.data;

    try {
      this.data = await this.api.fetchAdsterraData();
      logger.info(`Fetched ${this.data.placements.length} placements, key=${this.data.key}`);
      return this.data;
    } catch (err) {
      logger.warn(`Failed to fetch Adsterra data: ${(err as Error).message}`);
      return null;
    }
  }

  private hasData(): boolean {
    return !!env.ADSTERRA_API_TOKEN;
  }

  private placement(titlePart: string): AdsterraPlacement | undefined {
    if (!this.data) return undefined;
    const lower = titlePart.toLowerCase();
    return this.data.placements.find(
      p => p.title.toLowerCase().includes(lower)
    );
  }

  private async generateAdLayout(content: string): Promise<AgentOutput> {
    const h2Count = (content.match(/^## /gm) || []).length;
    const wordCount = content.split(/\s+/).length;

    if (!this.hasData()) {
      return {
        success: true,
        data: {
          layout: { socialBarScript: '', nativeBannerScript: '', displayBannerScript: '', popunderScript: '' },
          placements: {},
          note: 'ADSTERRA_API_TOKEN tidak dikonfigurasi',
        },
      };
    }

    await this.ensureData();

    const layout = {
      socialBarScript: this.socialBarScript(),
      nativeBannerScript: this.nativeBannerScript(),
      displayBannerScript: this.displayBannerScript(),
      popunderScript: this.popunderScript(),
      placements: {
        afterFirstH2: true,
        midArticle: wordCount > 1500,
        beforeFAQ: content.includes('FAQ'),
        endOfArticle: true,
      },
      h2Count,
      wordCount,
    };

    return { success: true, data: { layout } };
  }

  private async injectAds(content: string): Promise<AgentOutput> {
    if (!this.hasData()) {
      return { success: true, data: { content, note: 'ADSTERRA_API_TOKEN tidak dikonfigurasi' } };
    }

    await this.ensureData();
    const injected = this.injectAdCodes(content);
    return { success: true, data: { content: injected } };
  }

  private socialBarScript(): string {
    return '<script src="https://pl29751140.effectivecpmnetwork.com/0d/e2/bd/0de2bd7c5e002d37e7a7fff2e46a5805.js"><\/script>';
  }

  private nativeBannerScript(): string {
    return '<script async="async" data-cfasync="false" src="https://pl29751139.effectivecpmnetwork.com/889c24ddbabf6a0bef7977f62c8b54b4/invoke.js"><\/script>\n<div id="container-889c24ddbabf6a0bef7977f62c8b54b4"><\/div>';
  }

  private displayBannerScript(): string {
    return '<script>atOptions={\'key\':\'04e50b86336e1cbd7fd18562f36ee01c\',\'format\':\'iframe\',\'height\':90,\'width\':728,\'params\':{}};<\/script>\n<script src="https://www.highperformanceformat.com/04e50b86336e1cbd7fd18562f36ee01c/invoke.js"><\/script>';
  }

  private popunderScript(): string {
    return '<script src="https://pl29751138.effectivecpmnetwork.com/1e/49/c1/1e49c17ca958309ec011f24c528755f7.js"><\/script>';
  }

  private injectAdCodes(htmlContent: string): string {
    let result = htmlContent;

    const social = this.socialBarScript();
    if (social) {
      result = social + '\n' + result;
    }

    const display = this.displayBannerScript();
    if (display) {
      const firstH2 = result.indexOf('<h2>');
      if (firstH2 > 0) {
        const insertPoint = result.indexOf('</h2>', firstH2) + 5;
        result = result.slice(0, insertPoint) + '\n' + display + '\n' + result.slice(insertPoint);
      }
    }

    const native = this.nativeBannerScript();
    if (native && result.includes('<h3>')) {
      const lastH3 = result.lastIndexOf('<h3>');
      result = result.slice(0, lastH3) + native + '\n' + result.slice(lastH3);
    }

    const pop = this.popunderScript();
    if (pop) {
      result += '\n' + pop;
    }

    return result;
  }
}
