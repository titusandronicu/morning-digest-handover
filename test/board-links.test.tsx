import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

describe('status board links', () => {
  it('links each night to its digest with its counts', async () => {
    const res = await createApp({ ...base, runsDir: 'runs' }).request('/');
    const html = await res.text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('ok 4 · retry 0 · fail 1');
    expect(html.indexOf('2026-10-28')).toBeLessThan(html.indexOf('2026-10-27'));
  });

  it('shows — for the counts of a night whose file cannot be read', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'runs-'));
    writeFileSync(join(dir, '2026-10-25.jsonl'), '');
    mkdirSync(join(dir, '2026-10-26.jsonl')); // listed on disk, unreadable as a file
    const html = await (await createApp({ ...base, runsDir: dir }).request('/')).text();
    expect(html).toContain('href="/digest/2026-10-26"');
    expect(html).toContain('ok — · retry — · fail —');
    expect(html).toContain('ok 0 · retry 0 · fail 0');
  });
});
