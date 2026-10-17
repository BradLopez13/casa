import { useState, type ReactNode, type Ref } from 'react';
import { Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';
import { useFocusReveal } from '../focusReveal';
import { useTheme } from '../theme';
import { CONTROL_HEIGHT } from '../tokens';
import { ErrorText } from './ErrorText';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | undefined;
  testID?: string;
  /** Extra text style for the input (font, size, spacing). */
  inputStyle?: TextStyle;
  /** Sits inside the input's box, on the right (e.g. a show/hide eye). */
  trailing?: ReactNode;
  ref?: Ref<TextInput>;
  /**
   * No visible label and no box: the label is only read by screen readers, and a 2 dp bottom line
   * (`focusRing` while focused, `hairline` otherwise) is the whole field. For the task title.
   */
  bare?: boolean;
};

export function TextField({
  label,
  error,
  testID,
  inputStyle,
  trailing,
  ref,
  bare = false,
  onFocus,
  onBlur,
  ...inputProps
}: Props) {
  const { colors, radii, space } = useTheme();
  const [focused, setFocused] = useState(false);
  // Inside a form that keeps the focused field above the keyboard (CenteredCard, modal forms).
  const reveal = useFocusReveal();
  return (
    <View style={{ gap: space(2) }}>
      {bare ? null : (
        <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}>{label}</Text>
      )}
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={error ? `${label}, ${error}` : label}
          placeholderTextColor={colors.muted}
          selectionColor={colors.textSelection}
          cursorColor={colors.cobalt}
          onFocus={(e) => {
            setFocused(true);
            reveal();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...inputProps}
          style={{
            minHeight: CONTROL_HEIGHT,
            // An error thickens the border by one point; the padding gives that point back, so
            // the text never shifts. Focus keeps the normal width, so the two never look alike
            // even where cobalt and ink are the same colour.
            paddingHorizontal: space(4) - (error ? 1 : 0),
            paddingVertical: space(3) - (error ? 1 : 0),
            borderRadius: radii.note,
            borderWidth: error ? 3 : 2,
            borderColor: focused ? colors.cobalt : error ? colors.ink : colors.outline,
            backgroundColor: colors.note,
            color: colors.ink,
            fontSize: 17,
            ...(trailing ? { paddingRight: 52 - (error ? 1 : 0) } : null),
            ...(bare
              ? {
                  paddingHorizontal: 0,
                  borderRadius: 0,
                  borderWidth: 0,
                  borderBottomWidth: 2,
                  borderColor: focused ? colors.focusRing : colors.hairline,
                  backgroundColor: 'transparent',
                }
              : null),
            ...inputStyle,
          }}
        />
        {trailing ? (
          <View
            style={{
              position: 'absolute',
              right: 4,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {trailing}
          </View>
        ) : null}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}
