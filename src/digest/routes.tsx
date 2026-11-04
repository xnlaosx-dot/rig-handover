import type { Hono } from 'hono';
import { lane } from '../lane.js';
import { Layout } from '../views/layout.js';
import { DigestView, NoRunLog } from '../views/digest.js';
import { readNight } from './read.js';

export function registerDigestPage(app: Hono, runsDir: string): void {
  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const data = readNight(runsDir, night);
    if (data === null) {
      return c.html(
        <Layout title={`digest ${night}`} lane={lane()}>
          <NoRunLog night={night} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestView night={data} />
      </Layout>,
    );
  });
}
