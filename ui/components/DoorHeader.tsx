import { createContext, useContext, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { displayFont } from '../tokens';

/** True when a parent (FridgeRefresh) already paints the door colour under the status bar. */
export const DoorInsetContext = createContext(false);

type Props = {
  title: string;
  subtitle?: string;
  /** 'large' for Hoy (44), 'medium' for Tareas (38). */
  titleSize?: 'large' | 'medium';
  titleTestID?: string;
  children?: ReactNode;
};

const TITLE_SIZES = { large: 44, medium: 38 } as const;

/** The enamel door at the top of a main screen, with its handle on the right edge. */
export function DoorHeader({ title, subtitle, titleSize = 'large', titleTestID, children }: Props) {
  const { colors, radii, space } = useTheme();
  const insets = useSafeAreaInsets();
  const insetHandled = useContext(DoorInsetContext);
  const top = insetHandled ? 0 : insets.top;
  const size = TITLE_SIZES[titleSize];

  return (
    <View
      style={{
        backgroundColor: colors.door,
        borderBottomLeftRadius: radii.door,
        borderBottomRightRadius: radii.door,
        paddingTop: top + space(3),
        paddingBottom: space(6),
        paddingLeft: space(5) + insets.left,
        // Room for the handle, so nothing runs under it.
        paddingRight: space(10) + insets.right,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          right: space(4) + insets.right,
          top: top + space(6),
          width: 8,
          height: 96,
          borderRadius: 4,
          backgroundColor: colors.handle,
        }}
      />
      <Text
        testID={titleTestID}
        accessibilityRole="header"
        maxFontSizeMultiplier={1.3}
        style={{
          color: colors.ink,
          fontFamily: displayFont,
          fontSize: size,
          lineHeight: Math.round(size * 1.15),
          letterSpacing: -size * 0.025,
          ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            marginTop: space(1),
            color: colors.muted,
            fontSize: 15,
            fontVariant: ['tabular-nums'],
          }}
        >
          {subtitle}
        </Text>
      ) : null}
      {children ? <View style={{ marginTop: space(5) }}>{children}</View> : null}
    </View>
  );
}
