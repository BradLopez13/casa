import { describe, expect, it } from 'vitest';
import { listTopStep, shoppingPanes, shoppingState } from './shoppingPanes';

describe('shoppingState', () => {
  it('shows the error only while nothing has loaded', () => {
    expect(shoppingState({ loaded: false, failed: true, itemCount: 0 })).toBe('error');
    expect(shoppingState({ loaded: true, failed: true, itemCount: 2 })).toBe('list');
  });

  it('is loading before the first answer', () => {
    expect(shoppingState({ loaded: false, failed: false, itemCount: 0 })).toBe('loading');
  });

  it('is empty with no items at all, and a list otherwise', () => {
    expect(shoppingState({ loaded: true, failed: false, itemCount: 0 })).toBe('empty');
    expect(shoppingState({ loaded: true, failed: false, itemCount: 1 })).toBe('list');
  });
});

describe('shoppingPanes', () => {
  it('puts what is left to buy on the left and the bought ones on the right', () => {
    expect(shoppingPanes('list', 3, 2)).toEqual({
      leftState: null,
      pendingSheet: true,
      boughtSheet: true,
      boughtEmpty: false,
    });
  });

  it('says nothing is bought on the right only when something is left to buy', () => {
    expect(shoppingPanes('list', 2, 0).boughtEmpty).toBe(true);
    expect(shoppingPanes('list', 0, 1).boughtEmpty).toBe(false);
    expect(shoppingPanes('loading', 0, 0).boughtEmpty).toBe(false);
    expect(shoppingPanes('error', 0, 0).boughtEmpty).toBe(false);
  });

  it('keeps the right pane quiet when the whole list is empty: the left already says so', () => {
    expect(shoppingPanes('empty', 0, 0).boughtEmpty).toBe(false);
  });

  it('draws no sheet for a side with no rows', () => {
    expect(shoppingPanes('list', 0, 2)).toMatchObject({ pendingSheet: false, boughtSheet: true });
    expect(shoppingPanes('list', 2, 0)).toMatchObject({ pendingSheet: true, boughtSheet: false });
  });

  it('says loading, error and empty on the left and draws no sheets', () => {
    for (const state of ['loading', 'error', 'empty'] as const) {
      expect(shoppingPanes(state, 0, 0)).toEqual({
        leftState: state,
        pendingSheet: false,
        boughtSheet: false,
        boughtEmpty: false,
      });
    }
  });
});

describe('listTopStep', () => {
  it('closes up under the offline band', () => {
    expect(listTopStep(true)).toBe(6);
    expect(listTopStep(false)).toBe(2);
  });
});
