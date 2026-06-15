import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { resolve } from 'path';

const STORE_DIR = resolve(__dirname, '../../data');
const STORE_PATH = resolve(STORE_DIR, 'content-status.json');

type ContentStatus = {
  posted: boolean;
  postedAt?: string;
  bloggerUrl?: string;
  indexed: boolean;
  indexedAt?: string;
  indexError?: string;
  notes?: string;
};

type Store = {
  statuses: Record<string, ContentStatus>;
  scheduler: {
    enabled: boolean;
    perDay: number;
    intervalMinutes: number;
  };
};

function defaults(): Store {
  return {
    statuses: {},
    scheduler: { enabled: false, perDay: 10, intervalMinutes: 144 },
  };
}

let cache: Store | null = null;

function ensureDir(): void {
  if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
}

function load(): Store {
  if (cache) return cache;
  ensureDir();
  if (!existsSync(STORE_PATH)) {
    cache = defaults();
    return cache;
  }
  try {
    const raw = readFileSync(STORE_PATH, 'utf-8');
    const data = { ...defaults(), ...JSON.parse(raw) } as Store;
    if (!data.statuses) data.statuses = {};
    cache = data;
    return cache;
  } catch {
    cache = defaults();
    return cache;
  }
}

function save(): void {
  const store = cache;
  if (!store) return;
  ensureDir();
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export function getStatus(slug: string): ContentStatus {
  return load().statuses[slug] || { posted: false, indexed: false };
}

export function getAllStatuses(): Record<string, ContentStatus> {
  return load().statuses;
}

export function setStatus(slug: string, status: Partial<ContentStatus>): ContentStatus {
  const store = load();
  const current = store.statuses[slug] || { posted: false, indexed: false };
  store.statuses[slug] = { ...current, ...status };
  save();
  return store.statuses[slug];
}

export function removeStatus(slug: string): void {
  const store = load();
  delete store.statuses[slug];
  save();
}

export function getSchedulerConfig(): Store['scheduler'] {
  return { ...load().scheduler };
}

export function updateSchedulerConfig(config: Partial<Store['scheduler']>): Store['scheduler'] {
  const store = load();
  store.scheduler = { ...store.scheduler, ...config };
  save();
  return store.scheduler;
}
