import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { completeTask } from './api';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/data/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'id' }));

beforeEach(() => {
  rpc.mockReset();
});

describe('completeTask', () => {
  const at = '2026-10-26T22:50:00.000Z';

  it('sends the moment of the tap (bloque 11)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await completeTask('a', '2026-10-26', at);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('complete_task', {
      p_id: 'a',
      p_today: '2026-10-26',
      p_at: at,
    });
  });

  it('goes as before against a database without the migration', async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'no function' } })
      .mockResolvedValueOnce({ data: null, error: null });
    await completeTask('a', '2026-10-26', at);
    expect(rpc).toHaveBeenLastCalledWith('complete_task', { p_id: 'a', p_today: '2026-10-26' });
  });

  it('turns any other error into an AppError, without a second call', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'TASK_NOT_FOUND' } });
    await expect(completeTask('a', '2026-10-26', at)).rejects.toEqual(
      new AppError('TASK_NOT_FOUND'),
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
