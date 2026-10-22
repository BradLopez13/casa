import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { Divider } from './Divider';

/**
 * The quiet bottom zone for leaving: a hairline, then one action per line, as Ajustes keeps
 * «Cerrar sesión» and «Borrar mi cuenta…». Side by side, «Salir del hogar» and «Borrar hogar»
 * read as one choice (fase 10a).
 */
export function AccountZone({ children }: { children: ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ marginTop: space(8), gap: space(4) }}>
      <Divider />
      <View style={{ alignItems: 'flex-start', gap: space(2) }}>{children}</View>
    </View>
  );
}
