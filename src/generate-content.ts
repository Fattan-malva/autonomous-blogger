import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { generateContent } from './providers/google-ai';
import { WriterAgent } from './agents/writer';
import { SEOAgent } from './agents/seo';
import { ImageAgent } from './agents/image';
import { AdsterraAgent } from './agents/adsterra';
import { initGoogleAI } from './providers/google-ai';
import { jsonPrompt, safeParseJson } from './utils/json';
import { imageToHtml } from './utils/images';

const RESULT_DIR = resolve(__dirname, '../result');

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function markdownToHtml(md: string): string {
  let html = md;

  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trimEnd())}</code></pre>`);
    return `%%CODEBLOCK_${idx}%%`;
  });

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr />');
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)(?=\s*<\/?[u]?l|\s*$)/g, (match) => {
    if (!match.startsWith('<ul>')) return '<ol>' + match + '</ol>';
    return match;
  });
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" loading="lazy" />');

  html = html.replace(/^\|(.+)\|$/gm, (line) => {
    const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
    if (cells.every(c => /^[-:]+$/.test(c))) return '';
    const tag = line.includes('---') ? 'th' : 'td';
    return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
  });
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');

  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<li><\/li>/g, '');
  html = html.replace(/<blockquote><\/blockquote>/g, '');

  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => codeBlocks[parseInt(idx)]);

  html = html.replace(/(<(?:pre|blockquote|table|h[1-4]|ul|ol)[^>]*>)/g, '</p>$1');
  html = html.replace(/<\/p><hr\s*\/?>/g, '<hr />');
  html = html.replace(/(<\/(?:pre|blockquote|table|h[1-4]|ul|ol)>)/g, '$1<p>');
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

async function main() {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║      AUTONOMOUS CONTENT GENERATOR       ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  const startTime = Date.now();
  initGoogleAI();

  // Step 1: Discover topic + research (via AI, no DB needed)
  console.log('[1/5] Researching profitable topic...');
  const researchPrompt = jsonPrompt(`Research and select ONE profitable long-tail topic for an SEO blog.

Provide:
- keyword: string (the selected topic)
- cluster: string (category like "docker", "linux", "programming", etc.)
- searchIntent: string
- targetAudience: string
- keyQuestions: string[] (FAQs to answer)
- entities: string[] (key entities/terms)
- competitorSummary: string

Return a JSON object`);

  const researchResult = await generateContent(researchPrompt);
  const research = safeParseJson(researchResult) as Record<string, unknown> || {};
  const keyword = (research.keyword as string) || 'technology trends';
  const cluster = (research.cluster as string) || 'technology';
  console.log(`  Topic: "${keyword}" (${cluster})`);

  // Step 2: Write article
  console.log('[2/5] Writing article...');
  const writerAgent = new WriterAgent();
  const writeResult = await writerAgent.run({
    action: 'write-draft',
    articlePlan: {
      title: keyword,
      outline: [],
      targetAudience: research.targetAudience || 'General',
      keyEntities: research.entities || [],
      faqs: research.keyQuestions || [],
    },
    researchData: JSON.stringify(research),
  });
  const rawContent = writeResult.data?.content as string;
  if (!rawContent) {
    console.error('Writing failed');
    process.exit(1);
  }
  console.log(`  Written (${rawContent.split(/\s+/).length} words)`);

  // Step 3: SEO
  console.log('[3/5] Generating SEO metadata...');
  const seoAgent = new SEOAgent();
  const seoResult = await seoAgent.run({
    action: 'generate-seo',
    content: rawContent,
    title: keyword,
    keyword,
  });
  const seo = (seoResult.data?.seo as Record<string, unknown>) || {};

  // Step 4: Images
  console.log('[4/5] Planning images...');
  const imageAgent = new ImageAgent();
  const imageResult = await imageAgent.run({
    action: 'plan-images',
    content: rawContent,
    title: keyword,
  });
  const imageList = (imageResult.data?.images as Array<Record<string, unknown>>) || [];

  // Step 5: Adsterra (AI-driven ad placement)
  console.log('[5/5] Generating Adsterra layout...');
  const adsterraAgent = new AdsterraAgent();
  const adResult = await adsterraAgent.run({ action: 'generate-layout', articleContent: rawContent, title: keyword });
  const adLayout = (adResult.data?.layout as Record<string, string>) || {};
  const adPlacements = (adResult.data?.placements as Array<{ type: string; position: string; paragraphIndex?: number }>) || [];
  const adPackageName = (adResult.data?.packageName as string) || 'standard';
  const adReason = (adResult.data?.reason as string) || '';
  console.log(`  Ad package: "${adPackageName}" — ${adReason}`);

  // --- Assemble HTML ---
  const metaTitle = (seo?.metaTitle as string) || keyword;
  const metaDescription = (seo?.metaDescription as string) || '';

  let htmlContent = markdownToHtml(rawContent);

  // Inject images
  for (const img of imageList) {
    const imgHtml = img.html as string;
    const purpose = img.purpose as string;
    if (purpose === 'featured') {
      htmlContent = htmlContent.replace('<h1>', imgHtml + '\n<h1>');
    } else if (purpose === 'in-article') {
      const firstH2 = htmlContent.indexOf('<h2>');
      if (firstH2 > 0) {
        const afterH2 = htmlContent.indexOf('</h2>', firstH2) + 5;
        htmlContent = htmlContent.slice(0, afterH2) + '\n' + imgHtml + '\n' + htmlContent.slice(afterH2);
      } else {
        htmlContent += '\n' + imgHtml;
      }
    } else {
      htmlContent += '\n' + imgHtml;
    }
  }

  if (!imageList.some(i => i.purpose === 'featured')) {
    const fallbackImg = imageToHtml({
      purpose: 'featured',
      description: keyword,
      altText: keyword,
      caption: `Illustration of ${keyword}`,
      filename: `${slugify(keyword)}-featured.webp`,
      placement: 'featured',
    });
    htmlContent = htmlContent.replace('<h1>', fallbackImg + '\n<h1>');
  }

  // Inject ads using AI-driven placements
  if (adPlacements.length > 0) {
    const injectResult = await adsterraAgent.run({
      action: 'inject-ads',
      content: htmlContent,
      placements: adPlacements,
      layout: adLayout,
    });
    if (injectResult.data?.content) {
      htmlContent = injectResult.data.content as string;
    }
  }

  // Build body content (theme handles all <head> SEO tags)
  const bodyParts: string[] = [];

  if (metaDescription) {
    bodyParts.push(`<p><em>${escapeHtml(metaDescription)}</em></p>`);
  }

  bodyParts.push(htmlContent);

  const finalHtml = bodyParts.join('\n');

  // Save to result/
  mkdirSync(RESULT_DIR, { recursive: true });
  const slug = slugify(keyword);
  const filename = `${slug}.html`;
  const filepath = join(RESULT_DIR, filename);
  writeFileSync(filepath, finalHtml, 'utf-8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  ✅ Done! (${elapsed}s)`);
  console.log(`  📄 ${filepath}`);
  console.log(`  📝 ${keyword}`);
  console.log(`  📊 ${rawContent.split(/\s+/).length} words\n`);
}

main().catch((err) => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
