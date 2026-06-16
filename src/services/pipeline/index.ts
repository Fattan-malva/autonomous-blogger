import { logger } from '../../config/logger';
import { ResearchAgent } from '../../agents/research';
import { CompetitorAgent } from '../../agents/competitor';
import { SERPGapAgent } from '../../agents/serp-gap';
import { PlanningAgent } from '../../agents/planning';
import { WriterAgent } from '../../agents/writer';
import { HumanizerAgent } from '../../agents/humanizer';
import { ReviewerAgent } from '../../agents/reviewer';
import { SEOAgent } from '../../agents/seo';
import { ImageAgent } from '../../agents/image';
import { BloggerAgent } from '../../agents/blogger';
import { AdsterraAgent } from '../../agents/adsterra';
import { IndexingAgent } from '../../agents/indexing';
import { initGoogleAI } from '../../providers/google-ai';
import { startPipelineProgress, setPipelineProgress, completePipelineProgress } from '../../routes/dashboard';

const BORDER = '='.repeat(60);
const STEP_DELAY_MS = 4000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface PipelineResult {
  success: boolean;
  url?: string;
  postId?: string;
  topic?: string;
  error?: string;
  stepsCompleted: number;
}

export async function runFullPipeline(): Promise<PipelineResult> {
  const result: PipelineResult = { success: false, stepsCompleted: 0 };

  try {
    initGoogleAI();
    startPipelineProgress();

    log('FULL PIPELINE RUN');
    log(`Started: ${new Date().toISOString()}`);

    // STEP 1: DISCOVER TOPICS
    setPipelineProgress(1, 'Discover Topics', 'Research');
    log('Research — Discover Topics');
    const researchAgent = new ResearchAgent();
    const discoverResult = await researchAgent.run({ action: 'discover-topics' });
    const topicCount = (discoverResult.data?.discovered as number) || 0;
    logDone(topicCount > 0, `Found ${topicCount} topics`);
    if (!discoverResult.success || topicCount === 0) {
      result.error = 'No topics discovered';
      return result;
    }
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // PICK FIRST TOPIC
    const topics = discoverResult.data?.topics as Array<Record<string, unknown>> || [];
    const firstTopic = topics[0].keyword as string;
    const firstCluster = topics[0].cluster as string;
    result.topic = firstTopic;
    logDone(true, `Selected topic: "${firstTopic}" (${firstCluster})`);

    // STEP 2: DEEP RESEARCH
    setPipelineProgress(2, 'Deep Research', 'Research');
    log('Research — Deep Research');
    const deepResult = await researchAgent.run({ action: 'deep-research', topic: firstTopic, cluster: firstCluster });
    logDone(deepResult.success, 'Research package generated');
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 3: COMPETITOR ANALYSIS
    setPipelineProgress(3, 'Competitor Analysis', 'Competitor');
    log('Competitor Analysis');
    const competitorAgent = new CompetitorAgent();
    const compResult = await competitorAgent.run({ action: 'analyze', topicId: 1, keyword: firstTopic });
    const compCount = (compResult.data?.competitors as Array<unknown>)?.length || 0;
    logDone(compResult.success, `Analyzed ${compCount} competitors`);
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 4: SERP GAP ANALYSIS
    setPipelineProgress(4, 'SERP Gap Analysis', 'SERPGap');
    log('SERP Gap Analysis');
    const serpGapAgent = new SERPGapAgent();
    const gapResult = await serpGapAgent.run({ action: 'find-gaps', keyword: firstTopic, competitorData: compResult.data });
    logDone(gapResult.success, 'Gap analysis complete');
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 5: ARTICLE PLANNING
    setPipelineProgress(5, 'Article Planning', 'Planning');
    log('Planning — Article Blueprint');
    const planningAgent = new PlanningAgent();
    const planResult = await planningAgent.run({
      action: 'create-plan',
      keyword: firstTopic,
      researchData: deepResult.data,
      competitorData: compResult.data,
      serpGaps: gapResult.data,
    });
    const planTitle = ((planResult.data?.plan as Record<string, unknown>)?.title as string) || firstTopic;
    logDone(planResult.success, `Blueprint: "${planTitle}"`);
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 6: WRITING
    setPipelineProgress(6, 'Writing Draft', 'Writer');
    log('Writing — Generate Draft');
    const writerAgent = new WriterAgent();
    const writeResult = await writerAgent.run({
      action: 'write-draft',
      articlePlan: planResult.data?.plan,
      researchData: deepResult.data,
    });
    const rawContent = writeResult.data?.content as string | undefined;
    if (!rawContent) {
      result.error = 'Writing failed — no content generated';
      return result;
    }
    logDone(true, `Written (${rawContent.split(' ').length} words)`);
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 7: HUMANIZATION
    setPipelineProgress(7, 'Humanization', 'Humanizer');
    log('Humanizer — Remove AI Fingerprints');
    const humanizerAgent = new HumanizerAgent();
    const humanizeResult = await humanizerAgent.run({ action: 'humanize', content: rawContent });
    logDone(humanizeResult.success, 'Humanized');
    const humanizedContent = humanizeResult.data?.humanizedContent as string | undefined;
    const contentForReview = humanizedContent || rawContent;
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 8: QUALITY REVIEW
    setPipelineProgress(8, 'Quality Review', 'Reviewer');
    log('Reviewer — Quality Check');
    const reviewerAgent = new ReviewerAgent();
    const reviewResult = await reviewerAgent.run({
      action: 'review',
      content: contentForReview,
      articlePlan: planResult.data?.plan,
    });
    const reviewData = reviewResult.data as Record<string, unknown> || {};
    const passed = reviewData.passed as boolean;
    const score = reviewData.overallScore as number;
    logDone(passed !== false, `Score: ${score || 'N/A'}/100 ${passed ? '(PASS)' : '(FAIL, using humanized)'}`);
    // Use humanized content always (not raw), even if review fails - better for publishing
    const finalContent = humanizedContent || rawContent;
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 9: SEO OPTIMIZATION
    setPipelineProgress(9, 'SEO Optimization', 'SEO');
    log('SEO — Generate Metadata');
    const seoAgent = new SEOAgent();
    const seoResult = await seoAgent.run({
      action: 'generate-seo',
      content: finalContent,
      title: planTitle,
      keyword: firstTopic,
    });
    logDone(seoResult.success, 'SEO metadata generated');
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 10: IMAGE PLANNING
    setPipelineProgress(10, 'Image Planning', 'Image');
    log('Image — Plan Visuals');
    const imageAgent = new ImageAgent();
    const imageResult = await imageAgent.run({
      action: 'plan-images',
      content: finalContent,
      title: planTitle,
    });
    logDone(imageResult.success, `Planned ${(imageResult.data?.images as Array<unknown>)?.length || 0} images`);
    const imageList = (imageResult.data?.images as Array<Record<string, unknown>>) || [];
    let contentWithImages = finalContent;
    for (const img of imageList) {
      const html = img.html as string;
      const purpose = img.purpose as string;
      if (purpose === 'featured') {
        contentWithImages = html + '\n\n' + contentWithImages;
      } else if (img.placement === 'after-introduction') {
        contentWithImages = contentWithImages.replace('## Introduction', '## Introduction\n\n' + html);
      } else {
        contentWithImages = contentWithImages + '\n\n' + html;
      }
    }
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 11: ADSTERRA
    setPipelineProgress(11, 'Adsterra Injection', 'Adsterra');
    log('Adsterra — Generate Ad Layout');
    const adsterraAgent = new AdsterraAgent();
    const adResult = await adsterraAgent.run({ action: 'generate-layout', articleContent: contentWithImages, title: planTitle });
    const hasAds = !!(adResult.data?.layout as Record<string, string>)?.socialBar;
    const adPackageName = (adResult.data?.packageName as string) || 'standard';
    logDone(adResult.success, hasAds ? `Ad package: ${adPackageName}` : 'No ADSTERRA_API_TOKEN configured');
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 12: PUBLISH TO BLOGGER
    setPipelineProgress(12, 'Publish to Blogger', 'Blogger');
    log('Blogger — Publish Article');
    const bloggerAgent = new BloggerAgent();
    const blogResult = await bloggerAgent.run({
      action: 'publish',
      content: contentWithImages,
      title: planTitle,
      labels: [firstCluster || 'general'],
      seoData: seoResult.data?.seo,
      adsterraLayout: JSON.stringify(adResult.data?.layout || {}),
      adPlacements: adResult.data?.placements || [],
    });
    logDone(blogResult.success, `Published: ${(blogResult.data?.url as string) || ''}`);
    result.postId = blogResult.data?.postId as string;
    result.url = blogResult.data?.url as string;
    if (!blogResult.success || !result.url) {
      result.error = 'Blogger publishing failed — no URL returned';
      return result;
    }

    // Save SEO metadata to database
    const seoData = seoResult.data?.seo as Record<string, unknown> | undefined;
    if (seoData && blogResult.data?.postId) {
      try {
        const { db } = await import('../../database/connection');
        const { articles, seoPackages } = await import('../../database/schema');
        const { eq } = await import('drizzle-orm');
        const articleRes = await db.select({ id: articles.id }).from(articles).where(eq(articles.bloggerPostId, blogResult.data.postId as string)).limit(1).execute();
        if (articleRes.length > 0) {
          await db.insert(seoPackages).values({
            articleId: articleRes[0].id,
            metaTitle: seoData.metaTitle as string,
            metaDescription: seoData.metaDescription as string,
            canonicalUrl: seoData.canonicalUrl as string,
            schemaMarkup: seoData.schemaMarkup as Record<string, unknown> | null,
            openGraph: seoData.openGraph as Record<string, unknown> | null,
            twitterCards: seoData.twitterCards as Record<string, unknown> | null,
          }).onConflictDoNothing();
          logDone(true, 'SEO metadata saved to DB');
        }
      } catch (e) {
        logDone(false, 'SEO DB save failed (non-critical)');
      }
    }

    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 13: INDEXING
    setPipelineProgress(13, 'Indexing', 'Indexing');
    log('Indexing — Submit to Google');
    if (blogResult.success && result.url) {
      const indexingAgent = new IndexingAgent();
      const indexResult = await indexingAgent.run({
        action: 'submit-url',
        url: result.url,
      });
      logDone(indexResult.success, `Indexing ${indexResult.success ? 'submitted' : 'failed'}`);
    } else {
      logDone(false, 'Skipped (no URL)');
    }
    result.stepsCompleted++;

    result.success = true;
    completePipelineProgress();
    log(`✅ PIPELINE COMPLETE — ${result.url || 'No URL'}`);
    log(`Finished: ${new Date().toISOString()}`);

    return result;
  } catch (err) {
    completePipelineProgress((err as Error).message);
    result.error = (err as Error).message;
    log(`⚠ PIPELINE FAILED at step ${result.stepsCompleted + 1}: ${result.error}`);
    return result;
  }
}

function log(label: string): void {
  console.log(`\n${BORDER}`);
  console.log(`  [${label}]`);
  console.log(BORDER);
}

function logDone(success: boolean, detail?: string): void {
  console.log(`  ${success ? '✓' : '✗'} ${detail || ''}`);
}
