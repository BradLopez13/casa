import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, type TextInput } from 'react-native';
import { t } from '@/i18n';
import { passwordToggle } from '../passwordToggle';
import { useTheme } from '../theme';
import { TextField } from './TextField';

type FieldProps = Parameters<typeof TextField>[0];
type Props = Omit<FieldProps, 'secureTextEntry' | 'trailing' | 'ref'>;

export function PasswordField({ testID, inputStyle, onChangeText, value, ...rest }: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const wasFocused = useRef(false);
  const typedLength = useRef(0);
  const toggle = passwordToggle(visible);
  const label = t(toggle.labelKey);

  const onToggle = () => {
    const next = !visible;
    setVisible(next);
    AccessibilityInfo.announceForAccessibility(t(passwordToggle(next).labelKey));
    if (wasFocused.current) {
      const end = value?.length ?? typedLength.current;
      // Toggling secureTextEntry can drop the focus and reset the caret on Android.
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelection(end, end);
      }, 0);
    }
  };

  return (
    <TextField
      {...rest}
      ref={inputRef}
      testID={testID}
      value={value}
      onChangeText={(text) => {
        typedLength.current = text.length;
        onChangeText?.(text);
      }}
      secureTextEntry={!visible}
      inputStyle={{
        // Android draws the hidden dots in monospace; pin one family so the text never jumps.
        fontFamily: Platform.OS === 'android' ? 'sans-serif' : undefined,
        ...inputStyle,
      }}
      trailing={
        <Pressable
          testID={testID ? `${testID}.toggle` : undefined}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t('auth.password.hint')}
          onPressIn={() => {
            wasFocused.current = inputRef.current?.isFocused() ?? false;
          }}
          onPress={onToggle}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          {({ pressed }) => (
            <Ionicons name={toggle.icon} size={22} color={pressed ? colors.cobalt : colors.muted} />
          )}
        </Pressable>
      }
    />
  );
}
