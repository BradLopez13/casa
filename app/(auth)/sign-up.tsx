import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { signUp } from '@/features/auth/api';
import { toAuthFailure } from '@/features/auth/errors';
import { authErrorKey, fieldErrors } from '@/features/auth/form-errors';
import { signUpSchema } from '@/features/auth/schemas';
import { usePendingInvite } from '@/features/households/pending-invite';
import { SocialButtons } from '@/features/auth/social/SocialButtons';
import { t, type MessageKey } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { CenteredCard } from '@/ui/components/CenteredCard';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme';

export default function SignUpScreen() {
  const { hasPendingInvite } = usePendingInvite();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; name?: string }>();
  const [displayName, setDisplayName] = useState(
    typeof params.name === 'string' ? params.name : '',
  );
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, MessageKey>>({});
  const [formError, setFormError] = useState<MessageKey | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = signUpSchema.safeParse({
      displayName,
      email: email.trim(),
      password,
      passwordConfirm: password, // Temporary until Task 7/8
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error, { form: 'signUp' }));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const outcome = await signUp(parsed.data);
      // Signed in: the route guard moves on once the session changes.
      if (outcome === 'verify') {
        router.push({
          pathname: '/verify-email',
          params: { email: parsed.data.email, name: parsed.data.displayName },
        });
      }
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
    <CenteredCard>
      <ScreenTitle>{t('auth.signUp.title')}</ScreenTitle>
      <SocialButtons />
      {hasPendingInvite ? (
        <Text testID="sign-up.pending-invite" style={{ color: colors.ink, fontSize: 16 }}>
          {t('auth.pendingInvite')}
        </Text>
      ) : null}
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
        onPress={() => router.replace('/sign-in')}
      />
    </CenteredCard>
  );
}
