// Design tokens. Pure data: no react-native import, so Vitest can check contrast on them.
import type { MagnetColor } from '@/domain/members/marks';

export type Scheme = 'light' | 'dark';

export type Palette = {
  /** Screen background. */
  page: string;
  /** The enamel panel at the top of the main screens. */
  door: string;
  /** Cards and fields that sit on the page. */
  note: string;
  ink: string;
  muted: string;
  /** Replaces `muted` when the phone asks for higher contrast. */
  mutedStrong: string;
  /** Only for what can be tapped, and for selection. */
  cobalt: string;
  /** Text and icons on a cobalt fill. */
  onCobalt: string;
  /** Only for overdue tasks and irreversible actions, always next to the written word. */
  red: string;
  /** Quiet separators that carry no meaning on their own. */
  hairline: string;
  /** Field borders and the dashed empty magnet: at least 3:1 on every ground. */
  outline: string;
  /** The door handle. */
  handle: string;
  /** Initials on a magnet: the deepest navy of the brand ink, readable on every magnet colour. */
  magnetInk: string;
  magnet: Record<MagnetColor, string>;
  /** The fridge light revealed by pull-to-refresh. */
  light: { top: string; text: string; shelf: string };
  /** Scrim behind dialogs. */
  scrim: string;
};

// Nido brand: ink #263663, apricot #F0AD83, cream #FFF6E8, white. page, door, note, ink, cobalt,
// onCobalt and red are fixed by the spec; the rest are mixes of those colours, warm and quiet.
export const palettes: Record<Scheme, Palette> = {
  light: {
    page: '#FFF6E8',
    door: '#FBE0CD',
    note: '#FFFFFF',
    ink: '#263663',
    // Ink softened with 30% apricot: a warm dusk grey, 5.2:1 on the door.
    muted: '#635A6D',
    mutedStrong: '#444868',
    // Same as ink here, so actions must also differ by shape (pill, border, underline, icon).
    cobalt: '#263663',
    onCobalt: '#FFF6E8',
    red: '#B4382E',
    hairline: '#EEE2D6',
    // Ink and apricot half and half: a warm taupe, 3.5:1 on the door.
    outline: '#8B7173',
    // Apricot is safe here: in light mode it never means "tappable".
    handle: '#F0AD83',
    magnetInk: '#151C33',
    magnet: {
      mustard: '#D9A740',
      sage: '#6FA383',
      coral: '#DD8C6C',
      // #4C8E9C reached only 4.33:1 under the initial; one step lighter, same hue.
      petrol: '#4F93A1',
      pink: '#D58BA8',
    },
    light: { top: '#FDEBD9', text: '#6D606E', shelf: 'rgba(240,173,131,0.55)' },
    scrim: 'rgba(38,54,99,0.45)',
  },
  dark: {
    page: '#151C33',
    door: '#263663',
    note: '#1E2744',
    ink: '#FFF6E8',
    // The light door colour dimmed toward ink: warm, clearly quieter than ink, 5.4:1 on the door.
    muted: '#BBADAD',
    mutedStrong: '#DBC7BD',
    cobalt: '#F0AD83',
    onCobalt: '#263663',
    // Raspberry, ~30° of hue from the apricot action colour: overdue never reads as tappable.
    red: '#F2808F',
    hairline: '#353C54',
    // Kept cool and grey so an unselected border never looks like the apricot selection.
    outline: '#918B98',
    // Not apricot: in dark mode apricot is the colour of what can be tapped.
    handle: '#475377',
    magnetInk: '#151C33',
    magnet: {
      mustard: '#E3B65A',
      sage: '#86B898',
      coral: '#E8A285',
      petrol: '#69A7B4',
      pink: '#E2A2BB',
    },
    light: { top: '#4C4047', text: '#FBE0CD', shelf: 'rgba(240,173,131,0.25)' },
    scrim: 'rgba(10,13,26,0.65)',
  },
};

export type NoteEdge = { borderWidth: number; borderColor: string };

/**
 * The edge of a note (and of anything drawn as one). In dark mode the note is barely lighter than
 * the page and the shadow is lost on navy, so a 1 dp hairline gives the paper its edge back; in
 * light mode the shadow is enough.
 */
export const noteEdges: Record<Scheme, NoteEdge> = {
  light: { borderWidth: 0, borderColor: 'transparent' },
  dark: { borderWidth: 1, borderColor: palettes.dark.hairline },
};

export const radii = { day: 12, note: 14, door: 30, pill: 999 } as const;

export const magnetSizes = { lg: 50, md: 38, sm: 26 } as const;
export type MagnetSize = keyof typeof magnetSizes;

/** Initial size inside each magnet. */
export const magnetInitialSizes: Record<MagnetSize, number> = { lg: 21, md: 16, sm: 12 };

/** Loaded in app/_layout.tsx; used only for screen titles, day numbers and magnet initials. */
export const displayFont = 'MPLUSRounded1c_800ExtraBold';

export const MIN_TOUCH = 44;

/**
 * Least height of a text field, a Button and the New task pill: a touch target and a little air.
 * A minimum, never a fixed height, so the control grows with the system text size.
 */
export const CONTROL_HEIGHT = 48;

/**
 * Least height of a small outlined pill drawn inside a full touch target (a form's Guardar, a
 * reminder's time): the Pressable around it keeps MIN_TOUCH. Grows with the text too.
 */
export const INLINE_PILL_HEIGHT = 36;

/** How far the door slides down while refreshing. */
export const DOOR_OPEN = 72;

// Shadow shapes match React Native's style props (iOS shadow*, Android elevation).
export type Shadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

/** Depth exists only on magnets and notes. Shadows are tinted with the brand ink, never grey. */
export const shadows: Record<Scheme, { magnet: Shadow; note: Shadow }> = {
  light: {
    magnet: {
      shadowColor: '#263663',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.32,
      shadowRadius: 5,
      elevation: 4,
    },
    note: {
      shadowColor: '#263663',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 2,
    },
  },
  dark: {
    magnet: {
      shadowColor: '#0A0D1A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.55,
      shadowRadius: 6,
      elevation: 5,
    },
    note: {
      shadowColor: '#0A0D1A',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.45,
      shadowRadius: 10,
      elevation: 3,
    },
  },
};
