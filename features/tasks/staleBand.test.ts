import { describe, expect, it } from 'vitest';
import { shouldShowStaleBand } from './staleBand';

const cached = { hasData: true, isRefetchError: false, errorIsNetwork: false };

describe('shouldShowStaleBand', () => {
  it('never shows without cached tasks: the list shows its own error', () => {
    const none = { hasData: false, isRefetchError: false, errorIsNetwork: false };
    expect(shouldShowStaleBand(none, false)).toBe(false);
    expect(shouldShowStaleBand({ ...none, isRefetchError: true, errorIsNetwork: true }, true)).toBe(
      false,
    );
  });

  it('shows with cached tasks while the phone is offline', () => {
    expect(shouldShowStaleBand(cached, false)).toBe(true);
  });

  it('shows when online but the last refresh failed for lack of network', () => {
    expect(
      shouldShowStaleBand({ ...cached, isRefetchError: true, errorIsNetwork: true }, true),
    ).toBe(true);
  });

  it('stays hidden when the refresh failed for another reason', () => {
    expect(
      shouldShowStaleBand({ ...cached, isRefetchError: true, errorIsNetwork: false }, true),
    ).toBe(false);
  });

  it('stays hidden when online and up to date', () => {
    expect(shouldShowStaleBand(cached, true)).toBe(false);
  });
});
