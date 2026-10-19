import { useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createRootRegistry, mayRender } from '../oneRoot';

const registry = createRootRegistry();

/**
 * Wraps the app root (index.js) so that only one copy of it renders at a time: after an Android
 * activity recreation the new root waits, blank, until React Native has stopped the old one
 * (see `ui/oneRoot.ts`). The old root drops its tree as soon as the new one appears, since its
 * surface is about to go anyway.
 */
export function OneRoot({ children }: { children: ReactNode }) {
  const [id] = useState(registry.nextId);
  const alive = useSyncExternalStore(registry.subscribe, registry.getSnapshot);
  useLayoutEffect(() => {
    registry.add(id);
    return () => registry.remove(id);
  }, [id]);
  return mayRender(id, alive) ? children : null;
}
