import { ONE_COLUMN_MAX, RAIL_WIDTH, type Layout } from './layout';

export type PaneMode = 'split' | 'stack';

/** Two panes side by side from `expanded`; below that, one column in the screen's own order. */
export function paneMode(layout: Pick<Layout, 'twoPane'>): PaneMode {
  return layout.twoPane ? 'split' : 'stack';
}

/** Which of the two panes takes the larger share. */
export type WidePane = 'left' | 'right';

/**
 * The 60/40 split as flex weights. The left pane is the wide one by default (what is pending, the
 * screen's main list). A list beside its detail (Semana's days beside the chosen day) turns it
 * round: the list keeps a contained width and the detail takes the room.
 */
export function paneFlex(wide: WidePane = 'left'): { left: number; right: number } {
  return wide === 'left' ? { left: 3, right: 2 } : { left: 2, right: 3 };
}

/**
 * The two panes' widths in dp, from the room inside the column (its padding taken off) and the
 * gap between them. Set as widths rather than left to flex weights, which Android was seen to
 * ignore (both panes came out equal).
 */
export function paneWidths(
  inner: number,
  gap: number,
  wide: WidePane = 'left',
): { left: number; right: number } {
  const room = Math.max(0, inner - gap);
  const flex = paneFlex(wide);
  const left = Math.round((room * flex.left) / (flex.left + flex.right));
  return { left, right: room - left };
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

/**
 * The width a column is centred in: the window, less the rail and the left safe area it covers
 * when the rail is drawn beside it.
 */
export function columnRoom(windowWidth: number, besideRail: boolean, insetLeft: number): number {
  return windowWidth - (besideRail ? RAIL_WIDTH + insetLeft : 0);
}

/**
 * The same frame with its content kept `lane` dp clear of the right edge of `room` (the width it
 * is centred in): for a button floating over the bottom right corner (the round "+" on a phone
 * on its side), so no row, heading or count ever sits under it. Only the right padding grows, and
 * only by what the centring margin and the gutter do not already give; a lane of 0 changes nothing.
 */
export function clearRightLane(column: PaneColumn, room: number, lane: number): PaneColumn {
  const frame = Math.min(room, column.maxWidth);
  const margin = Math.max(0, (room - frame) / 2);
  const extra = Math.max(0, lane - margin - column.paddingRight);
  return extra === 0 ? column : { ...column, paddingRight: column.paddingRight + extra };
}
