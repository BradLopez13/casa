import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { NoticeProvider, useNotice } from './Notice';
import { useSheetFoot } from './sheetFootContext';
import { space } from '../theme';

type Handles = { notify: (message: string) => void; reportFoot: (e: LayoutChangeEvent) => void };

/** jsdom has no layout: the sheet hands the test its hooks, and the test reports the foot. */
function Sheet({ onReady }: { onReady: (handles: Handles) => void }) {
  const notify = useNotice();
  const { onLayout } = useSheetFoot();
  useEffect(() => {
    onReady({ notify, reportFoot: onLayout });
  }, [notify, onLayout, onReady]);
  return (
    <View testID="foot">
      <Text>Guardar</Text>
    </View>
  );
}

const layout = (height: number) =>
  ({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height } } }) as LayoutChangeEvent;

const pillBottom = () =>
  getComputedStyle(screen.getByTestId('notice').parentElement as HTMLElement).bottom;

function renderSheet() {
  let handles: Handles | null = null;
  const view = render(
    <NoticeProvider>
      <Sheet
        onReady={(h) => {
          handles = h;
        }}
      />
    </NoticeProvider>,
  );
  if (handles === null) throw new Error('the sheet did not mount');
  return { ...view, handles: handles as Handles };
}

// Bloque 15.3 (P2-4): the pill sat on the sheet's foot, over Guardar, and took its taps.
describe('a notice over a sheet with a foot', () => {
  it('is drawn above the foot, by its height', () => {
    const { handles } = renderSheet();
    act(() => handles.reportFoot(layout(80)));
    act(() => handles.notify('Sin conexión no se borra.'));
    expect(pillBottom()).toBe(`${80 + space(3)}px`);
  });

  it('comes back down once the sheet is gone', () => {
    const { handles, rerender } = renderSheet();
    act(() => handles.reportFoot(layout(80)));
    rerender(<NoticeProvider>{null}</NoticeProvider>);
    act(() => handles.notify('Hecha.'));
    expect(pillBottom()).toBe(`${space(3)}px`);
  });
});
