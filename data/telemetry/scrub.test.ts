import { describe, expect, it } from 'vitest';
import { scrubUrl } from './scrub';

describe('scrubUrl', () => {
  it('hides the token of an invite link', () => {
    expect(scrubUrl('casa://invite/abc123')).toBe('casa://invite/[redacted]');
  });

  it('hides the PKCE code and keeps the other parameters', () => {
    expect(scrubUrl('https://x.supabase.co/auth/v1/callback?code=XYZ&state=1')).toBe(
      'https://x.supabase.co/auth/v1/callback?code=[redacted]&state=1',
    );
  });

  it('hides tokens in the query and in the fragment', () => {
    expect(scrubUrl('https://a.dev/cb?token=t1&x=2')).toBe('https://a.dev/cb?token=[redacted]&x=2');
    expect(scrubUrl('casa://auth#access_token=aa&refresh_token=rr&type=recovery')).toBe(
      'casa://auth#access_token=[redacted]&refresh_token=[redacted]&type=recovery',
    );
  });

  it('leaves a URL with nothing sensitive as it is', () => {
    expect(scrubUrl('https://x.supabase.co/rest/v1/tasks?select=*')).toBe(
      'https://x.supabase.co/rest/v1/tasks?select=*',
    );
  });

  it('leaves text that is not a URL as it is', () => {
    expect(scrubUrl('Navigation to /today')).toBe('Navigation to /today');
  });
});
