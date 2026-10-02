import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { signIn } from '@/features/auth/api';
import { toAuthFailure } from '@/features/auth/errors';
import { authErrorKey, fieldErrors } from '@/features/auth/form-errors';
import { signInSchema } from '@/features/auth/schemas';
import { t, type MessageKey } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { Screen } from '@/ui/components/Screen';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme';

export default function SignInScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, MessageKey>>({});
  const [formError, setFormError] = useState<MessageKey | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = signInSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error, true));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signIn(parsed.data);
      // The route guard moves on once the session changes.
    } catch (e) {
      setFormError(authErrorKey(toAuthFailure(e).code));
    } finally {
      setLoading(false);
    }
  }

  const fieldError = (name: string) => {
    const key = errors[name];
    return key ? t(key) : undefined;
  };

  return (
    <Screen>
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}
      >
        {t('auth.signIn.title')}
      </Text>
      <TextField
        testID="sign-in.email"
        label={t('auth.fields.email')}
        value={email}
        onChangeText={setEmail}
        error={fieldError('email')}
        textContentType="emailAddress"
        autoComplete="email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField
        testID="sign-in.password"
        label={t('auth.fields.password')}
        value={password}
        onChangeText={setPassword}
        error={fieldError('password')}
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        autoCapitalize="none"
      />
      {formError ? <ErrorText>{t(formError)}</ErrorText> : null}
      <Button
        testID="sign-in.submit"
        title={t('auth.signIn.submit')}
        onPress={() => void submit()}
        loading={loading}
      />
      <Button
        testID="sign-in.go-sign-up"
        title={t('auth.signIn.goSignUp')}
        variant="secondary"
        onPress={() => router.push('/sign-up')}
      />
    </Screen>
  );
}
