import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { completeWithUndo, reopenWithUndo } from '@/features/tasks/undo';
import { NoticeProvider, useNotice, type NoticeAction } from './Notice';
import { useNoticeNudges } from './noticeContext';

/**
 * Bloque 14.2 (P1-1 y P2-1 del 1 de noviembre): every notice moved the list unless it said not to,
 * so «Aún se está enviando…», «Ahora estás en Casa.» or an error moved it to uncover a note they
 * did not speak of, and the door was left cut. Reopening moved it to uncover the last note while
 * the note reopened went up to its section. Now a notice moves the list only if it asks to.
 */
function Probe({ onReady }: { onReady: (notify: ReturnType<typeof useNotice>) => void }) {
  const notify = useNotice();
  onReady(notify);
  return <span data-testid="nudges">{String(useNoticeNudges())}</span>;
}

function setUp() {
  let notify: ReturnType<typeof useNotice> = () => undefined;
  const view = render(
    <NoticeProvider>
      <Probe onReady={(n) => (notify = n)} />
    </NoticeProvider>,
  );
  const nudges = () => view.getByTestId('nudges').textContent;
  const show = (message: string, action?: NoticeAction) => act(() => notify(message, action));
  return { nudges, show, notify: () => notify };
}

describe('which notices move the list', () => {
  it('a notice without an action moves nothing', () => {
    const { nudges, show } = setUp();
    show('Aún se está enviando.');
    expect(nudges()).toBe('false');
  });

  it('completing and reopening move nothing', () => {
    const { nudges, notify } = setUp();
    const toggle = () => true;
    act(() => {
      completeWithUndo({ toggle, notify: notify(), task: { id: 'a' } });
    });
    expect(nudges()).toBe('false');
    act(() => {
      reopenWithUndo({ toggle, notify: notify(), task: { id: 'a' } });
    });
    expect(nudges()).toBe('false');
  });

  it('a notice that asks for it moves the list (Bolsa vaciada)', () => {
    const { nudges, show } = setUp();
    show('Bolsa vaciada.', { label: 'Deshacer', onPress: () => undefined, nudges: true });
    expect(nudges()).toBe('true');
  });
});
