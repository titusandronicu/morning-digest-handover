import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/reader.js';
import type { RunStatus } from './digest/types.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightLine[];
};

// Jobs of a night by their last status. null counts = the night's file could not be read.
export type NightLine = { night: string; counts: Record<RunStatus, number> | null };

export function nightLine(runsDir: string, night: string): NightLine {
  const data = readNight(runsDir, night);
  if (data === null) return { night, counts: null };
  const counts: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };
  for (const row of data.rows) counts[row.lastStatus] += 1;
  return { night, counts };
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => nightLine(config.runsDir, n)),
  };
}
