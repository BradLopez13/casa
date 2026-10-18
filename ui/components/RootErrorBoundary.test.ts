import { beforeEach, describe, expect, it, vi } from 'vitest';

const hideAsync = vi.fn(() => Promise.resolve(true));
const captureError = vi.fn();
vi.mock('expo-splash-screen', () => ({ hideAsync }));
vi.mock('@/data/telemetry/sentry', () => ({ captureError }));
vi.mock('./FatalScreen', () => ({ FatalScreen: () => null }));

const { RootErrorBoundary } = await import('./RootErrorBoundary');

describe('RootErrorBoundary', () => {
  beforeEach(() => {
    hideAsync.mockClear();
    captureError.mockClear();
  });

  it('hides the splash when it catches, so a start-up crash shows the fatal screen', () => {
    const boundary = new RootErrorBoundary({ children: null });
    boundary.componentDidCatch(new Error('boom'), { componentStack: '' });
    expect(hideAsync).toHaveBeenCalledTimes(1);
  });

  it('reports what it catches', () => {
    const error = new Error('boom');
    new RootErrorBoundary({ children: null }).componentDidCatch(error, { componentStack: 'at X' });
    expect(captureError).toHaveBeenCalledWith(error, { componentStack: 'at X' });
  });
});
