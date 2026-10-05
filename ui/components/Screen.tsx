import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export function Screen({ children }: { children: ReactNode }) {
  const { colors, space } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: space(5),
            paddingTop: space(6),
            paddingBottom: space(8),
            gap: space(4),
          }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
