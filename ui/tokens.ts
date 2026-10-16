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
  /** Fill of the main action pill: the pósit, in both themes. */
  accent: string;
  /** Text and icons on the accent fill. */
  onAccent: string;
  /** Edge of the accent pill, so it shows on the page where the yellow alone would not. */
  accentEdge: string;
  /** Fill of the secondary button: a quiet tint that sits on the page, with cobalt text on top. */
  tonal: string;
  /** Edge of the secondary pill, for when its fill alone does not show against the ground. */
  tonalEdge: string;
  /** Only for overdue tasks and irreversible actions, always next to the written word. */
  red: string;
  /** Text and icons on a red fill (the destructive primary button). */
  onRed: string;
  /** Quiet separators that carry no meaning on their own. */
  hairline: string;
  /** Field borders and the dashed empty magnet: at least 3:1 on every ground. */
  outline: string;
  /** The door handle. */
  handle: string;
  /** Initials on a magnet: the deepest slate, readable on every magnet colour. */
  magnetInk: string;
  /** Thin ring around a magnet where its fill is light on the ground; 'transparent' for none. */
  magnetRing: string;
  magnet: Record<MagnetColor, string>;
  /** The fridge light revealed by pull-to-refresh. */
  light: { top: string; text: string; shelf: string };
  /** Scrim behind dialogs. */
  scrim: string;
};

// Pizarra y pósit: slate #2E3B41, pósit #F2D04B, paper #F3F4F0. The whole palette comes from the
// Pizarra y pósit spec (§1.1).
export const palettes: Record<Scheme, Palette> = {
  light: {
    page: '#F3F4F0',
    door: '#DCE3E1',
    note: '#FFFFFF',
    ink: '#1E2A2F',
    muted: '#56636A',
    mutedStrong: '#3F4A50',
    // Slate. It is also the colour of tappable text, so actions must differ by shape too.
    cobalt: '#2E3B41',
    onCobalt: '#F3F4F0',
    accent: '#F2D04B',
    onAccent: '#1E2A2F',
    // A darker pósit: the pill's edge on the paper (the yellow alone is only 1.4:1 there).
    accentEdge: '#A8891A',
    tonal: '#D3DCD9',
    tonalEdge: '#6F7B80',
    red: '#B3392F',
    onRed: '#FFFFFF',
    hairline: '#E3E7E3',
    outline: '#6F7B80',
    handle: '#6F7B80',
    magnetInk: '#151B1E',
    magnetRing: '#6F7B80',
    magnet: {
      teal: '#579488',
      coral: '#C9725C',
      sky: '#5B90BE',
      pink: '#B86E97',
      lilac: '#9284C8',
    },
    light: { top: '#FFFFFF', text: '#56636A', shelf: 'rgba(242,208,75,0.40)' },
    scrim: 'rgba(30,42,47,0.45)',
  },
  dark: {
    page: '#151B1E',
    door: '#27343A',
    note: '#1E272B',
    ink: '#ECEFEA',
    muted: '#A7B2B5',
    mutedStrong: '#CBD3D5',
    // The pósit is the colour of what can be tapped in dark mode.
    cobalt: '#F2D04B',
    onCobalt: '#151B1E',
    accent: '#F2D04B',
    onAccent: '#151B1E',
    accentEdge: '#F2D04B',
    tonal: '#34444B',
    tonalEdge: '#34444B',
    red: '#F08A80',
    onRed: '#151B1E',
    hairline: '#2C383E',
    outline: '#7F8B90',
    handle: '#7F8B90',
    magnetInk: '#151B1E',
    magnetRing: 'transparent',
    magnet: {
      teal: '#8FC3BA',
      coral: '#E39A85',
      sky: '#7FAED3',
      pink: '#D9A0C0',
      lilac: '#B3A6D9',
    },
    light: { top: '#2B3A40', text: '#DCE3E1', shelf: 'rgba(242,208,75,0.40)' },
    scrim: 'rgba(8,12,14,0.65)',
  },
};

export type NoteEdge = { borderWidth: number; borderColor: string };

/**
 * The edge of a note (and of anything drawn as one). In dark mode the note is barely lighter than
 * the page and the shadow is lost on slate, so a 1 dp hairline gives the paper its edge back; in
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

/** Width of the edge on every primary (pósit) button. */
export const PRIMARY_EDGE = 1.5;

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

/** Depth exists only on magnets and notes. Shadows are tinted with the slate ink, never grey. */
export const shadows: Record<Scheme, { magnet: Shadow; note: Shadow }> = {
  light: {
    magnet: {
      shadowColor: '#1E2A2F',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.32,
      shadowRadius: 5,
      elevation: 4,
    },
    note: {
      shadowColor: '#1E2A2F',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 2,
    },
  },
  dark: {
    magnet: {
      shadowColor: '#080C0E',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.55,
      shadowRadius: 6,
      elevation: 5,
    },
    note: {
      shadowColor: '#080C0E',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.45,
      shadowRadius: 10,
      elevation: 3,
    },
  },
};
