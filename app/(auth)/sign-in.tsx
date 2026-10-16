import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { signIn } from '@/features/auth/api';
import { toAuthFailure } from '@/features/auth/errors';
import { authErrorKey, fieldErrors } from '@/features/auth/form-errors';
import { signInSchema } from '@/features/auth/schemas';
import { usePendingInvite } from '@/features/households/pending-invite';
import { SocialButtons } from '@/features/auth/social/SocialButtons';
import { t, type MessageKey } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { BrandHeader } from '@/ui/components/BrandHeader';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { CenteredCard } from '@/ui/components/CenteredCard';
import { PasswordField } from '@/ui/components/PasswordField';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme';

export default function SignInScreen() {
  const { hasPendingInvite } = usePendingInvite();
  const { colors, space } = useTheme();
  const router = useRouter();
  const { error: errorParam } = useLocalSearchParams<{ error?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, MessageKey>>({});
  const [formError, setFormError] = useState<MessageKey | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = signInSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error, { form: 'signIn' }));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signIn(parsed.data);
      // The route guard moves on once the session changes.
    } catch (e) {
      const code = toAuthFailure(e).code;
      if (code === 'EMAIL_NOT_CONFIRMED') {
        // The code was already re-sent: go and type it.
        router.push({ pathname: '/verify-email', params: { email: parsed.data.email } });
      } else {
        setFormError(authErrorKey(code));
      }
    } finally {
      setLoading(false);
    }
  }

  // Sent by /auth/callback when the browser sign-in came back without a usable code.
  const shownError = formError ?? (errorParam === 'callback' ? authErrorKey('UNKNOWN') : null);

  const fieldError = (name: string) => {
    const key = errors[name];
    return key ? t(key) : undefined;
  };

  return (
    <CenteredCard>
      <BrandHeader />
      <ScreenTitle>{t('auth.signIn.title')}</ScreenTitle>
      <SocialButtons />
      {hasPendingInvite ? (
        <Text testID="sign-in.pending-invite" style={{ color: colors.ink, fontSize: 16 }}>
          {t('auth.pendingInvite')}
        </Text>
      ) : null}
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
      <PasswordField
        testID="sign-in.password"
        label={t('auth.fields.password')}
        value={password}
        onChangeText={setPassword}
        error={fieldError('password')}
        textContentType="password"
        autoComplete="current-password"
      />
      <View style={{ alignItems: 'flex-end' }}>
        <Button
          testID="sign-in.forgot-password"
          title={t('auth.forgot.link')}
          variant="tertiary"
          width="hug"
          onPress={() =>
            router.push({ pathname: '/forgot-password', params: { email: email.trim() } })
          }
        />
      </View>
      {shownError ? <ErrorText>{t(shownError)}</ErrorText> : null}
      <Button
        testID="sign-in.submit"
        title={t('auth.signIn.submit')}
        icon={actionIcons.logIn}
        width="full"
        onPress={() => void submit()}
        loading={loading}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: space(1),
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 16 }}>{t('auth.signIn.noAccount')}</Text>
        <Button
          testID="sign-in.go-sign-up"
          title={t('auth.signIn.goSignUp')}
          variant="tertiary"
          width="hug"
          onPress={() => router.replace('/sign-up')}
        />
      </View>
    </CenteredCard>
  );
}
