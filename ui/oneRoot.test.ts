import { describe, expect, it, vi } from 'vitest';
import { createRootRegistry, mayRender } from './oneRoot';

describe('mayRender', () => {
  it('lets a root render when it is the only one alive, registered or not yet', () => {
    expect(mayRender(1, new Set())).toBe(true);
    expect(mayRender(1, new Set([1]))).toBe(true);
  });

  it('holds any root while another is alive, the new one and the old one alike', () => {
    expect(mayRender(2, new Set([1]))).toBe(false);
    expect(mayRender(1, new Set([1, 2]))).toBe(false);
    expect(mayRender(2, new Set([1, 2]))).toBe(false);
  });
});

describe('createRootRegistry', () => {
  it('hands each root its own id', () => {
    const registry = createRootRegistry();
    expect(registry.nextId()).not.toBe(registry.nextId());
  });

  it('lets the new root in once the old one has gone (an Android activity recreation)', () => {
    const registry = createRootRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    const old = registry.nextId();
    registry.add(old);
    const fresh = registry.nextId();
    expect(mayRender(fresh, registry.getSnapshot())).toBe(false);
    registry.add(fresh);
    registry.remove(old);
    expect(mayRender(fresh, registry.getSnapshot())).toBe(true);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('gives a new snapshot on each change, so React sees it', () => {
    const registry = createRootRegistry();
    const before = registry.getSnapshot();
    registry.add(registry.nextId());
    expect(registry.getSnapshot()).not.toBe(before);
  });

  it('stops telling a listener once it unsubscribes', () => {
    const registry = createRootRegistry();
    const listener = vi.fn();
    registry.subscribe(listener)();
    registry.add(registry.nextId());
    expect(listener).not.toHaveBeenCalled();
  });
});
