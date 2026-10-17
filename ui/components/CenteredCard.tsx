import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FocusRevealContext } from '../focusReveal';
import { useTheme } from '../theme';
import { useLayout } from '../useLayout';
import { useRevealFocusedField } from '../useRevealFocusedField';

/** About the width of a phone in portrait: a form never reads wider than this. */
const CARD_WIDTH = 480;

/**
 * The screen for sign-in, sign-up, onboarding and invite. On a phone in portrait (`compact`) it is
 * a plain column across the width, inside the gutter, exactly like `Screen`. From `medium` it is
 * one note on the fridge: about 480 dp wide, centred both ways, with the note's own depth. The
 * fields already carry an outline, so they still read on the note colour. With the keyboard up,
 * the focused field is kept in view (every TextField inside asks for it on focus).
 *
 * A `header` (the brand band) goes above the padded column and runs the full width of the window,
 * under the status bar: it handles the top and side insets itself.
 */
export function CenteredCard({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const { colors, radii, shadows, noteEdge, space } = useTheme();
  const { size, gutter, shortHeight } = useLayout();
  const { scroll, reveal } = useRevealFocusedField();
  const insets = useSafeAreaInsets();
  const card = size !== 'compact';
  // A phone on its side has little height: less air around and inside the card.
  const air = shortHeight ? space(4) : space(8);
  // With a header the sides are padded here, so the band itself can reach the edges.
  const sideLeft = gutter + (header ? insets.left : 0);
  const sideRight = gutter + (header ? insets.right : 0);

  return (
    <SafeAreaView
      edges={header ? ['bottom'] : ['top', 'right', 'bottom', 'left']}
      style={{ flex: 1, backgroundColor: colors.page }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          {...scroll}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {header}
          <View
            style={{
              flexGrow: 1,
              paddingLeft: sideLeft,
              paddingRight: sideRight,
              paddingTop: card ? air : space(6),
              paddingBottom: card ? air : space(8),
              // Taller than the window, it simply scrolls from the top.
              justifyContent: card ? 'center' : 'flex-start',
            }}
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
                      ...noteEdge,
                    }
                  : null,
              ]}
            >
              <FocusRevealContext.Provider value={reveal}>{children}</FocusRevealContext.Provider>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
