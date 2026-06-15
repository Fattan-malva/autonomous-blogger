import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export class AdsterraAgent extends BaseAgent {
  constructor() {
    super('Adsterra');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, articleContent, articleId } = input;

    switch (action) {
      case 'generate-layout':
        return this.generateAdLayout(articleContent as string);
      case 'inject-ads':
        return this.injectAds(articleContent as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private get token(): string {
    return env.ADSTERRA_API_TOKEN;
  }

  private hasToken(): boolean {
    return !!this.token;
  }

  private async generateAdLayout(content: string): Promise<AgentOutput> {
    const h2Count = (content.match(/^## /gm) || []).length;
    const wordCount = content.split(/\s+/).length;

    if (!this.hasToken()) {
      return {
        success: true,
        data: {
          layout: { socialBarScript: '', nativeBannerScript: '', displayBannerScript: '', popunderScript: '' },
          placements: {},
          note: 'ADSTERRA_API_TOKEN tidak dikonfigurasi',
        },
      };
    }

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
    if (!this.hasToken()) {
      return { success: true, data: { content, note: 'ADSTERRA_API_TOKEN tidak dikonfigurasi' } };
    }
    const injected = this.injectAdCodes(content);
    return { success: true, data: { content: injected } };
  }

  private socialBarScript(): string {
    return `<script type="text/javascript">(function(){var s=document.createElement("script");s.src="//pl${this.token}.adsterra.com/${this.token}/social/bar.js";s.async=true;document.head.appendChild(s)})();</script>`;
  }

  private nativeBannerScript(): string {
    return `<script type="text/javascript">atOptions={key:"${this.token}",format:"iframe",height:250,width:300,params:{}};document.write('<scr'+'ipt type="text/javascript" src="//www.highperformanceformat.com/${this.token}/invoke.js"></scr'+'ipt>');</script>`;
  }

  private displayBannerScript(): string {
    return `<script type="text/javascript">atOptions={key:"${this.token}",format:"iframe",height:90,width:728,params:{}};document.write('<scr'+'ipt type="text/javascript" src="//www.highperformanceformat.com/${this.token}/invoke.js"></scr'+'ipt>');</script>`;
  }

  private popunderScript(): string {
    return `<script type="text/javascript">var popunder=document.createElement("script");popunder.src="//pl${this.token}.adsterra.com/popup/universal.js";popunder.async=true;document.head.appendChild(popunder);</script>`;
  }

  private injectAdCodes(htmlContent: string): string {
    let result = htmlContent;

    result = this.socialBarScript() + '\n' + result;

    const firstH2 = result.indexOf('<h2>');
    if (firstH2 > 0) {
      const insertPoint = result.indexOf('</h2>', firstH2) + 5;
      result = result.slice(0, insertPoint) + '\n' + this.displayBannerScript() + '\n' + result.slice(insertPoint);
    }

    if (result.includes('<h3>')) {
      const lastH3 = result.lastIndexOf('<h3>');
      result = result.slice(0, lastH3) + this.nativeBannerScript() + '\n' + result.slice(lastH3);
    }

    result += '\n' + this.popunderScript();

    return result;
  }
}
