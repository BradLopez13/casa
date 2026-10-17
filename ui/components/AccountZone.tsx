import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { Divider } from './Divider';

/** The quiet bottom zone for account actions: a hairline, then the actions in a wrapping row. */
export function AccountZone({ children }: { children: ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ marginTop: space(8), gap: space(4) }}>
      <Divider />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          rowGap: space(6),
        }}
      >
        {children}
      </View>
    </View>
  );
}
