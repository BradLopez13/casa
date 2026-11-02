import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { NoticeProvider, useNotice } from './Notice';
import { useSheetFoot } from './sheetFootContext';
import { space } from '../theme';

let notify: (message: string) => void = () => undefined;
let reportFoot: (event: LayoutChangeEvent) => void = () => undefined;

function Sheet() {
  notify = useNotice();
  // jsdom has no layout: the test reports the foot's height by hand.
  reportFoot = useSheetFoot().onLayout;
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

// Bloque 15.3 (P2-4): the pill sat on the sheet's foot, over Guardar, and took its taps.
describe('a notice over a sheet with a foot', () => {
  it('is drawn above the foot, by its height', () => {
    render(
      <NoticeProvider>
        <Sheet />
      </NoticeProvider>,
    );
    act(() => reportFoot(layout(80)));
    act(() => notify('Sin conexión no se borra.'));
    expect(pillBottom()).toBe(`${80 + space(3)}px`);
  });

  it('comes back down once the sheet is gone', () => {
    const { rerender } = render(
      <NoticeProvider>
        <Sheet />
      </NoticeProvider>,
    );
    act(() => reportFoot(layout(80)));
    rerender(<NoticeProvider>{null}</NoticeProvider>);
    act(() => notify('Hecha.'));
    expect(pillBottom()).toBe(`${space(3)}px`);
  });
});
