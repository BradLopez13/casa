import type { Ref } from 'react';
import { Platform, type TextInput } from 'react-native';
import { TextField } from './TextField';

const MONOSPACE = Platform.select({ ios: 'Menlo', default: 'monospace' });

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | undefined;
  testID?: string;
  ref?: Ref<TextInput>;
};

/** One-time code input: number pad, OS autofill from the SMS/email and a large monospaced font. */
export function CodeField({ label, value, onChangeText, error, testID, ref }: Props) {
  return (
    <TextField
      ref={ref}
      testID={testID}
      label={label}
      value={value}
      onChangeText={onChangeText}
      error={error}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={9}
      autoCorrect={false}
      inputStyle={{ fontFamily: MONOSPACE, fontSize: 28, letterSpacing: 4, textAlign: 'center' }}
    />
  );
}
