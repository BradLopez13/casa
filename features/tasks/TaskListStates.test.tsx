import type { UseQueryResult } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { t } from '@/i18n';
import { TaskListStates } from './TaskListStates';

function query(state: Partial<UseQueryResult<unknown>>): UseQueryResult<unknown> {
  return {
    isPending: false,
    isError: false,
    isFetching: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...state,
  } as unknown as UseQueryResult<unknown>;
}

const empty = <Text>Nada por aquí</Text>;

describe('TaskListStates', () => {
  it('shows a spinner while the first load is pending', () => {
    render(<TaskListStates query={query({ isPending: true })} empty={empty} />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('Nada por aquí')).toBeNull();
  });

  it('shows the load error with a retry that refetches', () => {
    const q = query({ isError: true, error: new AppError('NETWORK') });
    render(<TaskListStates query={q} empty={empty} />);
    expect(screen.getByRole('alert').textContent).toBe(t('tasks.errors.NETWORK'));
    fireEvent.click(screen.getByRole('button', { name: t('errors.retry') }));
    expect(q.refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Nada por aquí')).toBeNull();
  });

  it('names a server error by its code', () => {
    const q = query({ isError: true, error: new AppError('NOT_A_MEMBER') });
    render(<TaskListStates query={q} empty={empty} />);
    expect(screen.getByRole('alert').textContent).toBe(t('tasks.errors.NOT_A_MEMBER'));
  });

  it('keeps the empty state when a refresh over cached tasks fails offline', () => {
    const q = query({ isError: true, data: [], error: new AppError('NETWORK') });
    render(<TaskListStates query={q} empty={empty} />);
    expect(screen.getByText('Nada por aquí')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the error over cached tasks when it is not the network', () => {
    const q = query({ isError: true, data: [], error: new AppError('NOT_A_MEMBER') });
    render(<TaskListStates query={q} empty={empty} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('shows the empty state once loaded with nothing to list', () => {
    render(<TaskListStates query={query({ data: [] })} empty={empty} />);
    expect(screen.getByText('Nada por aquí')).toBeTruthy();
  });
});
