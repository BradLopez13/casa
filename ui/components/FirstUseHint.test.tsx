import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { announce, useScreenReader } from '@/ui/a11y';
import { FirstUseHint } from './FirstUseHint';

vi.mock('@/ui/a11y', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/ui/a11y')>()),
  announce: vi.fn(),
  useScreenReader: vi.fn(() => false),
}));

beforeEach(() => {
  vi.mocked(announce).mockReset();
  vi.mocked(useScreenReader).mockReturnValue(false);
});

describe('FirstUseHint', () => {
  it('draws its line with the given test id', () => {
    render(<FirstUseHint testID="hint.a" text="Toca la casilla para marcarla." />);
    expect(screen.getByTestId('hint.a').textContent).toContain('Toca la casilla para marcarla.');
    expect(announce).not.toHaveBeenCalled();
  });

  it('with a screen reader, says the reader text instead, and announces it once per run', () => {
    vi.mocked(useScreenReader).mockReturnValue(true);
    const first = render(
      <FirstUseHint testID="hint.b" text="Desliza la nota." readerText="Usa las acciones." />,
    );
    expect(screen.getByTestId('hint.b').textContent).toContain('Usa las acciones.');
    first.unmount();
    render(<FirstUseHint testID="hint.b" text="Desliza la nota." readerText="Usa las acciones." />);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Usa las acciones.');
  });
});
