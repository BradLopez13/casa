import { onlineManager } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { announce } from '@/ui/a11y';
import { OfflineBand } from './OfflineBand';

vi.mock('@/ui/a11y', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/ui/a11y')>()),
  announce: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(announce).mockReset();
  onlineManager.setOnline(false);
});

afterEach(() => {
  // Taken down while still offline, so no test leaves a «back» behind for the next one.
  cleanup();
  onlineManager.setOnline(true);
});

describe('OfflineBand', () => {
  it('says what it means and announces it', () => {
    render(<OfflineBand />);
    expect(screen.getByTestId('shopping.offline').textContent).toContain(t('shopping.offline'));
    expect(announce).toHaveBeenCalledWith(t('shopping.offline'));
  });

  it('announces the connection is back when it goes because the phone is online, once', () => {
    const a = render(<OfflineBand />);
    const b = render(<OfflineBand testID="other" />);
    onlineManager.setOnline(true);
    a.unmount();
    b.unmount();
    expect(vi.mocked(announce).mock.calls.filter(([m]) => m === t('offline.back'))).toHaveLength(1);
  });

  it('says nothing more when it goes while still offline (the screen was left)', () => {
    render(<OfflineBand />).unmount();
    expect(announce).not.toHaveBeenCalledWith(t('offline.back'));
  });
});
