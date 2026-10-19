// Pure: no react-native import, so Vitest can check it.

/**
 * When Android recreates the activity (a change it does not handle itself, such as the system
 * text size), React Native starts the new surface before it stops the old one, so for a moment
 * two app roots run in the same JS runtime. expo-router keeps one global store and each root
 * overwrites it on every render: the two took turns until React gave up with "Maximum update
 * depth exceeded". The registry lets a root wait until it is the only one alive.
 */
export type RootRegistry = {
  nextId: () => number;
  add: (id: number) => void;
  remove: (id: number) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ReadonlySet<number>;
};

export function createRootRegistry(): RootRegistry {
  let counter = 0;
  let alive: ReadonlySet<number> = new Set();
  const listeners = new Set<() => void>();
  const change = (next: ReadonlySet<number>) => {
    alive = next;
    for (const listener of listeners) listener();
  };
  return {
    nextId: () => ++counter,
    add: (id) => change(new Set([...alive, id])),
    remove: (id) => change(new Set([...alive].filter((other) => other !== id))),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => alive,
  };
}

/** A root renders the app only while no other root is alive. */
export function mayRender(id: number, alive: ReadonlySet<number>): boolean {
  return [...alive].every((other) => other === id);
}
