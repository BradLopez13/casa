import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useLayout } from '../useLayout';

/**
 * A plain scrolling screen. The content keeps the class gutter at the sides and never grows past
 * `contentMax`, centred; all four safe-area edges are kept clear (a side notch in landscape).
 */
export function Screen({ children }: { children: ReactNode }) {
  const { colors, space } = useTheme();
  const { contentMax, gutter } = useLayout();
  return (
    <SafeAreaView
      edges={['top', 'right', 'bottom', 'left']}
      style={{ flex: 1, backgroundColor: colors.page }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: gutter,
            paddingTop: space(6),
            paddingBottom: space(8),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              flexGrow: 1,
              width: '100%',
              maxWidth: contentMax,
              alignSelf: 'center',
              gap: space(4),
            }}
          >
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
