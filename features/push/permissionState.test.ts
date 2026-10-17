import { describe, expect, it } from 'vitest';
import { switchState } from './permissionState';

describe('switchState', () => {
  it('pauses a saved ON preference when the phone denies notifications', () => {
    expect(switchState(true, 'denied')).toEqual({
      value: false,
      disabled: true,
      caption: 'En pausa',
    });
  });
  it('pauses a saved OFF preference too, shown as off', () => {
    expect(switchState(false, 'denied')).toEqual({
      value: false,
      disabled: true,
      caption: 'En pausa',
    });
  });
  it('shows the saved value when granted', () => {
    expect(switchState(true, 'granted')).toEqual({ value: true, disabled: false, caption: null });
    expect(switchState(false, 'granted')).toEqual({ value: false, disabled: false, caption: null });
  });
  it('keeps the usual behaviour when never asked', () => {
    expect(switchState(false, 'undetermined')).toEqual({
      value: false,
      disabled: false,
      caption: null,
    });
    expect(switchState(true, 'undetermined')).toEqual({
      value: true,
      disabled: false,
      caption: null,
    });
  });
});
