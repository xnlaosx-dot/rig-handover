import type { Hono } from 'hono';
import { readNight } from './read.js';

// Same readNight as the page, so the page and the JSON can't disagree (ADR 0001).
export function registerDigestApi(app: Hono, runsDir: string): void {
  app.get('/api/digest/:night', (c) => {
    const nightName = c.req.param('night');
    const night = readNight(runsDir, nightName);
    if (night === null) {
      return c.json({ error: 'no run log', night: nightName }, 404);
    }
    return c.json(night);
  });
}
