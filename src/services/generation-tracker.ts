export interface GenerationJob {
  id: string;
  type: 'manual' | 'scheduler';
  status: 'running' | 'completed' | 'failed';
  topic: string | null;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  output: string;
  error: string | null;
}

interface GenerationStats {
  active: number;
  completed: number;
  failed: number;
}

const jobs: GenerationJob[] = [];
const MAX_JOBS = 200;

let nextId = 1;

function extractTopic(output: string): string | null {
  const lines = output.split('\n');
  for (const line of lines) {
    const m = line.match(/📝\s+(.+)/);
    if (m) return m[1].trim();
    const m2 = line.match(/Topic:\s*"([^"]+)"/);
    if (m2) return m2[1].trim();
  }
  return null;
}

function extractWordCount(output: string): number | null {
  const m = output.match(/📊\s+(\d+)\s+words/);
  if (m) return parseInt(m[1], 10);
  return null;
}

export function startGenerationJob(type: 'manual' | 'scheduler'): string {
  const id = `gen_${nextId++}_${Date.now()}`;
  jobs.unshift({
    id,
    type,
    status: 'running',
    topic: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    duration: null,
    output: '',
    error: null,
  });
  if (jobs.length > MAX_JOBS) jobs.length = MAX_JOBS;
  return id;
}

export function completeGenerationJob(
  id: string,
  output: string,
  success: boolean,
): void {
  const job = jobs.find(j => j.id === id);
  if (!job) return;
  job.status = success ? 'completed' : 'failed';
  job.completedAt = new Date().toISOString();
  job.output = output;
  job.topic = extractTopic(output);
  job.error = success ? null : (output.includes('Error:') ? output : 'Generation failed');
  const start = new Date(job.startedAt).getTime();
  const end = new Date(job.completedAt).getTime();
  job.duration = end - start;
}

export function getRecentJobs(limit = 50): GenerationJob[] {
  return jobs.slice(0, limit);
}

export function getActiveJobs(): GenerationJob[] {
  return jobs.filter(j => j.status === 'running');
}

export function getGenerationStats(): GenerationStats {
  return {
    active: jobs.filter(j => j.status === 'running').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };
}
