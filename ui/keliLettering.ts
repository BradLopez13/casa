/**
 * Geometry of assets/brand/keli/lettering.svg (lettering B): «keli» in M PLUS Rounded 1c
 * ExtraBold, outlined, with the dot of the «i» drawn as a head of the symbol. Never replace it
 * with the name typed in the font. Pending visual review (16 Nov 2026).
 */
export const KELI_LETTERING_VIEWBOX = '0 0 1694 760';

const VIEWBOX_WIDTH = 1694;
const VIEWBOX_HEIGHT = 760;

export const KELI_LETTERING_PATH =
  'M56 750Q33 750 16.5 733Q0 716 0 693V57Q0 34 16.5 17Q33 0 56 0H105Q128 0 144.5 17Q161 34 161 57V426Q161 427 162 427L164 426L289 274Q325 230 381 230H453Q469 230 476.5 245Q484 260 473 273L302 474Q297 480 302 487L475 706Q485 720 477.5 735Q470 750 453 750H381Q325 750 290 705L164 541Q163 540 162 540Q161 540 161 541V693Q161 716 144.5 733Q128 750 105 750ZM806 329Q761 329 738 352.5Q715 376 709 433Q709 441 716 441H885Q894 441 894 432Q890 329 806 329ZM831 760Q695 760 621.5 691Q548 622 548 490Q548 359 613.5 289.5Q679 220 803 220Q1041 220 1045 480Q1045 504 1026.5 520.5Q1008 537 984 537H717Q707 537 709 546Q717 601 751.5 624.5Q786 648 855 648Q900 648 952 635Q973 630 989.5 643Q1006 656 1006 677V679Q1006 704 990.5 724.5Q975 745 951 749Q893 760 831 760ZM1229 750Q1206 750 1189 733Q1172 716 1172 693V57Q1172 34 1189 17Q1206 0 1229 0H1285Q1308 0 1325 17Q1342 34 1342 57V693Q1342 716 1325 733Q1308 750 1285 750ZM1581 750Q1558 750 1541 733Q1524 716 1524 693V287Q1524 264 1541 247Q1558 230 1581 230H1637Q1660 230 1677 247Q1694 264 1694 287V693Q1694 716 1677 733Q1660 750 1637 750Z';

/** The dot of the «i», a head like the symbol's. */
export const KELI_LETTERING_DOT = { cx: 1609, cy: 105, r: 85 } as const;

/** Width of the lettering drawn `height` dp tall. */
export function letteringWidth(height: number): number {
  return (height * VIEWBOX_WIDTH) / VIEWBOX_HEIGHT;
}

/** The lettering is this share of the symbol's height in the horizontal signature. */
const LETTERING_TO_SYMBOL = 0.62;
const SIGNATURE_GAP = 12;

/**
 * Sizes of the horizontal signature (symbol, then «keli») on the brand band. `hero` opens
 * onboarding; a short window (phone turned) shrinks every variant to the same compact size.
 */
export function brandSignatureSizes(
  variant: 'regular' | 'hero',
  shortHeight: boolean,
): { symbol: number; lettering: number; gap: number } {
  const symbol = shortHeight ? 48 : variant === 'hero' ? 80 : 64;
  return { symbol, lettering: symbol * LETTERING_TO_SYMBOL, gap: SIGNATURE_GAP };
}

/**
 * The signature stacked (symbol over «keli») in the column the band becomes on a phone on its
 * side: the lettering fits the rail (`RAIL_WIDTH`, 88 dp) with 8 dp either side.
 */
export const BESIDE_SIGNATURE = { symbol: 48, lettering: 24, gap: 8 } as const;
