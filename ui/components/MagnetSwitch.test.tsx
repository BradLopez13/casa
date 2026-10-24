import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MagnetSwitch } from './MagnetSwitch';

function renderSwitch(value: boolean, disabled = false) {
  const onValueChange = vi.fn();
  render(
    <MagnetSwitch
      testID="sw"
      accessibilityLabel="Avisarme de mis tareas"
      value={value}
      disabled={disabled}
      onValueChange={onValueChange}
    />,
  );
  return { onValueChange, sw: screen.getByTestId('sw') };
}

describe('MagnetSwitch', () => {
  it('is a switch with its label and state for a screen reader', () => {
    const { sw } = renderSwitch(true);
    expect(sw.getAttribute('role')).toBe('switch');
    expect(sw.getAttribute('aria-label')).toBe('Avisarme de mis tareas');
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('turns on and off with a tap', () => {
    const { sw, onValueChange } = renderSwitch(false);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('says its state by shape too: a bell when on, the crossed bell when off', () => {
    expect(renderSwitch(true).sw.querySelector('[data-icon="bell"]')).not.toBeNull();
    cleanup();
    expect(renderSwitch(false).sw.querySelector('[data-icon="bell-off-outline"]')).not.toBeNull();
  });

  it('paused, waits dashed and says so', () => {
    const { sw, onValueChange } = renderSwitch(true, true);
    expect(sw.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(sw);
    expect(onValueChange).not.toHaveBeenCalled();
    const dashed = [...sw.querySelectorAll('div')].some(
      (node) => getComputedStyle(node).borderTopStyle === 'dashed',
    );
    expect(dashed).toBe(true);
  });
});
