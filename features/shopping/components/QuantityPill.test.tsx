import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markHintSeen } from '@/features/hints/hints';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import { QUANTITY_COLUMN, QuantityPill } from './QuantityPill';

vi.mock('@/features/hints/hints', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/hints/hints')>()),
  markHintSeen: vi.fn(),
}));

function renderPill(quantity: string | null, online = true) {
  const onOpen = vi.fn();
  render(
    <NoticeProvider>
      <QuantityPill
        itemId="i1"
        name="Pan"
        quantity={quantity}
        open={false}
        online={online}
        onOpen={onOpen}
        onClose={vi.fn()}
        onCommit={vi.fn()}
        onEdit={vi.fn()}
        flushRef={{ current: null }}
      />
    </NoticeProvider>,
  );
  return { onOpen, pill: screen.getByTestId('shopping.item.i1.quantity') };
}

beforeEach(() => vi.mocked(markHintSeen).mockReset());

describe('QuantityPill', () => {
  it('with no quantity says nothing that looks like one', () => {
    const { pill } = renderPill(null);
    expect(pill.textContent).toBe('—');
    expect(pill.getAttribute('aria-label')).toBe(
      t('shopping.quantity.label', { name: 'Pan', quantity: t('shopping.quantity.none') }),
    );
  });

  it('carries the scale of the product sheet before the value, with or without a quantity', () => {
    for (const quantity of [null, '2']) {
      const { pill } = renderPill(quantity);
      const glyph = pill.querySelector('[data-icon="scale-outline"]');
      expect(glyph).not.toBeNull();
      expect(pill.textContent).toBe(quantity ?? '—');
      cleanup();
    }
  });

  it('is adjustable on every row, even a quantity that cannot step (fase 10d)', () => {
    const roles = [null, '2', 'un poco'].map((quantity) => {
      const { pill } = renderPill(quantity);
      const role = pill.getAttribute('role');
      cleanup();
      return role;
    });
    // react-native-web draws «adjustable» as a slider.
    expect(roles).toEqual(['slider', 'slider', 'slider']);
  });

  // Fase 10f: a line of the ruled note, not a kit pill; every quantity starts on the same vertical.
  it('is a note at the right margin: no pill edge, a column of one width, a full touch height', () => {
    for (const quantity of [null, '2']) {
      const style = getComputedStyle(renderPill(quantity).pill);
      expect(parseFloat(style.borderTopWidth || '0')).toBe(0);
      expect(style.minWidth).toBe(`${QUANTITY_COLUMN}px`);
      expect(style.minHeight).toBe('44px');
      cleanup();
    }
  });

  it('shows the quantity there is', () => {
    expect(renderPill('2').pill.textContent).toBe('2');
  });

  it('opening the stepper is the first use of the quantity: its hint goes', () => {
    const { pill, onOpen } = renderPill(null);
    fireEvent.click(pill);
    expect(onOpen).toHaveBeenCalled();
    expect(markHintSeen).toHaveBeenCalledWith('quantity');
  });

  it('offline it does not open, and the hint stays', () => {
    const { pill, onOpen } = renderPill(null, false);
    fireEvent.click(pill);
    expect(onOpen).not.toHaveBeenCalled();
    expect(markHintSeen).not.toHaveBeenCalled();
  });
});
