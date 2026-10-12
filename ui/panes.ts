import type { Layout } from './layout';

export type PaneMode = 'split' | 'stack';

/** Two panes side by side from `expanded`; below that, one column in the screen's own order. */
export function paneMode(layout: Pick<Layout, 'twoPane'>): PaneMode {
  return layout.twoPane ? 'split' : 'stack';
}
