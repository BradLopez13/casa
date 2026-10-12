import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useFocusReveal } from '../focusReveal';
import { useTheme } from '../theme';
import { ErrorText } from './ErrorText';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | undefined;
  testID?: string;
};

export function TextField({ label, error, testID, onFocus, onBlur, ...inputProps }: Props) {
  const { colors, radii, space } = useTheme();
  const [focused, setFocused] = useState(false);
  // Inside a form that keeps the focused field above the keyboard (CenteredCard).
  const reveal = useFocusReveal();
  return (
    <View style={{ gap: space(2) }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={error ? `${label}, ${error}` : label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.cobalt}
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
          minHeight: 48,
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
        }}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}
