import { createContext, useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View, useWindowDimensions } from 'react-native';
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
  type Edge,
} from 'react-native-safe-area-context';
import { SHEET_WIDTH } from '../layout';
import { modalFrameFor, sheetMargins } from '../sheet';
import { useTheme } from '../theme';
import { useLayout } from '../useLayout';

const InSheet = createContext(false);

const ALL_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];
const NO_EDGES: Edge[] = [];
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

type ModalFill = {
  fill: { flex: 1 } | { flexShrink: 1 };
  avoidKeyboard: boolean;
  /** The safe-area edges the modal's own SafeAreaView keeps clear. */
  edges: Edge[];
};

/**
 * How the column of a modal fills its frame: the whole screen on a phone in portrait (as before),
 * or only as tall as its content inside the sheet, shrinking to scroll when it is longer. Inside
 * the sheet the keyboard is avoided by the sheet itself, so the form's own avoidance is off, and
 * the system bars and notches are kept clear by the sheet's margins, so the content adds no safe
 * area of its own (no band above the header, no header pushed in by a side notch).
 */
export function useModalFill(): ModalFill {
  const inSheet = useContext(InSheet);
  return inSheet
    ? { fill: { flexShrink: 1 }, avoidKeyboard: false, edges: NO_EDGES }
    : { fill: { flex: 1 }, avoidKeyboard: true, edges: ALL_EDGES };
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
            <InSheet.Provider value={sheet}>
              {/* Inside the sheet, anything that reads the insets itself sees none. Always
                  provided, so a rotation does not change the tree (and remount the form). */}
              <SafeAreaInsetsContext.Provider value={sheet ? NO_INSETS : insets}>
                {children}
              </SafeAreaInsetsContext.Provider>
            </InSheet.Provider>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
