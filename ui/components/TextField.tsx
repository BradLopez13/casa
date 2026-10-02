import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme';
import { ErrorText } from './ErrorText';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | undefined;
  testID?: string;
};

export function TextField({ label, error, testID, ...inputProps }: Props) {
  const { colors, space } = useTheme();
  return (
    <View style={{ gap: space(1) }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...inputProps}
        style={{
          minHeight: 44,
          paddingHorizontal: space(3),
          borderRadius: space(2),
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          fontSize: 16,
        }}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}
