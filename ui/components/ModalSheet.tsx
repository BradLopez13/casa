import { createContext, useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHEET_WIDTH } from '../layout';
import { modalFrameFor, sheetMargins } from '../sheet';
import { useTheme } from '../theme';
import { useLayout } from '../useLayout';

const InSheet = createContext(false);

/**
 * How the column of a modal fills its frame: the whole screen on a phone in portrait (as before),
 * or only as tall as its content inside the sheet, shrinking to scroll when it is longer. Inside
 * the sheet the keyboard is avoided by the sheet itself, so the form's own avoidance is off.
 */
export function useModalFill(): { fill: { flex: 1 } | { flexShrink: 1 }; avoidKeyboard: boolean } {
  const inSheet = useContext(InSheet);
  return inSheet
    ? { fill: { flexShrink: 1 }, avoidKeyboard: false }
    : { fill: { flex: 1 }, avoidKeyboard: true };
}

/**
 * The frame of the four modal routes. On a phone in portrait the modal fills the screen, as it
 * always has. From `medium` up it is a centred sheet: 560 dp wide at most, never taller than 90 %
 * of the window, with rounded corners over the theme's scrim. Tapping the scrim does nothing; the
 * modal still closes only with its own buttons or with back.
 *
 * The tree is the same in both frames and only the styles change, so rotating with the modal
 * open (or the keyboard up) keeps the route mounted and whatever was typed.
 */
export function ModalSheet({ children }: { children: ReactNode }) {
  const { colors, radii } = useTheme();
  const layout = useLayout();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheet = modalFrameFor(layout) === 'sheet';
  const margins = sheetMargins(height, layout.gutter, insets);

  return (
    <View
      accessibilityViewIsModal
      style={{ flex: 1, backgroundColor: sheet ? colors.scrim : colors.page }}
    >
      <KeyboardAvoidingView
        enabled={sheet}
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={
            sheet
              ? {
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: margins.top,
                  paddingRight: margins.right,
                  paddingBottom: margins.bottom,
                  paddingLeft: margins.left,
                }
              : { flex: 1 }
          }
        >
          <View
            style={
              sheet
                ? {
                    width: '100%',
                    maxWidth: SHEET_WIDTH,
                    flexShrink: 1,
                    overflow: 'hidden',
                    borderRadius: radii.note,
                    // The edge stays visible in dark mode, where page and scrim are close.
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    backgroundColor: colors.page,
                  }
                : { flex: 1 }
            }
          >
            <InSheet.Provider value={sheet}>{children}</InSheet.Provider>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
