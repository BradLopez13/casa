import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// CI of PR #67: an e2e shard failed because `supabase start` found the host port 54322 taken
// («address already in use»), which sits in Linux's range of ephemeral ports. The start is tried
// again, as when the image registry refuses a pull; any other failure is not.
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
let dir = '';

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** Runs `ci-supabase.sh run` with a fake `supabase` that fails once with `firstError`. */
function runWith(firstError: string) {
  dir = mkdtempSync(join(tmpdir(), 'nido-ci-supabase-'));
  const bin = join(dir, 'bin');
  execFileSync('mkdir', ['-p', bin]);
  const fake = join(bin, 'supabase');
  writeFileSync(
    fake,
    `#!/usr/bin/env bash
count_file="${dir.replace(/\\/g, '/')}/count"
n=$(cat "$count_file" 2>/dev/null || echo 0)
echo $((n + 1)) > "$count_file"
[ "$1" = stop ] && exit 0
if [ "$n" = 0 ]; then echo '${firstError}'; exit 1; fi
echo started
`,
  );
  chmodSync(fake, 0o755);
  execFileSync('bash', [join(root, 'scripts/ci-supabase.sh'), 'run'], {
    cwd: dir,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}`, CI_SUPABASE_RETRY_S: '0' },
    stdio: 'pipe',
  });
  return {
    status: readFileSync(join(dir, '.supabase-start.status'), 'utf8').trim(),
    log: readFileSync(join(dir, '.supabase-start.log'), 'utf8'),
  };
}

describe('ci-supabase.sh', { timeout: 20_000 }, () => {
  it('tries the start again when a host port is taken', () => {
    const { status, log } = runWith(
      'failed to bind host port 0.0.0.0:54322/tcp: address already in use',
    );
    expect(status).toBe('0');
    expect(log).toContain('started');
  });

  it('does not try again after any other failure', () => {
    const { status, log } = runWith('some other failure');
    expect(status).toBe('1');
    expect(log).not.toContain('started');
  });
});
