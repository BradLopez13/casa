import * as Clipboard from 'expo-clipboard';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inviteFromClipboard } from './clipboardInvite';

vi.mock('expo-clipboard', () => ({
  hasStringAsync: vi.fn(),
  getStringAsync: vi.fn(),
}));

const TOKEN = 'cd'.repeat(24);

function copied(text: string | null) {
  vi.mocked(Clipboard.hasStringAsync).mockResolvedValue(text !== null);
  vi.mocked(Clipboard.getStringAsync).mockResolvedValue(text ?? '');
}

describe('inviteFromClipboard (bloque 14.3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('takes a link copied alone', async () => {
    copied(`casa://invite?token=${TOKEN}`);
    expect(await inviteFromClipboard('android')).toBe(`casa://invite?token=${TOKEN}`);
  });

  it('takes the token out of a whole message copied from a chat', async () => {
    copied(
      `Te invito a mi casa «Casa» en Nido.\n\nSi ya tienes Nido…\n\ncasa://invite?token=${TOKEN}`,
    );
    expect(await inviteFromClipboard('android')).toBe(TOKEN);
  });

  it('leaves the field alone when the clipboard holds something else, or nothing', async () => {
    copied('la lista de la compra');
    expect(await inviteFromClipboard('android')).toBeNull();
    copied(null);
    expect(await inviteFromClipboard('android')).toBeNull();
  });

  it('does not read the clipboard on iOS (it would ask every time)', async () => {
    copied(`casa://invite?token=${TOKEN}`);
    expect(await inviteFromClipboard('ios')).toBeNull();
    expect(Clipboard.getStringAsync).not.toHaveBeenCalled();
  });
});
