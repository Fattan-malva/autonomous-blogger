import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const DATA_DIR = resolve(__dirname, '../../data');
const CONFIG_FILE = join(DATA_DIR, 'bot-config.json');

export interface BotConfig {
  enabled: boolean;
  totalVisitors: number;
  clicksPerVisitorMin: number;
  clicksPerVisitorMax: number;
  visitorDelayMin: number;
  visitorDelayMax: number;
  readTimeMin: number;
  readTimeMax: number;
  betweenClicksMin: number;
  betweenClicksMax: number;
  adClickChance: number;
  internalLinkChance: number;
  maxConcurrent: number;
}

const defaults: BotConfig = {
  enabled: false,
  totalVisitors: 100,
  clicksPerVisitorMin: 0,
  clicksPerVisitorMax: 3,
  visitorDelayMin: 30000,
  visitorDelayMax: 180000,
  readTimeMin: 15000,
  readTimeMax: 180000,
  betweenClicksMin: 5000,
  betweenClicksMax: 45000,
  adClickChance: 0.15,
  internalLinkChance: 0.2,
  maxConcurrent: 1,
};

export function getBotConfig(): BotConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      return { ...defaults, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) };
    }
  } catch {}
  return { ...defaults };
}

export function updateBotConfig(updates: Partial<BotConfig>): BotConfig {
  const current = getBotConfig();
  const merged = { ...current, ...updates };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
