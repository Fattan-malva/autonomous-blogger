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

    // Format code blocks with GitHub-style wrapper + copy button
    htmlContent = this.formatCodeBlocks(htmlContent);

    // Add GitHub README-style CSS
    htmlContent = this.injectContentStyles() + '\n' + htmlContent;

    if (adsterraLayout) {
      htmlContent = this.injectAdsterra(htmlContent, adsterraLayout);
    }

    const seo = seoData as Record<string, unknown> | undefined;
    const finalTitle = seo?.metaTitle as string || title;
    const metaDescription = seo?.metaDescription as string || '';

    if (metaDescription) {
      htmlContent = '<p><em>' + this.escapeHtml(metaDescription) + '</em></p>\n' + htmlContent;
    }

    htmlContent = this.injectSEOMetadata(htmlContent, seo, title, keyword);

    // Copy button script at the end
    htmlContent += '\n' + this.getCopyButtonScript();

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

    // Protect code blocks from other transformations
    const codeBlocks: string[] = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre><code class="language-${lang || 'text'}">${this.escapeHtml(code.trimEnd())}</code></pre>`);
      return `%%CODEBLOCK_${idx}%%`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headings
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Horizontal rules
    html = html.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr />');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Bold & italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)(?=\s*<\/?[u]?l|\s*$)/g, (match) => {
      if (!match.startsWith('<ul>')) {
        return '<ol>' + match + '</ol>';
      }
      return match;
    });

    // Links & images
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" loading="lazy" />');

    // Tables (basic — pipe syntax)
    html = html.replace(/^\|(.+)\|$/gm, (line) => {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) return ''; // separator row
      const tag = line.includes('---') ? 'th' : 'td';
      return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
    });
    html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');

    // Paragraphs (split on double newlines)
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Cleanup empty tags
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<li><\/li>/g, '');
    html = html.replace(/<blockquote><\/blockquote>/g, '');

    // Restore code blocks
    html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => codeBlocks[parseInt(idx)]);

    // Wrap standalone block elements properly
    html = html.replace(/(<(?:pre|blockquote|table|hr|h[1-4]|ul|ol)[^>]*>)/g, '</p>$1');
    html = html.replace(/(<\/(?:pre|blockquote|table|h[1-4]|ul|ol)>)/g, '$1<p>');
    html = html.replace(/<p><\/p>/g, '');

    return html;
  }

  private injectContentStyles(): string {
    return `<style>
.code-block-wrapper { position: relative; margin: 1.5em 0; border-radius: 8px; overflow: hidden; border: 1px solid #d0d7de; }
.code-block-wrapper pre { margin: 0; padding: 1em; overflow-x: auto; background: #f6f8fa; font-size: 14px; line-height: 1.5; tab-size: 2; }
.code-block-wrapper code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; background: none; padding: 0; white-space: pre; }
.code-block-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #e8ecf0; font-size: 12px; color: #57606a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-bottom: 1px solid #d0d7de; }
.copy-btn { background: none; border: 1px solid #d0d7de; border-radius: 6px; padding: 2px 8px; font-size: 11px; cursor: pointer; color: #57606a; font-family: inherit; }
.copy-btn:hover { background: #d0d7de; }
.copy-btn.copied { background: #2da44e; color: #fff; border-color: #2da44e; }
blockquote { padding: 0.5em 1em; margin: 1em 0; border-left: 4px solid #d0d7de; color: #57606a; background: #f6f8fa; border-radius: 4px; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 14px; }
table th, table td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
table th { background: #f6f8fa; font-weight: 600; }
table tr:nth-child(even) { background: #f8f9fa; }
code { padding: 2px 6px; border-radius: 4px; background: #f0f2f5; font-size: 0.9em; font-family: 'SFMono-Regular', Consolas, monospace; }
pre code { background: none; padding: 0; }
img { max-width: 100%; height: auto; border-radius: 8px; margin: 1em 0; }
</style>`;
  }

  private formatCodeBlocks(html: string): string {
    return html.replace(
      /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
      (_, lang, code) => {
        const langLabel = lang !== 'text' ? lang : '';
        return `<div class="code-block-wrapper">
<div class="code-block-header">
<span>${langLabel}</span>
<button class="copy-btn" onclick="copyCode(this)">Copy</button>
</div>
<pre><code class="language-${lang}">${code}</code></pre>
</div>`;
      }
    );
  }

  private getCopyButtonScript(): string {
    return `<script>
function copyCode(btn) {
  var pre = btn.parentElement.nextElementSibling;
  var code = pre.querySelector('code') || pre;
  var text = code.innerText || code.textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(function() { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    });
  } else {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
  }
}
</script>`;
  }

  private injectSEOMetadata(html: string, seo: Record<string, unknown> | undefined, title: string, keyword: string): string {
    const metaDescription = seo?.metaDescription as string || '';
    const schemaMarkup = seo?.schemaMarkup as Record<string, unknown> | undefined;
    const og = seo?.openGraph as Record<string, unknown> | undefined;
    const twitter = seo?.twitterCard as Record<string, unknown> | undefined;

    let head = '';

    if (metaDescription) {
      head += `\n<meta name="description" content="${this.escapeHtml(metaDescription)}" />`;
    }

    if (schemaMarkup) {
      head += `\n<script type="application/ld+json">${JSON.stringify(schemaMarkup)}</script>`;
    }

    // Open Graph
    head += `\n<meta property="og:title" content="${this.escapeHtml(og?.title as string || title)}" />`;
    head += `\n<meta property="og:description" content="${this.escapeHtml(og?.description as string || metaDescription)}" />`;
    head += `\n<meta property="og:type" content="article" />`;
    if (og?.image) {
      head += `\n<meta property="og:image" content="${this.escapeHtml(og.image as string)}" />`;
    }

    // Twitter Card
    head += `\n<meta name="twitter:card" content="summary_large_image" />`;
    head += `\n<meta name="twitter:title" content="${this.escapeHtml(twitter?.title as string || title)}" />`;
    head += `\n<meta name="twitter:description" content="${this.escapeHtml(twitter?.description as string || metaDescription)}" />`;

    // Canonical
    head += `\n<link rel="canonical" href="${this.escapeHtml(seo?.canonicalUrl as string || '')}" />`;

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
        let faqIndex = result.lastIndexOf('<h3>FAQ');
        if (faqIndex < 0) faqIndex = result.lastIndexOf('<h2>FAQ');
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
