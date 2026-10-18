import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { ActionIcon } from '../actionIcons';
import {
  buttonLook,
  buttonMetrics,
  pressedOpacity,
  type ButtonTone,
  type ButtonVariant,
} from '../buttonLook';
import { useTheme } from '../theme';
import { PRIMARY_EDGE } from '../tokens';

type Props = {
  title: string;
  onPress: () => void;
  testID?: string;
  loading?: boolean;
  disabled?: boolean;
  /** primary: the one main action. secondary: a tonal pill. tertiary: bare text. */
  variant?: ButtonVariant;
  /** destructive swaps cobalt for red; not available on secondary. */
  tone?: ButtonTone;
  /** Drawn before the label; hidden from screen readers, which hear the title. */
  icon?: ActionIcon;
  /** full: stretches to its container. hug: only as wide as its content. */
  width?: 'full' | 'hug';
};

export function Button({
  title,
  onPress,
  testID,
  loading = false,
  disabled = false,
  variant = 'primary',
  tone = 'default',
  icon,
  width = 'hug',
}: Props) {
  const { colors, radii, shadows } = useTheme();
  const [focused, setFocused] = useState(false);
  const inactive = disabled || loading;
  const { fill, border, foreground, labelOpacity } = buttonLook(
    variant,
    tone,
    loading ? 'busy' : disabled ? 'disabled' : 'enabled',
    colors,
  );
  const m = buttonMetrics(variant);

  return (
    <View style={width === 'hug' ? { alignSelf: 'flex-start' } : undefined}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        hitSlop={variant === 'secondary' ? { top: 2, bottom: 2 } : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => ({
          minHeight: m.minHeight,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: m.paddingH,
          paddingVertical: m.paddingV,
          borderRadius: radii.pill,
          borderWidth: border === 'transparent' ? 0 : PRIMARY_EDGE,
          borderColor: border,
          backgroundColor: fill,
          opacity: pressedOpacity(pressed),
          ...(variant === 'primary' && !disabled ? shadows.primary : null),
        })}
      >
        {loading ? (
          <ActivityIndicator color={foreground} />
        ) : (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: labelOpacity }}
          >
            {icon ? (
              <Ionicons
                name={icon}
                size={m.iconSize}
                color={foreground}
                accessible={false}
                importantForAccessibility="no"
              />
            ) : null}
            <Text
              style={{
                color: foreground,
                fontSize: m.fontSize,
                fontWeight: '600',
                textAlign: 'center',
                textDecorationLine: m.underline && !inactive ? 'underline' : 'none',
                flexShrink: 1,
              }}
            >
              {title}
            </Text>
          </View>
        )}
      </Pressable>
      {/* Keyboard focus ring, drawn outside the pill so the button keeps the field's width. */}
      {focused ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            bottom: -4,
            left: -4,
            borderRadius: radii.pill,
            borderWidth: 2,
            borderColor: colors.focusRing,
          }}
        />
      ) : null}
    </View>
  );
}
