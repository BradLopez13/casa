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
  /** Only for overdue tasks, always next to the written word. */
  red: string;
  /** Quiet separators that carry no meaning on their own. */
  hairline: string;
  /** Field borders and the dashed empty magnet: at least 3:1 on every ground. */
  outline: string;
  /** The door handle. */
  handle: string;
  /** Initials on a magnet. */
  magnetInk: string;
  magnet: Record<MagnetColor, string>;
  /** The fridge light revealed by pull-to-refresh. */
  light: { top: string; text: string; shelf: string };
  /** Scrim behind dialogs. */
  scrim: string;
};

export const palettes: Record<Scheme, Palette> = {
  light: {
    page: '#F3F5F7',
    door: '#D5E2EC',
    note: '#FFFFFF',
    ink: '#1A222B',
    muted: '#56626E',
    mutedStrong: '#3A444E',
    cobalt: '#2D4FA8',
    onCobalt: '#FFFFFF',
    red: '#B4382E',
    hairline: '#E1E6EA',
    outline: '#6E7A86',
    handle: '#B7C3CD',
    magnetInk: '#1A222B',
    magnet: {
      mustard: '#D9A740',
      sage: '#6FA383',
      coral: '#DD8C6C',
      // #4C8E9C reached only 4.33:1 under the initial; one step lighter, same hue.
      petrol: '#4F93A1',
      pink: '#D58BA8',
    },
    light: { top: '#FFF3CF', text: '#6B5E3A', shelf: 'rgba(150,130,80,0.25)' },
    scrim: 'rgba(26,34,43,0.5)',
  },
  dark: {
    page: '#11171D',
    door: '#1D2B37',
    note: '#1A232C',
    ink: '#E6EBEF',
    muted: '#98A4AF',
    mutedStrong: '#BCC6CF',
    cobalt: '#8EA8F0',
    onCobalt: '#11171D',
    red: '#F08A80',
    hairline: '#26313C',
    outline: '#6B7782',
    handle: '#3D4A54',
    magnetInk: '#1A222B',
    magnet: {
      mustard: '#E3B65A',
      sage: '#86B898',
      coral: '#E8A285',
      petrol: '#69A7B4',
      pink: '#E2A2BB',
    },
    light: { top: '#5C5440', text: '#E9DDB8', shelf: 'rgba(233,221,184,0.22)' },
    scrim: 'rgba(0,0,0,0.6)',
  },
};

export const radii = { day: 12, note: 14, door: 30, pill: 999 } as const;

export const magnetSizes = { lg: 50, md: 38, sm: 26 } as const;
export type MagnetSize = keyof typeof magnetSizes;

/** Initial size inside each magnet. */
export const magnetInitialSizes: Record<MagnetSize, number> = { lg: 21, md: 16, sm: 12 };

/** Loaded in app/_layout.tsx; used only for screen titles, day numbers and magnet initials. */
export const displayFont = 'MPLUSRounded1c_800ExtraBold';

export const MIN_TOUCH = 44;

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

/** Depth exists only on magnets and notes. */
export const shadows: Record<Scheme, { magnet: Shadow; note: Shadow }> = {
  light: {
    magnet: {
      shadowColor: '#1A222B',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.32,
      shadowRadius: 5,
      elevation: 4,
    },
    note: {
      shadowColor: '#1A222B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 2,
    },
  },
  dark: {
    magnet: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.55,
      shadowRadius: 6,
      elevation: 5,
    },
    note: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.45,
      shadowRadius: 10,
      elevation: 3,
    },
  },
};
