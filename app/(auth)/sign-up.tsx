import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { signUp } from '@/features/auth/api';
import { toAuthFailure } from '@/features/auth/errors';
import { authErrorKey, fieldErrors } from '@/features/auth/form-errors';
import { signUpSchema } from '@/features/auth/schemas';
import { t, type MessageKey } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { Screen } from '@/ui/components/Screen';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme';

export default function SignUpScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, MessageKey>>({});
  const [formError, setFormError] = useState<MessageKey | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = signUpSchema.safeParse({ displayName, email: email.trim(), password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error, { form: 'signUp' }));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signUp(parsed.data);
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
        {t('auth.signUp.title')}
      </Text>
      <TextField
        testID="sign-up.name"
        label={t('auth.fields.displayName')}
        value={displayName}
        onChangeText={setDisplayName}
        error={fieldError('displayName')}
        textContentType="name"
        autoComplete="name"
        autoCapitalize="words"
      />
      <TextField
        testID="sign-up.email"
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
        testID="sign-up.password"
        label={t('auth.fields.password')}
        value={password}
        onChangeText={setPassword}
        error={fieldError('password')}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        autoCapitalize="none"
      />
      {formError ? <ErrorText>{t(formError)}</ErrorText> : null}
      <Button
        testID="sign-up.submit"
        title={t('auth.signUp.submit')}
        onPress={() => void submit()}
        loading={loading}
      />
      <Button
        testID="sign-up.go-sign-in"
        title={t('auth.signUp.goSignIn')}
        variant="secondary"
        onPress={() => router.push('/sign-in')}
      />
    </Screen>
  );
}
