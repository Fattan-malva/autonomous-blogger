import { BaseAgent, AgentInput, AgentOutput } from '../base';
import { createPost, updatePost, deletePost, BloggerPost } from '../../providers/blogger';
import { db } from '../../database/connection';
import { articles } from '../../database/schema';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { logger } from '../../config/logger';

export class BloggerAgent extends BaseAgent {
  constructor() {
    super('Blogger');
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { action, articleId, content, title, labels, seoData, adsterraLayout } = input;

    switch (action) {
      case 'publish':
        return this.publishToBlogger(
          articleId as number | undefined,
          content as string,
          title as string,
          labels as string[],
          seoData as Record<string, unknown>,
          adsterraLayout as string
        );
      case 'update':
        return this.updateBloggerPost(
          articleId as number,
          content as string,
          title as string,
          labels as string[]
        );
      case 'delete':
        return this.deleteBloggerPost(articleId as number);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async publishToBlogger(
    articleId: number | undefined,
    content: string,
    title: string,
    labels?: string[],
    seoData?: Record<string, unknown>,
    adsterraLayout?: string
  ): Promise<AgentOutput> {
    let htmlContent = this.markdownToHtml(content);
    const keyword = (labels || [])[0] || '';

    if (adsterraLayout) {
      htmlContent = this.injectAdsterra(htmlContent, adsterraLayout);
    }

    const seo = seoData as Record<string, unknown> | undefined;
    const finalTitle = seo?.metaTitle as string || title;

    htmlContent = this.injectSEOMetadata(htmlContent, seo, title, keyword);

    const bloggerPost: BloggerPost = {
      title: finalTitle,
      content: htmlContent,
      labels: labels || [],
    };

    const result = await createPost(bloggerPost);

    if (articleId) {
      await db.execute(sql`
        UPDATE articles
        SET blogger_post_id = ${result.id}, blogger_url = ${result.url}, status = 'published', published_at = NOW()
        WHERE id = ${articleId}
      `);

      await db.execute(sql`
        INSERT INTO publishing_logs (article_id, action, status, response)
        VALUES (${articleId}, 'publish', 'success', ${JSON.stringify(result)}::jsonb)
      `);
    }

    logger.info('Article published to Blogger', { articleId: articleId || null, postId: result.id });

    return {
      success: true,
      data: {
        postId: result.id,
        url: result.url,
        status: 'published',
      },
    };
  }

  private async updateBloggerPost(
    articleId: number,
    content: string,
    title: string,
    labels?: string[]
  ): Promise<AgentOutput> {
    const article = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);

    if (article.length === 0 || !article[0].bloggerPostId) {
      return { success: false, error: 'Article not found or not published' };
    }

    const htmlContent = this.markdownToHtml(content);

    await updatePost(article[0].bloggerPostId, {
      title,
      content: htmlContent,
      labels,
    });

    await db.execute(sql`
      INSERT INTO publishing_logs (article_id, action, status)
      VALUES (${articleId}, 'update', 'success')
    `);

    return { success: true, data: { postId: article[0].bloggerPostId } };
  }

  private async deleteBloggerPost(articleId: number): Promise<AgentOutput> {
    const article = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);

    if (article.length === 0 || !article[0].bloggerPostId) {
      return { success: false, error: 'Article not found or not published' };
    }

    await deletePost(article[0].bloggerPostId);

    await db.execute(sql`
      UPDATE articles SET status = 'deleted', blogger_post_id = NULL, blogger_url = NULL WHERE id = ${articleId}
    `);

    return { success: true, data: { message: 'Post deleted' } };
  }

  private markdownToHtml(markdown: string): string {
    let html = markdown;

    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" />');
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<li><\/li>/g, '');

    return html;
  }

  private injectSEOMetadata(html: string, seo: Record<string, unknown> | undefined, title: string, keyword: string): string {
    const metaDescription = seo?.metaDescription as string || '';
    const schemaMarkup = seo?.schemaMarkup as Record<string, unknown> | undefined;

    let head = '';

    if (metaDescription) {
      head += `\n<meta name="description" content="${this.escapeHtml(metaDescription)}" />`;
    }

    if (schemaMarkup) {
      head += `\n<script type="application/ld+json">${JSON.stringify(schemaMarkup)}</script>`;
    }

    const ogImage = seo?.openGraph as Record<string, unknown> | undefined;
    if (ogImage?.image) {
      head += `\n<meta property="og:image" content="${this.escapeHtml(ogImage.image as string)}" />`;
    }

    head += `\n<meta name="keywords" content="${this.escapeHtml(keyword)}" />`;

    return head ? head + '\n' + html : html;
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private injectAdsterra(htmlContent: string, adLayoutJson: string): string {
    try {
      const layout = typeof adLayoutJson === 'string' ? JSON.parse(adLayoutJson) : adLayoutJson;

      const adScripts: Record<string, string> = {
        socialBar: layout.socialBarScript || '',
        nativeBanner: layout.nativeBannerScript || '',
        displayBanner: layout.displayBannerScript || '',
        popunder: layout.popunderScript || '',
      };

      let result = htmlContent;

      if (adScripts.socialBar) {
        result = adScripts.socialBar + '\n' + result;
      }

      if (adScripts.displayBanner) {
        result = result.replace('</p>', `</p>\n${adScripts.displayBanner}\n`);
      }

      if (adScripts.nativeBanner) {
        const faqIndex = result.lastIndexOf('<h3>FAQ');
        if (faqIndex > 0) {
          result = result.slice(0, faqIndex) + `\n${adScripts.nativeBanner}\n` + result.slice(faqIndex);
        }
      }

      if (adScripts.popunder) {
        result += `\n${adScripts.popunder}`;
      }

      return result;
    } catch {
      return htmlContent;
    }
  }
}
