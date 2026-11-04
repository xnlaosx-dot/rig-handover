import type { DigestRow, Night } from '../digest/types.js';

const DASH = '—';

function isWarn(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function badLinesText(n: number): string {
  return n === 1 ? "1 line didn't parse" : `${n} lines didn't parse`;
}

export function DigestView({ night }: { night: Night }) {
  return (
    <>
      <h1>digest {night.night}</h1>
      {night.badLines > 0 ? <p class="warn">{badLinesText(night.badLines)}</p> : null}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table class="digest">
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <tr data-job={row.job} class={isWarn(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? DASH}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? DASH}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function NoRunLog({ night }: { night: string }) {
  return (
    <>
      <h1>digest {night}</h1>
      <p class="warn">no run log for {night}</p>
    </>
  );
}
