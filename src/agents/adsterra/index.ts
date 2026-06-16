import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { logger } from '../../config/logger';
import {
    adsterraConfig,
    adPackages,
    getAdScript,
    getAdPackage,
    listAdTypes,
    listAdPackages,
    resolvePlacements,
    type AdDecision,
    type AdPlacement,
    type AdType,
} from '../../config/addstera';

export class AdsterraAgent extends BaseAgent {

    constructor() {
        super('Adsterra');
    }

    async execute(input: AgentInput): Promise<AgentOutput> {
        const { action, articleContent, title } = input;

        switch (action) {
            case 'generate-layout':
                return this.generateAdLayout(articleContent as string, title as string);
            case 'inject-ads':
                return this.injectAds(articleContent as string, input);
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    }

    private async generateAdLayout(content: string, title?: string): Promise<AgentOutput> {
        try {
            const decision = await this.decideAdLayout(content, title);
            const placements = resolvePlacements(decision);

            const layout: Record<string, string> = {};
            for (const p of placements) {
                layout[p.type] = getAdScript(p.type);
            }

            return {
                success: true,
                data: {
                    layout,
                    placements,
                    packageName: decision.packageName,
                    reason: decision.reason,
                },
            };
        } catch (err) {
            logger.warn(`AI ad decision failed, using default: ${(err as Error).message}`);
            const defaultPkg = getAdPackage('standard')!;
            const placements = defaultPkg.placements;
            const layout: Record<string, string> = {};
            for (const p of placements) {
                layout[p.type] = getAdScript(p.type);
            }
            return {
                success: true,
                data: {
                    layout,
                    placements,
                    packageName: 'standard',
                    reason: 'fallback: AI decision failed',
                },
            };
        }
    }

    private async decideAdLayout(content: string, title?: string): Promise<AdDecision> {
        const wordCount = content.split(/\s+/).length;
        const h2Count = (content.match(/^## /gm) || []).length;
        const h3Count = (content.match(/^### /gm) || []).length;
        const hasFAQ = /FAQ|Frequently Asked/i.test(content);
        const hasCodeBlocks = /```[\s\S]*?```/.test(content);
        const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 50);

        const articleInfo = {
            title: title || 'untitled',
            wordCount,
            h2Count,
            h3Count,
            hasFAQ,
            hasCodeBlocks,
            paragraphCount: paragraphs.length,
        };

        const prompt = `You are an ad placement strategist for a blog. Analyze this article and decide the best ad package and placements.

ARTICLE INFO:
${JSON.stringify(articleInfo, null, 2)}

AVAILABLE AD PACKAGES:
${listAdPackages().join('\n')}

AVAILABLE AD TYPES:
${listAdTypes().join(', ')}

RULES:
- Choose ONE package name from: ${adPackages.map(p => `"${p.name}"`).join(', ')}
- If none of the packages fit perfectly, you can provide customPlacements instead
- Ad placements must feel natural — never break mid-sentence or mid-list
- For long articles (2000+ words), prefer "heavy" package
- For short articles (<800 words), prefer "light" package
- If the article has FAQ section, always include native banner before it
- Always include popunder at the end
- For technical content with code blocks, prefer fewer in-content banners

Return a JSON object:
{
  "packageName": "light|standard|heavy|mobile|sidebar",
  "customPlacements": null,
  "reason": "brief explanation of why this package was chosen"
}

If using custom placements instead of a package:
{
  "packageName": "custom",
  "customPlacements": [
    { "type": "adType", "position": "top|after_first_h2|after_paragraph|before_faq|end", "paragraphIndex": 3 }
  ],
  "reason": "..."
}

IMPORTANT: Return ONLY the JSON object. No markdown, no explanation.`;

        const response = await generateContent(prompt);

        let decision: AdDecision;
        try {
            const cleaned = response
                .replace(/```(?:json)?\n?/gi, '')
                .replace(/\n```/g, '')
                .replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, (_, json) => json)
                .trim();
            decision = JSON.parse(cleaned);
        } catch {
            throw new Error('Failed to parse AI ad decision');
        }

        if (!decision.packageName || !decision.reason) {
            throw new Error('AI returned incomplete ad decision');
        }

        logger.info('AI ad decision', {
            package: decision.packageName,
            reason: decision.reason,
        });

        return decision;
    }

    private async injectAds(content: string, input: AgentInput): Promise<AgentOutput> {
        const placements = input.placements as AdPlacement[] | undefined;
        const layout = input.layout as Record<string, string> | undefined;

        if (!placements || placements.length === 0) {
            return { success: true, data: { content } };
        }

        let result = content;

        for (const p of placements) {
            const script = layout?.[p.type] || getAdScript(p.type);
            if (!script) continue;

            result = this.injectAtPosition(result, script, p);
        }

        return { success: true, data: { content: result } };
    }

    private injectAtPosition(html: string, script: string, placement: AdPlacement): string {
        switch (placement.position) {
            case 'top':
                return script + '\n' + html;

            case 'after_first_h2': {
                const firstH2 = html.indexOf('<h2>');
                if (firstH2 > 0) {
                    const afterH2 = html.indexOf('</h2>', firstH2) + 5;
                    return html.slice(0, afterH2) + '\n' + script + '\n' + html.slice(afterH2);
                }
                return html + '\n' + script;
            }

            case 'after_paragraph': {
                const paraIdx = placement.paragraphIndex ?? 3;
                const blocks = html.split(/\n\n+/);
                const insertAt = Math.min(paraIdx + 1, blocks.length);
                blocks.splice(insertAt, 0, script);
                return blocks.join('\n\n');
            }

            case 'before_faq': {
                let faqIdx = html.lastIndexOf('<h3>FAQ');
                if (faqIdx < 0) faqIdx = html.lastIndexOf('<h2>FAQ');
                if (faqIdx < 0) faqIdx = html.lastIndexOf('<h2>Frequently Asked');
                if (faqIdx > 0) {
                    return html.slice(0, faqIdx) + '\n' + script + '\n' + html.slice(faqIdx);
                }
                return html + '\n' + script;
            }

            case 'end':
                return html + '\n' + script;

            default:
                return html;
        }
    }
}
