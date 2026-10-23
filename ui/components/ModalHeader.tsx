import { useState } from 'react';
import { Platform, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { buttonLook, pressedOpacity } from '../buttonLook';
import { modalTitleInline } from '../modalHeader';
import { useTheme } from '../theme';
import { MIN_TOUCH, displayFontBold } from '../tokens';
import { SheetDragArea } from './SheetDrag';

type Action = {
  testID: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/** The bar's text action («Cancelar», «Volver»): a tertiary action, underlined like every other. */
function HeaderAction({ testID, label, onPress, disabled = false }: Action) {
  const { colors, space } = useTheme();
  const look = buttonLook('tertiary', 'default', disabled ? 'disabled' : 'enabled', colors);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      hitSlop={space(1)}
      style={({ pressed }) => ({
        minWidth: MIN_TOUCH,
        minHeight: MIN_TOUCH,
        alignItems: 'flex-start',
        justifyContent: 'center',
        opacity: pressedOpacity(pressed),
      })}
    >
      <Text
        style={{
          color: look.foreground,
          opacity: look.labelOpacity,
          fontSize: 15,
          fontWeight: '600',
          textDecorationLine: disabled ? 'none' : 'underline',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const TITLE_SIZE = 20;

/**
 * The one header of every sheet and secondary screen (new and edit task, edit item, templates,
 * members): a text action on the left («Cancelar» or «Volver») and the title, in one size,
 * centred. The main action never sits here: it is the pósit at the foot. The title stays centred
 * between the action and an empty slot as wide while it fits on one line; with large system text
 * on a phone it would be cut, so it moves to a line of its own under the action instead, whole
 * and free to wrap (`modalTitleInline`). Inside a sheet the bar is also its handle: pulling it
 * down does what the action does.
 */
export function ModalHeader({
  title,
  cancel,
  step,
}: {
  title: string;
  cancel: Action;
  /** Padding above and below the bar, in `space()` steps. */
  step: number;
}) {
  const { colors, space } = useTheme();
  const [row, setRow] = useState(0);
  const [cancelWidth, setCancelWidth] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  const gap = space(2);
  const inline = modalTitleInline({
    row,
    gap,
    cancel: cancelWidth,
    save: cancelWidth,
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
    <SheetDragArea onDismiss={cancel.onPress} enabled={!cancel.disabled}>
      <View
        style={{
          paddingHorizontal: space(4),
          paddingVertical: space(step),
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
        }}
      >
        {/* The title on one line, unconstrained and unseen: what it would need beside the action. */}
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', left: 0, top: 0, opacity: 0, flexDirection: 'row' }}
        >
          <Text numberOfLines={1} style={titleStyle} onLayout={width(setTitleWidth)}>
            {title}
          </Text>
        </View>
        <View onLayout={width(setRow)} style={{ flexDirection: 'row', alignItems: 'center', gap }}>
          <View onLayout={width(setCancelWidth)}>
            <HeaderAction {...cancel} />
          </View>
          {inline ? heading : <View style={{ flex: 1 }} />}
          {/* An empty slot as wide as the action keeps the title centred. */}
          <View style={{ width: cancelWidth }} />
        </View>
        {inline ? null : heading}
      </View>
    </SheetDragArea>
  );
}
