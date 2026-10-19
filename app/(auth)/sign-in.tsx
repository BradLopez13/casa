import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View, type TextInput } from 'react-native';
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
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    setFormError(null);
    const parsed = signInSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const found = fieldErrors(parsed.error, { form: 'signIn' });
      setErrors(found);
      const first: TextInput | null =
        (found.email ? emailRef.current : null) ?? (found.password ? passwordRef.current : null);
      first?.focus();
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
    <CenteredCard
      header={<BrandHeader />}
      // On a phone on its side the title and the quick ways in take their own column.
      aside={
        <>
          <ScreenTitle subtitle={t('brand.tagline')}>{t('auth.signIn.title')}</ScreenTitle>
          <SocialButtons />
          {hasPendingInvite ? (
            <Text testID="sign-in.pending-invite" style={{ color: colors.ink, fontSize: 16 }}>
              {t('auth.pendingInvite')}
            </Text>
          ) : null}
        </>
      }
    >
      <TextField
        ref={emailRef}
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
        spellCheck={false}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <PasswordField
        ref={passwordRef}
        testID="sign-in.password"
        label={t('auth.fields.password')}
        value={password}
        onChangeText={setPassword}
        error={fieldError('password')}
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="done"
        onSubmitEditing={() => {
          if (!loading) void submit();
        }}
      />
      <View style={{ alignSelf: 'flex-end' }}>
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
          onPress={() => router.push('/sign-up')}
        />
      </View>
    </CenteredCard>
  );
}
