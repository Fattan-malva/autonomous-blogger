import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { generateContent } from '../../providers/google-ai';
import { jsonPrompt, safeParseJson } from '../../utils/json';
import { ImagePlan, imageToHtml, fetchUnsplashImages } from '../../utils/images';
import { hasApiKey as hasUnsplashKey } from '../../providers/unsplash';
import { logger } from '../../config/logger';

export class ImageAgent extends BaseAgent {
  constructor() {
    super('Image');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, content, title, sections } = input;

    switch (action) {
      case 'plan-images':
        return this.planImages(content as string, title as string, sections as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async planImages(content: string, title: string, sections?: string): Promise<AgentOutput> {
    const unsplashAvailable = hasUnsplashKey();

    const prompt = jsonPrompt(`Plan images for this article. For each image, provide a specific search query that will find the best stock photo on Unsplash.

Title: "${title}"
${sections ? `Sections: ${sections}` : ''}
Content preview: ${content.substring(0, 3000)}

For each image provide:
- purpose: string (featured = main hero image, in-article = section illustration, infographic = data visualization concept)
- description: string (detailed description of what the image should depict)
- altText: string (SEO-friendly alt text)
- caption: string (human-readable caption for the image)
- filename: string (SEO-friendly filename, e.g. "what-is-docker-container.webp")
- placement: string (featured = before title, after-introduction = after intro section, or end)
- searchQuery: string (${unsplashAvailable ? 'CRITICAL: 3-5 word search query optimized for Unsplash stock photos. Be specific and use common stock photography terms. Examples: "Docker containers server room", "Linux terminal code screen", "web developer coding laptop". Do NOT use abstract or metaphorical descriptions.' : 'description of the ideal image'})

IMPORTANT for searchQuery:
- Use real-world photography terms (e.g. "laptop computer code" not "developer working on complex systems")
- Be specific but not too narrow (e.g. "server room blue light" not "modern data center with blue LED lighting on multiple server racks in cloud computing facility")
- Each image should have a DIFFERENT searchQuery

Return a JSON array of 3-5 images`);

    const result = await generateContent(prompt);
    const plans: ImagePlan[] = safeParseJson(result, []) || [];

    if (plans.length === 0) {
      return { success: true, data: { images: [] } };
    }

    let imageUrls = new Map<string, string>();

    if (unsplashAvailable) {
      logger.info(`Fetching ${plans.length} images from Unsplash...`);
      imageUrls = await fetchUnsplashImages(plans, title);
      logger.info(`Fetched ${imageUrls.size} images from Unsplash`);
    }

    const images = plans.map((plan) => {
      const url = imageUrls.get(plan.filename);
      const imageWithUrl: ImagePlan = {
        ...plan,
        imageUrl: url,
      };
      return {
        ...imageWithUrl,
        html: imageToHtml(imageWithUrl),
      };
    });

    return { success: true, data: { images } };
  }
}
