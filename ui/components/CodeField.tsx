import { Platform } from 'react-native';
import { TextField } from './TextField';

const MONOSPACE = Platform.select({ ios: 'Menlo', default: 'monospace' });

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | undefined;
  testID?: string;
};

/** One-time code input: number pad, OS autofill from the SMS/email and a large monospaced font. */
export function CodeField({ label, value, onChangeText, error, testID }: Props) {
  return (
    <TextField
      testID={testID}
      label={label}
      value={value}
      onChangeText={onChangeText}
      error={error}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={7}
      autoCorrect={false}
      inputStyle={{ fontFamily: MONOSPACE, fontSize: 28, letterSpacing: 4, textAlign: 'center' }}
    />
  );
}
