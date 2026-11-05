import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSessionUser } from '@/data/query/sessionUser';
import { NoticeProvider } from '@/ui/components/Notice';
import { completeTask, reopenTask } from './api';
import { useToggleTask } from './queries';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  completeTask: vi.fn(),
  reopenTask: vi.fn(),
}));

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => (resolve = res));
  return { promise, resolve };
};

/**
 * CI del PR #67 (create-complete-task): a task completed and reopened at once kept its box
 * «ocupado» for more than 17 s after both had reached the server.
 */
describe('a toggle and its undo, as Hoy shows them', () => {
  beforeEach(() => setSessionUser('me'));
  afterEach(() => setSessionUser(undefined));

  it('the note is no longer busy once both have gone', async () => {
    const queryClient = new QueryClient();
    queryClient.mount();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <NoticeProvider>{children}</NoticeProvider>
      </QueryClientProvider>
    );
    const done = deferred();
    const undone = deferred();
    vi.mocked(completeTask).mockReturnValue(done.promise);
    vi.mocked(reopenTask).mockReturnValue(undone.promise);
    const { result } = renderHook(() => useToggleTask('h', 'me'), { wrapper });
    act(() => {
      result.current.toggle({ id: 'a', done: true });
    });
    await vi.waitFor(() => expect(completeTask).toHaveBeenCalled());
    expect(result.current.isBusy('a')).toBe(true);
    // Reopened while the complete is still on its way: the undo waits behind it.
    act(() => {
      result.current.toggle({ id: 'a', done: false });
    });
    await act(async () => {
      done.resolve();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(reopenTask).toHaveBeenCalled());
    await act(async () => {
      undone.resolve();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await vi.waitFor(() => expect(result.current.isBusy('a')).toBe(false));
  });
});
