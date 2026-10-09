import { describe, expect, it } from 'vitest';
import type { Member } from '@/features/households/api';
import { scopeLabel } from './scope';

const members: Member[] = [
  { userId: 'me', displayName: 'Brad', role: 'owner', joinedAt: '2026-01-01T00:00:00Z' },
  { userId: 'ana', displayName: 'Ana', role: 'member', joinedAt: '2026-01-02T00:00:00Z' },
];

describe('scopeLabel', () => {
  it('says the whole house when nobody is selected', () => {
    expect(scopeLabel(null, 'me', members)).toBe('En toda la casa');
  });

  it('says only your tasks when you are selected', () => {
    expect(scopeLabel('me', 'me', members)).toBe('Solo tus tareas');
  });

  it("names another member's tasks", () => {
    expect(scopeLabel('ana', 'me', members)).toBe('Las tareas de Ana');
  });

  it('falls back to the whole house for someone who already left', () => {
    expect(scopeLabel('gone', 'me', members)).toBe('En toda la casa');
  });
});
