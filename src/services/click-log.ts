import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const DATA_DIR = resolve(__dirname, '../../data');
const LOG_FILE = join(DATA_DIR, 'click-log.json');

export interface ClickLogEntry {
  date: string;
  sessions: number;
  adClicks: number;
  internalClicks: number;
  scrolls: number;
  errors: number;
  startTime: string;
  endTime: string;
  durationMs: number;
}

interface ClickLogStore {
  daily: ClickLogEntry[];
}

function readLog(): ClickLogStore {
  try {
    if (existsSync(LOG_FILE)) {
      return JSON.parse(readFileSync(LOG_FILE, 'utf-8'));
    }
  } catch {}
  return { daily: [] };
}

function writeLog(store: ClickLogStore): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(LOG_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function getTodayLog(): ClickLogEntry | null {
  const store = readLog();
  const key = todayKey();
  const today = store.daily.find(d => d.date === key);
  return today || null;
}

export function updateTodayLog(updates: Partial<ClickLogEntry>): ClickLogEntry {
  const store = readLog();
  const key = todayKey();
  let today = store.daily.find(d => d.date === key);
  if (!today) {
    today = {
      date: key,
      sessions: 0,
      adClicks: 0,
      internalClicks: 0,
      scrolls: 0,
      errors: 0,
      startTime: new Date().toISOString(),
      endTime: '',
      durationMs: 0,
    };
    store.daily.push(today);
  }
  Object.assign(today, updates);
  writeLog(store);
  return today;
}

export function endTodayLog(): ClickLogEntry {
  const now = new Date().toISOString();
  const today = getTodayLog();
  const start = today?.startTime ? new Date(today.startTime).getTime() : Date.now();
  return updateTodayLog({
    endTime: now,
    durationMs: Date.now() - start,
  });
}

export function getClickStats(days = 30): { totalSessions: number; totalAdClicks: number; totalInternalClicks: number; totalErrors: number; daily: ClickLogEntry[] } {
  const store = readLog();
  const recent = store.daily.slice(-days);
  return {
    totalSessions: recent.reduce((s, d) => s + d.sessions, 0),
    totalAdClicks: recent.reduce((s, d) => s + d.adClicks, 0),
    totalInternalClicks: recent.reduce((s, d) => s + d.internalClicks, 0),
    totalErrors: recent.reduce((s, d) => s + d.errors, 0),
    daily: recent,
  };
}
