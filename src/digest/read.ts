import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

export const isNight = (night: string): boolean => NIGHT.test(night);

// Parse at the edge (styleguide): anything that isn't a well-formed run line is a bad line.
export function parseLine(text: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (typeof o.status !== 'string' || !STATUSES.includes(o.status as RunStatus)) return null;
  if (o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: o.owner,
    ...(o.error !== undefined ? { error: o.error } : {}),
  };
}

export function summarize(lines: RunLine[]): DigestRow[] {
  const byJob = new Map<string, DigestRow>();
  for (const l of lines) {
    const row = byJob.get(l.job);
    if (!row) {
      byJob.set(l.job, {
        job: l.job,
        owner: l.owner,
        runs: 1,
        retries: l.status === 'retry' ? 1 : 0,
        lastStatus: l.status,
        lastError: l.error ?? null,
        firstAt: l.at,
        lastAt: l.at,
      });
      continue;
    }
    // Lines come in log order; the last one wins.
    row.runs++;
    if (l.status === 'retry') row.retries++;
    row.lastStatus = l.status;
    if (l.error !== undefined) row.lastError = l.error;
    if (l.owner !== null) row.owner = l.owner;
    row.lastAt = l.at;
  }
  return [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job));
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!isNight(night)) return null;
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;
  const lines: RunLine[] = [];
  let badLines = 0;
  for (const text of readFileSync(file, 'utf8').split('\n')) {
    if (text.trim() === '') continue;
    const line = parseLine(text);
    if (line) lines.push(line);
    else badLines++;
  }
  return { night, rows: summarize(lines), badLines } satisfies Night;
};
