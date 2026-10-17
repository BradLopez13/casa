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
  /** Paper of a task (the notes of Hoy and Tareas): a soft pósit in light, the dark note in dark. */
  taskNote: string;
  ink: string;
  muted: string;
  /** Replaces `muted` when the phone asks for higher contrast. */
  mutedStrong: string;
  /** Text of what can be tapped: ghost buttons, links, the active tab, the caret. Slate in light, chalk in dark. */
  cobalt: string;
  /** Background of selected text in a field: the ink at 30%, so the text stays readable on top. */
  textSelection: string;
  /** Fill of the main action pill: the pósit, in both themes. */
  accent: string;
  /** Text and icons on the accent fill. */
  onAccent: string;
  /** Edge of the accent pill. Equals `accent` (no visible edge): the pill is told apart by its shadow in light mode. */
  accentEdge: string;
  /** Fill of a chosen option or an "on" track: slate in light, the pósit in dark. At least 3:1 on page, note and door. */
  selection: string;
  /** Text and icons on a selection fill. */
  onSelection: string;
  /** Keyboard focus ring: at least 3:1 on page, note and door. */
  focusRing: string;
  /** The slate band behind the brand on the sign-in screens, the same in both themes. */
  brandBand: string;
  /** Chalk text and the symbol's left figure on the brand band, the same in both themes. */
  onBrandBand: string;
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
  /** Initials on a magnet: the deepest slate, readable on every magnet colour. */
  magnetInk: string;
  /** Soft translucent ring around a magnet to keep its edge on the ground; 'transparent' for none. */
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
    taskNote: '#FDF8E6',
    ink: '#1E2A2F',
    muted: '#56636A',
    mutedStrong: '#3F4A50',
    // Slate. It is also the colour of tappable text, so actions must differ by shape too.
    cobalt: '#2E3B41',
    textSelection: 'rgba(30,42,47,0.3)',
    accent: '#F2D04B',
    onAccent: '#1E2A2F',
    accentEdge: '#F2D04B',
    selection: '#2E3B41',
    onSelection: '#F3F4F0',
    focusRing: '#1E2A2F',
    brandBand: '#2E3B41',
    onBrandBand: '#F3F4F0',
    tonal: '#D3DCD9',
    tonalEdge: '#6F7B80',
    red: '#B3392F',
    onRed: '#FFFFFF',
    hairline: '#E3E7E3',
    outline: '#6F7B80',
    magnetInk: '#151B1E',
    magnetRing: 'rgba(21,27,30,0.35)',
    magnet: {
      teal: '#579488',
      leaf: '#6E9A4E',
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
    taskNote: '#1E272B',
    ink: '#ECEFEA',
    muted: '#A7B2B5',
    mutedStrong: '#CBD3D5',
    // Chalk: the pósit is kept for what is chosen and the main action.
    cobalt: '#ECEFEA',
    textSelection: 'rgba(236,239,234,0.3)',
    accent: '#F2D04B',
    onAccent: '#151B1E',
    accentEdge: '#F2D04B',
    selection: '#F2D04B',
    onSelection: '#151B1E',
    focusRing: '#ECEFEA',
    brandBand: '#2E3B41',
    onBrandBand: '#F3F4F0',
    tonal: '#34444B',
    tonalEdge: '#34444B',
    red: '#F08A80',
    onRed: '#151B1E',
    hairline: '#2C383E',
    outline: '#7F8B90',
    magnetInk: '#151B1E',
    magnetRing: 'transparent',
    magnet: {
      teal: '#8FC3BA',
      leaf: '#A5C98A',
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

export const radii = { note: 14, door: 30, pill: 999 } as const;

export const magnetSizes = { lg: 50, md: 38, sm: 26 } as const;
export type MagnetSize = keyof typeof magnetSizes;

/** Initial size inside each magnet. */
export const magnetInitialSizes: Record<MagnetSize, number> = { lg: 21, md: 16, sm: 12 };

/** Loaded in app/_layout.tsx; used only for screen titles, day numbers and magnet initials. */
export const displayFont = 'MPLUSRounded1c_800ExtraBold';
/** Same family, bold weight: loaded next to the 800 in app/_layout.tsx. */
export const displayFontBold = 'MPLUSRounded1c_700Bold';

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
export const shadows: Record<Scheme, { magnet: Shadow; note: Shadow; primary: Shadow }> = {
  light: {
    magnet: {
      shadowColor: '#1E2A2F',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.22,
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
    // The main pill: same lift as a note, which is what tells it from the page without an edge.
    primary: {
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
    // No shadow: on slate the yellow pill already stands out by itself.
    primary: {
      shadowColor: '#080C0E',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },
};
