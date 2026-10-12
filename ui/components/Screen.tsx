import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useLayout } from '../useLayout';
import { useModalFill } from './ModalSheet';

/**
 * A plain scrolling screen. The content keeps the class gutter at the sides and never grows past
 * `contentMax`, centred; all four safe-area edges are kept clear (a side notch in landscape).
 */
export function Screen({ children }: { children: ReactNode }) {
  const { colors, space } = useTheme();
  const { contentMax, gutter } = useLayout();
  // Inside a modal sheet it is only as tall as its content (see ModalSheet).
  const { fill, avoidKeyboard } = useModalFill();
  return (
    <SafeAreaView
      edges={['top', 'right', 'bottom', 'left']}
      style={[fill, { backgroundColor: colors.page }]}
    >
      <KeyboardAvoidingView
        enabled={avoidKeyboard}
        style={fill}
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
