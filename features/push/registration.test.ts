import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldRegister } from './registration';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('./api', () => ({ registerPushToken: vi.fn(), unregisterPushToken: vi.fn() }));

describe('shouldRegister', () => {
  const current = { userId: 'u1', token: 'ExponentPushToken[a]' };

  it('registers when nothing was registered before', () => {
    expect(shouldRegister(null, current)).toBe(true);
  });

  it('skips the same user with the same token', () => {
    expect(shouldRegister({ ...current }, current)).toBe(false);
  });

  it('registers the same token for another user', () => {
    expect(shouldRegister({ ...current, userId: 'u2' }, current)).toBe(true);
  });

  it('registers a new token', () => {
    expect(shouldRegister({ ...current, token: 'ExponentPushToken[b]' }, current)).toBe(true);
  });
});

describe('forgetPushRegistration', () => {
  const store = new Map<string, string>();
  const reg = { userId: 'u1', token: 'ExponentPushToken[a]' };

  // Each test gets a fresh module, so a registration left pending cannot leak into the next.
  async function load() {
    vi.resetModules();
    const storage = (await import('@react-native-async-storage/async-storage')).default;
    vi.mocked(storage.getItem).mockImplementation((k: string) =>
      Promise.resolve(store.get(k) ?? null),
    );
    vi.mocked(storage.setItem).mockImplementation((k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve();
    });
    vi.mocked(storage.removeItem).mockImplementation((k: string) => {
      store.delete(k);
      return Promise.resolve();
    });
    const api = await import('./api');
    vi.mocked(api.registerPushToken).mockReset();
    vi.mocked(api.unregisterPushToken).mockReset();
    return { api, registration: await import('./registration') };
  }

  beforeEach(() => {
    store.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for an in-flight registration, then unregisters its token', async () => {
    const { api, registration } = await load();
    const order: string[] = [];
    let finish: () => void = () => undefined;
    vi.mocked(api.registerPushToken).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            order.push('register');
            resolve();
          };
        }),
    );
    vi.mocked(api.unregisterPushToken).mockImplementation((token: string) => {
      order.push(`unregister:${token}`);
      return Promise.resolve();
    });
    const registering = registration.registerAndSave(reg, 'android');
    const forgetting = registration.forgetPushRegistration();
    await Promise.resolve();
    finish();
    await Promise.all([registering, forgetting]);
    expect(order).toEqual(['register', `unregister:${reg.token}`]);
    expect(store.size).toBe(0);
  });

  it('does nothing with nothing saved or pending', async () => {
    const { api, registration } = await load();
    await registration.forgetPushRegistration();
    expect(api.unregisterPushToken).not.toHaveBeenCalled();
  });

  it('still forgets locally when the unregister fails', async () => {
    const { api, registration } = await load();
    store.set('casa-push-registration', JSON.stringify(reg));
    vi.mocked(api.unregisterPushToken).mockRejectedValue(new Error('offline'));
    await registration.forgetPushRegistration();
    expect(api.unregisterPushToken).toHaveBeenCalledWith(reg.token);
    expect(store.size).toBe(0);
  });

  it('gives up waiting for a stuck registration after about 3 seconds', async () => {
    const { api, registration } = await load();
    vi.useFakeTimers();
    vi.mocked(api.registerPushToken).mockReturnValue(new Promise<void>(() => undefined));
    void registration.registerAndSave(reg, 'ios');
    let done = false;
    const forgetting = registration.forgetPushRegistration().then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(2900);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await forgetting;
    expect(done).toBe(true);
  });
});
