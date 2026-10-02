import { useColorScheme } from 'react-native';

const palettes = {
  light: {
    bg: '#f7f5f0',
    surface: '#ffffff',
    text: '#1d1b16',
    muted: '#6b665c',
    primary: '#2f6f5e',
    danger: '#b3261e',
    border: '#e0dbcf',
  },
  dark: {
    bg: '#14130f',
    surface: '#1f1d18',
    text: '#f1ede4',
    muted: '#a39e91',
    primary: '#6fc2a9',
    danger: '#f2b8b5',
    border: '#38352d',
  },
};

export type Colors = typeof palettes.light;

export function space(n: number): number {
  return n * 4;
}

export function useTheme(): { colors: Colors; space: (n: number) => number } {
  const scheme = useColorScheme();
  return { colors: scheme === 'dark' ? palettes.dark : palettes.light, space };
}
