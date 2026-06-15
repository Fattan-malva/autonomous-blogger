import 'dotenv/config';
import { logger } from './config/logger';
import { CEOAgent } from './agents/ceo';
import { ResearchAgent } from './agents/research';
import { CompetitorAgent } from './agents/competitor';
import { SERPGapAgent } from './agents/serp-gap';
import { PlanningAgent } from './agents/planning';
import { WriterAgent } from './agents/writer';
import { HumanizerAgent } from './agents/humanizer';
import { ReviewerAgent } from './agents/reviewer';
import { SEOAgent } from './agents/seo';
import { ImageAgent } from './agents/image';
import { InternalLinkAgent } from './agents/internal-link';
import { BloggerAgent } from './agents/blogger';
import { AdsterraAgent } from './agents/adsterra';
import { IndexingAgent } from './agents/indexing';

const BORDER = '='.repeat(60);

function logStep(step: number, total: number, label: string) {
  console.log(`\n${BORDER}`);
  console.log(`  [${step}/${total}] ${label}`);
  console.log(BORDER);
}

function logDone(success: boolean, detail?: string) {
  console.log(`  ${success ? '✓' : '✗'} ${detail || ''}`);
}

async function main() {
  console.log(`\n${BORDER}`);
  console.log('  FULL PIPELINE TRIGGER');
  console.log(`  ${new Date().toISOString()}`);
  console.log(BORDER);

  const TOTAL_STEPS = 13;
  let step = 0;

  // ========================================
  // STEP 1: DISCOVER TOPICS
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'Research — Discover Topics');
  const researchAgent = new ResearchAgent();
  const discoverResult = await researchAgent.run({ action: 'discover-topics' });
  logDone(discoverResult.success, `Found ${(discoverResult.data?.discovered as number) || 0} topics`);
  if (!discoverResult.success) {
    console.error('  Error:', discoverResult.error);
    process.exit(1);
  }

  // ========================================
  // STEP 2: DEEP RESEARCH (pick first topic)
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'Research — Deep Research');
  const topics = discoverResult.data?.topics as Array<Record<string, unknown>> || [];
  if (topics.length === 0) {
    console.log('  No topics to research. Exiting.');
    process.exit(0);
  }

  const firstTopic = topics[0].keyword as string;
  const firstCluster = topics[0].cluster as string;
  logDone(true, `Selected topic: "${firstTopic}"`);
  console.log(`  Cluster: ${firstCluster}`);

  const deepResult = await researchAgent.run({ action: 'deep-research', topic: firstTopic, cluster: firstCluster });
  logDone(deepResult.success, 'Research package generated');

  // ========================================
  // STEP 3: COMPETITOR ANALYSIS
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'Competitor Analysis');
  const competitorAgent = new CompetitorAgent();
  const compResult = await competitorAgent.run({ action: 'analyze', topicId: 1, keyword: firstTopic });
  logDone(compResult.success, `Analyzed ${(compResult.data?.competitors as Array<unknown>)?.length || 0} competitors`);

  // ========================================
  // STEP 4: SERP GAP ANALYSIS
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'SERP Gap Analysis');
  const serpGapAgent = new SERPGapAgent();
  const gapResult = await serpGapAgent.run({ action: 'find-gaps', keyword: firstTopic, competitorData: compResult.data });
  logDone(gapResult.success, 'Gap analysis complete');

  // ========================================
  // STEP 5: ARTICLE PLANNING
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'Planning — Article Blueprint');
  const planningAgent = new PlanningAgent();
  const planResult = await planningAgent.run({
    action: 'create-plan',
    keyword: firstTopic,
    researchData: deepResult.data,
    competitorData: compResult.data,
    serpGaps: gapResult.data,
  });
  logDone(planResult.success, 'Blueprint created: ' + ((planResult.data?.plan as Record<string, unknown>)?.title as string || ''));

  // ========================================
  // STEP 6: WRITING
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'Writing — Generate Draft');
  const writerAgent = new WriterAgent();
  const writeResult = await writerAgent.run({
    action: 'write-draft',
    articlePlan: planResult.data?.plan,
    researchData: deepResult.data,
  });
  const rawContent = writeResult.data?.content as string | undefined;

  if (!rawContent) {
    console.log('  ⚠ Writing failed, cannot continue pipeline.');
    console.log(`\n${BORDER}`);
    console.log('  ⚠ PIPELINE STOPPED (writing failed)');
    console.log(BORDER);
    console.log(`  Finished: ${new Date().toISOString()}`);
    console.log(BORDER + '\n');
    process.exit(1);
  }

  const planTitle = ((planResult.data?.plan as Record<string, unknown>)?.title as string) || firstTopic;

  // ========================================
  // STEP 7: HUMANIZATION
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'Humanizer — Remove AI Fingerprints');
  const humanizerAgent = new HumanizerAgent();
  const humanizeResult = await humanizerAgent.run({ action: 'humanize', content: rawContent });
  logDone(humanizeResult.success, 'Humanized');
  const humanizedContent = humanizeResult.data?.humanizedContent as string | undefined;
  const contentForReview = humanizedContent || rawContent;

  // ========================================
  // STEP 8: QUALITY REVIEW
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'Reviewer — Quality Check');
  const reviewerAgent = new ReviewerAgent();
  const reviewResult = await reviewerAgent.run({
    action: 'review',
    content: contentForReview,
    articlePlan: planResult.data?.plan,
  });
  const reviewData = reviewResult.data as Record<string, unknown> || {};
  const passed = reviewData.passed as boolean;
  const score = reviewData.overallScore as number;
  logDone(passed, `Score: ${score || 'N/A'}/100 ${passed ? '(PASS)' : '(FAIL)'}`);

  const finalContent = passed ? contentForReview : rawContent;
  if (!passed) {
    console.log('  ⚠ Review failed, using raw draft instead');
  }

  // ========================================
  // STEP 9: SEO OPTIMIZATION
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'SEO — Generate Metadata');
  const seoAgent = new SEOAgent();
  const seoResult = await seoAgent.run({
    action: 'generate-seo',
    content: finalContent,
    title: planTitle,
    keyword: firstTopic,
  });
  logDone(seoResult.success, 'SEO metadata generated');

  // ========================================
  // STEP 10: IMAGE PLANNING
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'Image — Plan Visuals');
  const imageAgent = new ImageAgent();
  const imageResult = await imageAgent.run({
    action: 'plan-images',
    content: finalContent,
    title: planTitle,
  });
  logDone(imageResult.success, `Planned ${(imageResult.data?.images as Array<unknown>)?.length || 0} images`);

  // ========================================
  // STEP 11: ADSTERRA LAYOUT
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'Adsterra — Generate Ad Layout');
  const adsterraAgent = new AdsterraAgent();
  const adResult = await adsterraAgent.run({ action: 'generate-layout', articleContent: finalContent });
  const hasAds = !!(adResult.data?.layout as Record<string, unknown>)?.socialBarScript;
  logDone(adResult.success, hasAds ? 'Ad scripts generated' : 'No ADSTERRA_API_TOKEN configured');

  // ========================================
  // STEP 12: PUBLISH TO BLOGGER
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'Blogger — Publish Article');
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

  // ========================================
  // STEP 13: SUBMIT FOR INDEXING
  // ========================================
  step++;
  logStep(step, TOTAL_STEPS, 'Indexing — Submit to Google');
  if (blogResult.success && blogResult.data?.url) {
    const indexingAgent = new IndexingAgent();
    const indexResult = await indexingAgent.run({
      action: 'submit-url',
      url: blogResult.data.url as string,
    });
    logDone(indexResult.success, `Indexing ${indexResult.success ? 'submitted' : 'failed'}`);
  } else {
    logDone(false, 'Skipped (no URL)');
  }

  // ========================================
  // DONE
  // ========================================
  console.log(`\n${BORDER}`);
  console.log('  ✅ PIPELINE COMPLETE');
  console.log(BORDER);
  if (blogResult.success) {
    console.log(`  URL: ${blogResult.data?.url}`);
  }
  console.log(`  Finished: ${new Date().toISOString()}`);
  console.log(BORDER + '\n');
}

main().catch((err) => {
  console.error('\n❌ Pipeline failed:', err);
  process.exit(1);
});
