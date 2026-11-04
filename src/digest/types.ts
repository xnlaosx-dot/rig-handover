// Plan morning-digest § 1. The shape every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for a night.
export type DigestRow = {
  job: string;
  // null when the log says null; views show it as "—".
  owner: string | null;
  // Lines for this job, whatever their status.
  runs: number;
  // Lines with status "retry".
  retries: number;
  lastStatus: RunStatus;
  // The most recent error for this job, or null if it never had one.
  lastError: string | null;
  // Times as written in the log, offset kept (styleguide).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  // Sorted by job.
  rows: DigestRow[];
  // Lines that didn't parse: counted, never thrown.
  badLines: number;
};

// Reads runs/<night>.jsonl. Returns null when the night has no file.
export type ReadNight = (runsDir: string, night: string) => Night | null;
