import { useState } from 'react';
import { Platform, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { buttonLook, pressedOpacity } from '../buttonLook';
import { modalTitleInline } from '../modalHeader';
import { useTheme } from '../theme';
import { INLINE_PILL_HEIGHT, MIN_TOUCH, PRIMARY_EDGE, displayFontBold } from '../tokens';

export function HeaderAction({
  testID,
  label,
  onPress,
  disabled = false,
  busy = false,
  strong = false,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  strong?: boolean;
}) {
  const { colors, radii, space, shadows } = useTheme();
  // A disabled main action waits as an empty outlined pill, like a disabled Button; a plain action
  // turns muted. Neither is faded, so the label stays readable.
  const look = buttonLook('primary', 'default', disabled ? 'disabled' : 'enabled', colors);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={space(1)}
      style={({ pressed }) => ({
        minWidth: MIN_TOUCH,
        minHeight: MIN_TOUCH,
        alignItems: strong ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
        opacity: pressedOpacity(pressed),
      })}
    >
      {/* The main action is a compact primary button (filled), so it stands apart from
          "Cancelar", a tertiary text action, by shape and not only by weight. No icon: the bar
          must leave the title room to stay on the actions' line at the default text size.
          Disabled, it waits as an empty outlined pill, like every disabled Button. */}
      <View
        style={
          strong
            ? {
                minHeight: INLINE_PILL_HEIGHT,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space(2),
                paddingHorizontal: space(4),
                borderRadius: radii.pill,
                borderWidth: PRIMARY_EDGE,
                borderColor: look.border,
                backgroundColor: look.fill,
                ...(disabled ? null : shadows.primary),
              }
            : null
        }
      >
        <Text
          style={{
            color: strong ? look.foreground : disabled ? colors.muted : colors.cobalt,
            fontSize: strong ? 16 : 15,
            fontWeight: '600',
            // A plain action ("Cancelar") is a tertiary action, underlined like every other one.
            textDecorationLine: !strong && !disabled ? 'underline' : 'none',
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

type Action = {
  testID: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Drawn as plain text instead of the pósit pill (another primary owns the screen). */
  quiet?: boolean;
};

const TITLE_SIZE = 20;

/**
 * The Cancel | title | Save bar of every modal (new and edit task, edit item, templates). The
 * title sits centred between the actions while it fits on one line; with large system text on a
 * phone it would be cut, so it moves to a line of its own under the actions instead, whole and
 * free to wrap (`modalTitleInline`). The actions keep their 44 dp targets either way.
 */
export function ModalHeader({
  title,
  cancel,
  action,
  step,
}: {
  title: string;
  cancel: Action;
  /** The main action, drawn as a pill. Left out when the form keeps its primary at the foot. */
  action?: Action;
  /** Padding above and below the bar, in `space()` steps. */
  step: number;
}) {
  const { colors, space } = useTheme();
  const [row, setRow] = useState(0);
  const [cancelWidth, setCancelWidth] = useState(0);
  const [saveWidth, setSaveWidth] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  const gap = space(2);
  const inline = modalTitleInline({
    row,
    gap,
    cancel: cancelWidth,
    save: action ? saveWidth : cancelWidth,
    title: titleWidth,
  });
  const width = (set: (w: number) => void) => (e: LayoutChangeEvent) =>
    set(Math.ceil(e.nativeEvent.layout.width));

  const titleStyle = {
    color: colors.ink,
    fontFamily: displayFontBold,
    fontSize: TITLE_SIZE,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  } as const;

  const heading = (
    <Text
      accessibilityRole="header"
      numberOfLines={inline ? 1 : undefined}
      style={
        inline
          ? { ...titleStyle, flex: 1, textAlign: 'center' }
          : { ...titleStyle, marginTop: space(1) }
      }
    >
      {title}
    </Text>
  );

  return (
    <View
      style={{
        paddingHorizontal: space(4),
        paddingVertical: space(step),
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
      }}
    >
      {/* The title on one line, unconstrained and unseen: what it would need beside the actions. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: 0, top: 0, opacity: 0, flexDirection: 'row' }}
      >
        <Text
          numberOfLines={1}
          style={titleStyle}
          onLayout={width(setTitleWidth)}
        >
          {title}
        </Text>
      </View>
      <View onLayout={width(setRow)} style={{ flexDirection: 'row', alignItems: 'center', gap }}>
        <View onLayout={width(setCancelWidth)}>
          <HeaderAction {...cancel} />
        </View>
        {inline ? heading : <View style={{ flex: 1 }} />}
        {action ? (
          <View onLayout={width(setSaveWidth)}>
            <HeaderAction {...action} strong={!action.quiet} />
          </View>
        ) : (
          // No main action: an empty slot as wide as Cancel keeps the title centred.
          <View style={{ width: cancelWidth }} />
        )}
      </View>
      {inline ? null : heading}
    </View>
  );
}
