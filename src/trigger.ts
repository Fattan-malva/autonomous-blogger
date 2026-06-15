import 'dotenv/config';
import { runFullPipeline } from './services/pipeline';

async function main() {
  const result = await runFullPipeline();

  if (result.success) {
    console.log(`\n✅ Pipeline completed ${result.stepsCompleted}/13 steps`);
    if (result.url) {
      console.log(`   URL: ${result.url}`);
    }
    process.exit(0);
  } else {
    console.error(`\n❌ Pipeline failed after ${result.stepsCompleted} steps: ${result.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Pipeline error:', err);
  process.exit(1);
});
