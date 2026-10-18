import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FocusRevealContext } from '../focusReveal';
import { authBeside } from '../layout';
import { useTheme } from '../theme';
import { useLayout } from '../useLayout';
import { useRevealFocusedField } from '../useRevealFocusedField';

/** About the width of a phone in portrait: a form never reads wider than this. */
const CARD_WIDTH = 480;
/** The note split in two columns (`aside`), on a phone on its side. */
const WIDE_CARD_WIDTH = 880;

/**
 * The screen for sign-in, sign-up, onboarding and invite. On a phone in portrait (`compact`) it is
 * a plain column across the width, inside the gutter, exactly like `Screen`. From `medium` it is
 * one note on the fridge: about 480 dp wide, centred both ways, with the note's own depth. The
 * fields already carry an outline, so they still read on the note colour. With the keyboard up,
 * the focused field is kept in view (every TextField inside asks for it on focus).
 *
 * A `header` (the brand band) goes above the padded column and runs the full width of the window,
 * under the status bar: it handles the top and side insets itself. On a phone on its side
 * (`authBeside`) the band stands at the left instead, and an `aside` (the title and the quick ways
 * in) takes a column of its own beside the fields, so the main button stays above the fold.
 */
export function CenteredCard({
  children,
  header,
  aside,
}: {
  children: ReactNode;
  header?: ReactNode;
  aside?: ReactNode;
}) {
  const { colors, radii, shadows, noteEdge, space } = useTheme();
  const layout = useLayout();
  const { size, gutter, shortHeight } = layout;
  const { scroll, reveal } = useRevealFocusedField();
  const insets = useSafeAreaInsets();
  const card = size !== 'compact';
  const beside = header !== undefined && authBeside(layout);
  const columns = beside && aside !== undefined;
  // A phone on its side has little height: less air around and inside the card, least of all
  // with the band at the side, where the form has the whole height to itself.
  const air = beside ? space(2) : shortHeight ? space(4) : space(8);
  const notePadding = beside ? space(4) : shortHeight ? space(6) : space(8);
  // With a header the sides are padded here, so the band itself can reach the edges.
  const sideLeft = gutter + (header && !beside ? insets.left : 0);
  const sideRight = gutter + (header ? insets.right : 0);
  const body = (
    <FocusRevealContext.Provider value={reveal}>
      {columns ? (
        <View style={{ flexDirection: 'row', gap: space(8) }}>
          <View style={{ flex: 1, gap: space(4) }}>{aside}</View>
          <View style={{ flex: 1, gap: space(4) }}>{children}</View>
        </View>
      ) : (
        <>
          {aside}
          {children}
        </>
      )}
    </FocusRevealContext.Provider>
  );

  return (
    <SafeAreaView
      edges={beside ? [] : header ? ['bottom'] : ['top', 'right', 'bottom', 'left']}
      style={{
        flex: 1,
        backgroundColor: colors.page,
        flexDirection: beside ? 'row' : 'column',
      }}
    >
      {beside ? header : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          {...scroll}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          // The slate band reaches the top edge: an iOS overscroll would show the cream page above it.
          bounces={!header}
        >
          {beside ? null : header}
          <View
            style={{
              flexGrow: 1,
              paddingLeft: sideLeft,
              paddingRight: sideRight,
              paddingTop: (beside ? insets.top : 0) + (card ? air : space(6)),
              paddingBottom: (beside ? insets.bottom : 0) + (card ? air : space(8)),
              // Taller than the window, it simply scrolls from the top.
              justifyContent: card ? 'center' : 'flex-start',
            }}
          >
            <View
              style={[
                { width: '100%', alignSelf: 'center', gap: space(4) },
                card
                  ? {
                      maxWidth: columns ? WIDE_CARD_WIDTH : CARD_WIDTH,
                      backgroundColor: colors.note,
                      borderRadius: radii.note,
                      paddingHorizontal: space(8),
                      paddingVertical: notePadding,
                      ...shadows.note,
                      ...noteEdge,
                    }
                  : null,
              ]}
            >
              {body}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
