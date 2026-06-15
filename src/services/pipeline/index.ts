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

    log('FULL PIPELINE RUN');
    log(`Started: ${new Date().toISOString()}`);

    // STEP 1: DISCOVER TOPICS
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
    log('Research — Deep Research');
    const deepResult = await researchAgent.run({ action: 'deep-research', topic: firstTopic, cluster: firstCluster });
    logDone(deepResult.success, 'Research package generated');
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 3: COMPETITOR ANALYSIS
    log('Competitor Analysis');
    const competitorAgent = new CompetitorAgent();
    const compResult = await competitorAgent.run({ action: 'analyze', topicId: 1, keyword: firstTopic });
    const compCount = (compResult.data?.competitors as Array<unknown>)?.length || 0;
    logDone(compResult.success, `Analyzed ${compCount} competitors`);
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 4: SERP GAP ANALYSIS
    log('SERP Gap Analysis');
    const serpGapAgent = new SERPGapAgent();
    const gapResult = await serpGapAgent.run({ action: 'find-gaps', keyword: firstTopic, competitorData: compResult.data });
    logDone(gapResult.success, 'Gap analysis complete');
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 5: ARTICLE PLANNING
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
    log('Humanizer — Remove AI Fingerprints');
    const humanizerAgent = new HumanizerAgent();
    const humanizeResult = await humanizerAgent.run({ action: 'humanize', content: rawContent });
    logDone(humanizeResult.success, 'Humanized');
    const humanizedContent = humanizeResult.data?.humanizedContent as string | undefined;
    const contentForReview = humanizedContent || rawContent;
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 8: QUALITY REVIEW
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
    logDone(passed !== false, `Score: ${score || 'N/A'}/100 ${passed ? '(PASS)' : '(FAIL, using draft)'}`);
    const finalContent = passed ? contentForReview : rawContent;
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 9: SEO OPTIMIZATION
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
    log('Image — Plan Visuals');
    const imageAgent = new ImageAgent();
    const imageResult = await imageAgent.run({
      action: 'plan-images',
      content: finalContent,
      title: planTitle,
    });
    logDone(imageResult.success, `Planned ${(imageResult.data?.images as Array<unknown>)?.length || 0} images`);
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 11: ADSTERRA
    log('Adsterra — Generate Ad Layout');
    const adsterraAgent = new AdsterraAgent();
    const adResult = await adsterraAgent.run({ action: 'generate-layout', articleContent: finalContent });
    const hasAds = !!(adResult.data?.layout as Record<string, unknown>)?.socialBarScript;
    logDone(adResult.success, hasAds ? 'Ad scripts generated' : 'No ADSTERRA_API_TOKEN configured');
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 12: PUBLISH TO BLOGGER
    log('Blogger — Publish Article');
    const bloggerAgent = new BloggerAgent();
    const blogResult = await bloggerAgent.run({
      action: 'publish',
      content: finalContent,
      title: planTitle,
      labels: [firstCluster || 'general'],
      seoData: seoResult.data?.seo,
      adsterraLayout: JSON.stringify(adResult.data?.layout || {}),
    });
    logDone(blogResult.success, `Published: ${(blogResult.data?.url as string) || ''}`);
    result.postId = blogResult.data?.postId as string;
    result.url = blogResult.data?.url as string;
    result.stepsCompleted++;
    await sleep(STEP_DELAY_MS);

    // STEP 13: INDEXING
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
    log(`✅ PIPELINE COMPLETE — ${result.url || 'No URL'}`);
    log(`Finished: ${new Date().toISOString()}`);

    return result;
  } catch (err) {
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
