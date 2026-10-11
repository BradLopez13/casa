import { describe, expect, it } from 'vitest';
import { deleteFailureKind, isOwnerAlone } from './delete';

describe('isOwnerAlone', () => {
  it('is true for the owner as the only member', () => {
    expect(isOwnerAlone('owner', [{ userId: 'u1' }], 'u1')).toBe(true);
  });
  it('is false with other members', () => {
    expect(isOwnerAlone('owner', [{ userId: 'u1' }, { userId: 'u2' }], 'u1')).toBe(false);
  });
  it('is false for a plain member alone or while loading', () => {
    expect(isOwnerAlone('member', [{ userId: 'u1' }], 'u1')).toBe(false);
    expect(isOwnerAlone('owner', undefined, 'u1')).toBe(false);
    expect(isOwnerAlone(undefined, [{ userId: 'u1' }], 'u1')).toBe(false);
  });
  it('is false if the only member is someone else', () => {
    expect(isOwnerAlone('owner', [{ userId: 'u2' }], 'u1')).toBe(false);
    expect(isOwnerAlone('owner', [{ userId: 'u1' }], null)).toBe(false);
  });
});

describe('deleteFailureKind', () => {
  it('maps OWNER_MUST_TRANSFER to transfer', () => {
    expect(deleteFailureKind('OWNER_MUST_TRANSFER')).toBe('transfer');
  });
  it('maps everything else to unknown', () => {
    expect(deleteFailureKind('NETWORK')).toBe('unknown');
    expect(deleteFailureKind('UNKNOWN')).toBe('unknown');
  });
});
