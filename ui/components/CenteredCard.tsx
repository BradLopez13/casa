import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useLayout } from '../useLayout';

/** About the width of a phone in portrait: a form never reads wider than this. */
const CARD_WIDTH = 480;

/**
 * The screen for sign-in, sign-up, onboarding and invite. On a phone in portrait (`compact`) it is
 * a plain column across the width, inside the gutter, exactly like `Screen`. From `medium` it is
 * one note on the fridge: about 480 dp wide, centred both ways, with the note's own depth. The
 * fields already carry an outline, so they still read on the note colour.
 */
export function CenteredCard({ children }: { children: ReactNode }) {
  const { colors, radii, shadows, space } = useTheme();
  const { size, gutter, shortHeight } = useLayout();
  const card = size !== 'compact';
  // A phone on its side has little height: less air around and inside the card.
  const air = shortHeight ? space(4) : space(8);

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
            paddingTop: card ? air : space(6),
            paddingBottom: card ? air : space(8),
            // Taller than the window, it simply scrolls from the top.
            justifyContent: card ? 'center' : 'flex-start',
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              { width: '100%', alignSelf: 'center', gap: space(4) },
              card
                ? {
                    maxWidth: CARD_WIDTH,
                    backgroundColor: colors.note,
                    borderRadius: radii.note,
                    paddingHorizontal: space(8),
                    paddingVertical: shortHeight ? space(6) : space(8),
                    ...shadows.note,
                  }
                : null,
            ]}
          >
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
