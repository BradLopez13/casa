import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, View, type TextInput } from 'react-native';
import { t } from '@/i18n';
import { actionIcons } from '../actionIcons';
import { passwordToggle } from '../passwordToggle';
import { useTheme } from '../theme';
import { TextField } from './TextField';

type FieldProps = Parameters<typeof TextField>[0];
type Props = Omit<FieldProps, 'secureTextEntry' | 'trailing'> & {
  /** When set, a checkmark with this label shows beside the eye (e.g. the repeat field once it matches). */
  confirmedLabel?: string | undefined;
};

export function PasswordField({
  testID,
  inputStyle,
  onChangeText,
  value,
  ref,
  confirmedLabel,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const wasFocused = useRef(false);
  const typedLength = useRef(0);
  const wasConfirmed = useRef(false);
  useEffect(() => {
    // Announce only on the false -> true transition.
    if (confirmedLabel && !wasConfirmed.current) {
      AccessibilityInfo.announceForAccessibility(confirmedLabel);
    }
    wasConfirmed.current = Boolean(confirmedLabel);
  }, [confirmedLabel]);
  const toggle = passwordToggle(visible);
  const label = t(toggle.labelKey);

  const onToggle = () => {
    const next = !visible;
    // A screen-reader double-tap never fires onPressIn, so ask the input as well.
    const refocus = wasFocused.current || (inputRef.current?.isFocused() ?? false);
    wasFocused.current = false;
    setVisible(next);
    AccessibilityInfo.announceForAccessibility(t(passwordToggle(next).labelKey));
    if (refocus) {
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
      autoCapitalize="none"
      autoCorrect={false}
      {...rest}
      ref={(node) => {
        inputRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
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
        // Room for the eye (52) plus the 20 dp checkmark and a gap when it shows.
        ...(confirmedLabel ? { paddingRight: 52 + 26 } : null),
        ...inputStyle,
      }}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {confirmedLabel ? (
            <View
              testID={testID ? `${testID}.match` : undefined}
              accessible
              accessibilityLabel={confirmedLabel}
              style={{ width: 20, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={actionIcons.confirm} size={20} color={colors.cobalt} />
            </View>
          ) : null}
          <Pressable
            testID={testID ? `${testID}.toggle` : undefined}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={visible ? undefined : t('auth.password.hint')}
            onPressIn={() => {
              wasFocused.current = inputRef.current?.isFocused() ?? false;
            }}
            onPress={onToggle}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            {({ pressed }) => (
              <Ionicons
                name={toggle.icon}
                size={22}
                color={pressed ? colors.cobalt : colors.muted}
              />
            )}
          </Pressable>
        </View>
      }
    />
  );
}
