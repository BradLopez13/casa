import { describe, expect, it } from 'vitest';
import { MAGNET_COLORS, firstInitial, memberMarks } from './marks';

const member = (userId: string, joinedAt: string, displayName = userId) => ({
  userId,
  joinedAt,
  displayName,
});

describe('memberMarks', () => {
  it('returns an empty map for no members', () => {
    expect(memberMarks([]).size).toBe(0);
  });

  it('assigns colours by join order, whatever order the list comes in', () => {
    const ana = member('a', '2026-10-01T10:00:00Z', 'Ana');
    const bob = member('b', '2026-10-02T10:00:00Z', 'Bob');
    const carla = member('c', '2026-10-03T10:00:00Z', 'Carla');
    const forward = memberMarks([ana, bob, carla]);
    const shuffled = memberMarks([carla, ana, bob]);
    expect(forward.get('a')?.color).toBe(MAGNET_COLORS[0]);
    expect(forward.get('b')?.color).toBe(MAGNET_COLORS[1]);
    expect(forward.get('c')?.color).toBe(MAGNET_COLORS[2]);
    expect([...shuffled.entries()].sort()).toEqual([...forward.entries()].sort());
  });

  it('orders by instant, not by the timestamp string', () => {
    // 09:00+02:00 is 07:00Z, so it joined before 08:00Z even though it sorts after as text.
    const early = member('z', '2026-10-01T09:00:00+02:00');
    const late = member('y', '2026-10-01T08:00:00Z');
    const marks = memberMarks([late, early]);
    expect(marks.get('z')?.color).toBe(MAGNET_COLORS[0]);
    expect(marks.get('y')?.color).toBe(MAGNET_COLORS[1]);
  });

  it('breaks ties on the same instant by userId', () => {
    const at = '2026-10-01T10:00:00Z';
    const marks = memberMarks([member('m2', at), member('m1', at)]);
    expect(marks.get('m1')?.color).toBe(MAGNET_COLORS[0]);
    expect(marks.get('m2')?.color).toBe(MAGNET_COLORS[1]);
  });

  it('cycles through the five magnet colours', () => {
    const members = Array.from({ length: 7 }, (_, i) =>
      member(`u${i}`, `2026-10-0${i + 1}T10:00:00Z`),
    );
    const marks = memberMarks(members);
    expect(MAGNET_COLORS).toHaveLength(5);
    expect(marks.get('u5')?.color).toBe(MAGNET_COLORS[0]);
    expect(marks.get('u6')?.color).toBe(MAGNET_COLORS[1]);
  });

  it('gives each member the first letter of their name in capitals', () => {
    const marks = memberMarks([member('a', '2026-10-01T10:00:00Z', 'ana')]);
    expect(marks.get('a')?.initial).toBe('A');
  });
});

describe('firstInitial', () => {
  it('keeps accents', () => {
    expect(firstInitial('álvaro')).toBe('Á');
    expect(firstInitial('ñoño')).toBe('Ñ');
  });

  it('keeps a decomposed accent with its letter', () => {
    expect(firstInitial('álvaro')).toBe('Á');
  });

  it('ignores leading spaces', () => {
    expect(firstInitial('  bea')).toBe('B');
  });

  it('keeps an emoji whole, including skin tones and joined sequences', () => {
    expect(firstInitial('🙂 Ana')).toBe('🙂');
    expect(firstInitial('👍🏽 Bob')).toBe('👍🏽');
    expect(firstInitial('👩‍👩‍👧 Familia')).toBe('👩‍👩‍👧');
    expect(firstInitial('🇪🇸 Spain')).toBe('🇪🇸');
  });

  it('returns an empty string for an empty name', () => {
    expect(firstInitial('')).toBe('');
    expect(firstInitial('   ')).toBe('');
  });
});
