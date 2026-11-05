import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// The deploy fills the store links of site/ from the repository's variables (bloque 15.5): a
// listing URL carries `&` and `/`, which a sed replacement would mangle.
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
let dir = '';

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function fill(env: Record<string, string>) {
  dir = mkdtempSync(join(tmpdir(), 'nido-site-'));
  cpSync(join(root, 'site'), dir, { recursive: true });
  execFileSync('bash', [join(root, 'scripts/site-store-links.sh'), dir], {
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
  return {
    landing: readFileSync(join(dir, 'index.html'), 'utf8'),
    invite: readFileSync(join(dir, 'invite/index.html'), 'utf8'),
  };
}

// Each case runs the script in a shell: under a loaded machine it took over 5 s once (bloque 15).
describe('site-store-links.sh', { timeout: 20_000 }, () => {
  it('writes both links as they are, `&` and `/` included, on both pages', () => {
    const play = 'https://play.google.com/store/apps/details?id=com.nidoapp.casa&hl=es';
    const { landing, invite } = fill({ APP_STORE_ID: '6451234567', PLAY_URL: play });
    for (const html of [landing, invite]) {
      expect(html).toContain(`data-play-url="${play}"`);
      expect(html).toContain('data-app-store-id="6451234567"');
    }
  });

  it('leaves the attributes empty without the variables', () => {
    const { invite } = fill({ APP_STORE_ID: '', PLAY_URL: '' });
    expect(invite).toContain('data-app-store-id=""');
    expect(invite).toContain('data-play-url=""');
  });
});
