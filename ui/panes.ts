import { ONE_COLUMN_MAX, type Layout } from './layout';

export type PaneMode = 'split' | 'stack';

/** Two panes side by side from `expanded`; below that, one column in the screen's own order. */
export function paneMode(layout: Pick<Layout, 'twoPane'>): PaneMode {
  return layout.twoPane ? 'split' : 'stack';
}

export type PaneColumn = { paddingLeft: number; paddingRight: number; maxWidth: number };

/**
 * The frame both panes (or the single column) sit in, and anything that must line up with them:
 * the class gutter on each side plus the side safe areas (a phone on its side), the whole kept
 * within `contentMax` once the padding is taken off. Beside the rail the rail already takes the
 * left safe area; a screen outside the tabs (no rail) keeps it.
 */
export function paneColumn(
  layout: Pick<Layout, 'contentMax' | 'gutter'>,
  insets: { left: number; right: number },
  besideRail: boolean,
): PaneColumn {
  const paddingLeft = layout.gutter + (besideRail ? 0 : insets.left);
  const paddingRight = layout.gutter + insets.right;
  return { paddingLeft, paddingRight, maxWidth: layout.contentMax + paddingLeft + paddingRight };
}

/**
 * One column of content: a list on a phone or a small tablet, or Todas on a wide screen. The same
 * frame as `paneColumn` (gutter plus side safe areas), kept within the one-column width whatever
 * the class. On a phone in portrait it is the 20 dp each side the lists have always had.
 */
export function oneColumn(
  layout: Pick<Layout, 'gutter'>,
  insets: { left: number; right: number },
  besideRail: boolean,
): PaneColumn {
  return paneColumn({ gutter: layout.gutter, contentMax: ONE_COLUMN_MAX }, insets, besideRail);
}
