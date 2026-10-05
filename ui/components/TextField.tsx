import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
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
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...inputProps}
        style={{
          minHeight: 48,
          paddingHorizontal: space(4),
          paddingVertical: space(3),
          borderRadius: radii.note,
          // Same width in every state, so focusing never shifts the text.
          borderWidth: 2,
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
