import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  activeHouseholdStorageKey,
  forgetChosenHouseholds,
  pickActive,
  readActiveHousehold,
  writeActiveHousehold,
} from './active';

const casa = { householdId: 'casa' };
const mama = { householdId: 'mama' };

describe('pickActive', () => {
  it('shows nothing without households', () => {
    expect(pickActive([], null)).toBeNull();
    expect(pickActive([], 'casa')).toBeNull();
  });

  it('with one household shows it, whatever was chosen before', () => {
    expect(pickActive([casa], null)).toBe(casa);
    expect(pickActive([casa], 'gone')).toBe(casa);
  });

  it('with several shows the one this phone chose', () => {
    expect(pickActive([casa, mama], 'mama')).toBe(mama);
  });

  it('with several and no choice, the oldest membership (the first)', () => {
    expect(pickActive([casa, mama], null)).toBe(casa);
  });

  it('once the chosen one is left or deleted, the next one', () => {
    expect(pickActive([mama], 'casa')).toBe(mama);
  });
});

describe('the choice is the device’s, per person', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    forgetChosenHouseholds();
  });

  it('is kept under the person’s own key', async () => {
    await writeActiveHousehold('me', 'mama');
    expect(await AsyncStorage.getItem(activeHouseholdStorageKey('me'))).toBe('mama');
    expect(await readActiveHousehold('me')).toBe('mama');
  });

  it('another person on the same phone has their own', async () => {
    await writeActiveHousehold('me', 'mama');
    expect(await readActiveHousehold('other')).toBeNull();
  });
});
