import { describe, expect, it } from 'vitest';
import { coveredByModal } from './coveredByModal';

describe('coveredByModal', () => {
  it('leaves the tabs to the screen reader while a tab is on top', () => {
    expect(coveredByModal(['(tabs)', 'today'])).toBe(false);
    expect(coveredByModal(['(tabs)', 'shopping'])).toBe(false);
  });

  // The sheets are transparent modals in the same window: without this, a swipe past the
  // sheet's last control walks into the tab behind it.
  it('hides the tabs while a sheet covers them', () => {
    expect(coveredByModal(['task', '[id]'])).toBe(true);
    expect(coveredByModal(['task', 'new'])).toBe(true);
    expect(coveredByModal(['shopping', '[id]'])).toBe(true);
    expect(coveredByModal(['templates'])).toBe(true);
  });

  it('does not hide anything before the first route settles', () => {
    expect(coveredByModal([])).toBe(false);
  });
});
