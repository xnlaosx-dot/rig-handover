import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const DASH = String.fromCharCode(0x2014);

const NIGHT = '2026-10-28';
const EMPTY_NIGHT = '2026-11-01';
const MISSING_NIGHT = '2026-01-01';

const jobOrder = ['backups/nightly', 'fixtures/refresh', 'reports/weekly'];

function line(at: string, job: string, status: 'ok' | 'retry' | 'fail', owner: string | null, error?: string): string {
  const entry: Record<string, unknown> = { at, job, status, owner };
  if (error !== undefined) entry.error = error;
  return JSON.stringify(entry);
}

const nightLines = [
  // Out of job order on purpose, so sorting is exercised.
  line('2026-10-29T01:30:00+01:00', 'fixtures/refresh', 'retry', 'rook', 'upstream 503'),
  line('2026-10-29T01:31:00+01:00', 'fixtures/refresh', 'retry', 'rook', 'upstream 503'),
  line('2026-10-29T01:32:00+01:00', 'fixtures/refresh', 'retry', 'rook', 'upstream 503'),
  line('2026-10-29T01:33:00+01:00', 'fixtures/refresh', 'ok', 'rook'),
  line('2026-10-29T02:00:00+01:00', 'reports/weekly', 'ok', 'mira'),
  '{"at":"2026-10-29T02:10:00+01:00","job":"broken/line","sta',
  line('2026-10-29T02:30:00+01:00', 'reports/weekly', 'fail', 'mira', 'disk full'),
  line('2026-10-29T03:00:00+01:00', 'backups/nightly', 'ok', null),
  line('2026-10-29T04:00:00+01:00', 'backups/nightly', 'ok', null),
];

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: '' };

let runsDir = '';
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  process.env.LANE_MARKER = 'TEST-MARKER';
  // A temp runs dir: runs/ is read-only.
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(runsDir, `${NIGHT}.jsonl`), nightLines.join('\n') + '\n');
  writeFileSync(join(runsDir, `${EMPTY_NIGHT}.jsonl`), '');
  app = createApp({ ...config, runsDir });
});

afterAll(() => {
  if (runsDir) rmSync(runsDir, { recursive: true, force: true });
});

// hono/jsx escapes apostrophes, so normalise before matching text.
async function htmlOf(path: string): Promise<{ status: number; html: string }> {
  const res = await app.request(path);
  const html = (await res.text()).replace(/&#39;/g, "'").replace(/&apos;/g, "'");
  return { status: res.status, html };
}

function dataJobs(html: string): string[] {
  return [...html.matchAll(/data-job="([^"]+)"/g)].map((m) => m[1]);
}

function rowTag(html: string, job: string): string {
  const m = html.match(new RegExp(`<tr[^>]*data-job="${job}"[^>]*>`));
  expect(m, `row for ${job}`).not.toBeNull();
  return m![0];
}

function rowHtml(html: string, job: string): string {
  const m = html.match(new RegExp(`<tr[^>]*data-job="${job}"[^>]*>[\\s\\S]*?</tr>`));
  expect(m, `row for ${job}`).not.toBeNull();
  return m![0];
}

describe('digest page', () => {
  it('renders the night with one row per job in job order', async () => {
    const { status, html } = await htmlOf(`/digest/${NIGHT}`);
    expect(status).toBe(200);
    expect(html).toContain(`<h1>digest ${NIGHT}</h1>`);
    expect(html).toContain('TEST-MARKER');
    expect(html.match(/<table class="digest"/g)).toHaveLength(1);
    expect(dataJobs(html)).toEqual(jobOrder);
  });

  it('marks rows with 3 or more retries or a last status of fail', async () => {
    const { html } = await htmlOf(`/digest/${NIGHT}`);
    expect(rowTag(html, 'fixtures/refresh')).toContain('class="warn"');
    expect(rowTag(html, 'reports/weekly')).toContain('class="warn"');
    expect(rowTag(html, 'backups/nightly')).not.toContain('warn');
  });

  it('renders a null owner and a null last error as a dash', async () => {
    const { html } = await htmlOf(`/digest/${NIGHT}`);
    expect(rowHtml(html, 'backups/nightly').split(DASH).length - 1).toBeGreaterThanOrEqual(2);
    expect(rowHtml(html, 'reports/weekly')).toContain('disk full');
  });

  it('reports lines that did not parse', async () => {
    const { html } = await htmlOf(`/digest/${NIGHT}`);
    expect(html).toContain("1 line didn't parse");
  });

  it('says nothing ran for an empty file and draws no table', async () => {
    const { status, html } = await htmlOf(`/digest/${EMPTY_NIGHT}`);
    expect(status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table class="digest"');
  });

  it('returns 404 for a night with no file', async () => {
    const { status, html } = await htmlOf(`/digest/${MISSING_NIGHT}`);
    expect(status).toBe(404);
    expect(html).toContain(`no run log for ${MISSING_NIGHT}`);
  });
});

describe('digest json', () => {
  it('returns night, rows and badLines with rows sorted by job', async () => {
    const res = await app.request(`/api/digest/${NIGHT}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.night).toBe(NIGHT);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(jobOrder);
    const [backups, fixtures, reports] = body.rows;
    expect(backups).toMatchObject({ job: 'backups/nightly', owner: null, runs: 2, retries: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-10-29T03:00:00+01:00', lastAt: '2026-10-29T04:00:00+01:00' });
    expect(fixtures).toMatchObject({ job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:33:00+01:00' });
    expect(reports).toMatchObject({ job: 'reports/weekly', owner: 'mira', runs: 2, retries: 0, lastStatus: 'fail', lastError: 'disk full' });
  });

  it('returns empty rows for an empty file', async () => {
    const res = await app.request(`/api/digest/${EMPTY_NIGHT}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('returns 404 with an error body for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING_NIGHT}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: MISSING_NIGHT });
  });
});

describe('page and json agree', () => {
  it('lists jobs in the same order on the page and in the json', async () => {
    const { html } = await htmlOf(`/digest/${NIGHT}`);
    const body = await (await app.request(`/api/digest/${NIGHT}`)).json();
    expect(dataJobs(html)).toEqual(body.rows.map((r: { job: string }) => r.job));
  });
});
