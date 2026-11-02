import {
  MutationObserver,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import { membershipEnd, type Membership } from './api';
import { clearEndedNotice, readEndedNotice } from './endedNotice';
import { householdsKey, membershipKey } from './keys';
import { useForgetEndedHousehold } from './useForgetEndedHousehold';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  membershipEnd: vi.fn(),
}));

const critica: Membership = {
  householdId: 'h1',
  householdName: 'Critica Nov',
  role: 'member',
  rooms: [],
};
const casa: Membership = { householdId: 'h2', householdName: 'Casa', role: 'owner', rooms: [] };

function Probe({
  households,
  membership,
}: {
  households: Membership[] | undefined;
  membership: Membership | null | undefined;
}) {
  useForgetEndedHousehold(households, membership);
  return null;
}

let queryClient: QueryClient;

function renderProbe(households: Membership[] | undefined, membership: Membership | null) {
  // What the screen keeps of the household shown: its tasks (the hook watches the cache).
  queryClient.setQueryData(['tasks', 'h1'], []);
  queryClient.setQueryData(membershipKey, membership);
  if (households) queryClient.setQueryData(householdsKey, households);
  return render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <Probe households={households} membership={membership} />
      </NoticeProvider>
    </QueryClientProvider>,
  );
}

/** A change of `householdId` waiting for the connection, as the quick add leaves it offline. */
function queue(householdId: string) {
  void new MutationObserver(queryClient, {
    mutationKey: ['tasks', 'create'],
    networkMode: 'online',
    mutationFn: () => Promise.resolve(),
  })
    .mutate({ id: `t-${Math.random()}`, householdId })
    .catch(() => undefined);
}

beforeEach(() => {
  queryClient = new QueryClient();
  queryClient.mount();
  onlineManager.setOnline(false);
  clearEndedNotice();
  vi.mocked(membershipEnd).mockReset();
});
afterEach(() => {
  onlineManager.setOnline(true);
  queryClient.unmount();
});

// Bloque 15.2 (P2-2): the household on screen, deleted from another phone, vanished and the
// tablet jumped to another one without a word, and its unsent changes went with it.
describe('useForgetEndedHousehold', () => {
  it('says which household ended, why, where you are now, and what was lost', async () => {
    vi.mocked(membershipEnd).mockResolvedValue('deleted');
    const view = renderProbe([critica, casa], critica);
    act(() => {
      queue('h1');
      queue('h1');
      queue('h2');
    });
    // The list comes back without it and the membership already moved on (fetchHouseholds).
    act(() => {
      queryClient.setQueryData(membershipKey, casa);
      queryClient.setQueryData(householdsKey, [casa]);
    });
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <NoticeProvider>
          <Probe households={[casa]} membership={casa} />
        </NoticeProvider>
      </QueryClientProvider>,
    );
    const notice = await screen.findByTestId('notice');
    expect(notice.textContent).toBe(
      `${t('households.ended.deleted', { old: 'Critica Nov', next: 'Casa' })} ${t('households.ended.lostOther', { count: 2 })}`,
    );
    expect(membershipEnd).toHaveBeenCalledWith('h1');
    // The other household's change stays.
    expect(
      queryClient
        .getMutationCache()
        .findAll({ status: 'pending' })
        .map((m) => m.state.variables),
    ).toMatchObject([{ householdId: 'h2' }]);
  });

  it('says «te han quitado» and «has salido desde otro móvil» when the server knows', async () => {
    vi.mocked(membershipEnd).mockResolvedValue('removed');
    const view = renderProbe([critica, casa], critica);
    act(() => {
      queryClient.setQueryData(membershipKey, casa);
    });
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <NoticeProvider>
          <Probe households={[casa]} membership={casa} />
        </NoticeProvider>
      </QueryClientProvider>,
    );
    expect((await screen.findByTestId('notice')).textContent).toBe(
      t('households.ended.removed', { old: 'Critica Nov', next: 'Casa' }),
    );
  });

  it('with no other household, leaves the sentence for the screen with no household', async () => {
    vi.mocked(membershipEnd).mockResolvedValue('deleted');
    const view = renderProbe([critica], critica);
    act(() => {
      queryClient.setQueryData(membershipKey, null);
    });
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <NoticeProvider>
          <Probe households={[]} membership={null} />
        </NoticeProvider>
      </QueryClientProvider>,
    );
    await vi.waitFor(() =>
      expect(readEndedNotice()).toBe(t('households.endedAlone.deleted', { old: 'Critica Nov' })),
    );
    expect(screen.queryByTestId('notice')).toBeNull();
  });

  it('says nothing about a household that ended while another was on screen', () => {
    vi.mocked(membershipEnd).mockResolvedValue('deleted');
    const view = renderProbe([critica, casa], casa);
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <NoticeProvider>
          <Probe households={[casa]} membership={casa} />
        </NoticeProvider>
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId('notice')).toBeNull();
    expect(membershipEnd).not.toHaveBeenCalled();
  });
});

// Revisión 15.2: fetchHouseholds moves the membership on in its own render, before the list
// arrives; the household to name is still the one that was on screen.
describe('when the membership moves on a render before the list', () => {
  it('still names the household that was on screen', async () => {
    vi.mocked(membershipEnd).mockResolvedValue('deleted');
    const view = renderProbe([critica, casa], critica);
    act(() => {
      queryClient.setQueryData(membershipKey, casa);
      queryClient.setQueryData(householdsKey, [casa]);
    });
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <NoticeProvider>
          <Probe households={[critica, casa]} membership={casa} />
        </NoticeProvider>
      </QueryClientProvider>,
    );
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <NoticeProvider>
          <Probe households={[casa]} membership={casa} />
        </NoticeProvider>
      </QueryClientProvider>,
    );
    expect((await screen.findByTestId('notice')).textContent).toBe(
      t('households.ended.deleted', { old: 'Critica Nov', next: 'Casa' }),
    );
  });
});
