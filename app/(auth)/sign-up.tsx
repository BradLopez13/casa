import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View, type TextInput } from 'react-native';
import { signUp } from '@/features/auth/api';
import { toAuthFailure } from '@/features/auth/errors';
import { authErrorKey, fieldErrors } from '@/features/auth/form-errors';
import {
  nextPairState,
  pairErrors,
  pairMatches,
  type PairState,
} from '@/features/auth/password-pair';
import { signUpSchema } from '@/features/auth/schemas';
import { usePendingInvite } from '@/features/households/pending-invite';
import { openLegal } from '@/features/legal/open';
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

export default function SignUpScreen() {
  const { hasPendingInvite } = usePendingInvite();
  const { colors, space } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; name?: string }>();
  const [displayName, setDisplayName] = useState(
    typeof params.name === 'string' ? params.name : '',
  );
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pair, setPair] = useState<PairState>({
    passwordTouched: false,
    confirmTouched: false,
    submitted: false,
  });
  const [errors, setErrors] = useState<Record<string, MessageKey>>({});
  const [formError, setFormError] = useState<MessageKey | null>(null);
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const shownPair = pairErrors(pair, { password, confirm });

  async function submit() {
    setFormError(null);
    setPair((s) => nextPairState(s, 'submit'));
    const parsed = signUpSchema.safeParse({
      displayName,
      email: email.trim(),
      password,
      passwordConfirm: confirm,
    });
    if (!parsed.success) {
      const found = fieldErrors(parsed.error, { form: 'signUp' });
      setErrors(found);
      const onSubmit = pairErrors(
        { passwordTouched: true, confirmTouched: true, submitted: true },
        { password, confirm },
      );
      const first: TextInput | null =
        (found.displayName ? nameRef.current : null) ??
        (found.email ? emailRef.current : null) ??
        (onSubmit.password ? passwordRef.current : null) ??
        (onSubmit.confirm ? confirmRef.current : null);
      first?.focus();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const outcome = await signUp({
        displayName: parsed.data.displayName,
        email: parsed.data.email,
        password: parsed.data.password,
      });
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
  const pairError = (name: 'password' | 'confirm') => {
    const key = shownPair[name];
    return key ? t(`auth.errors.${key}`) : undefined;
  };
  const matches = pairMatches({ password, confirm });

  return (
    <CenteredCard header={<BrandHeader />}>
      <ScreenTitle subtitle={t('brand.tagline')}>{t('auth.signUp.title')}</ScreenTitle>
      <SocialButtons />
      {hasPendingInvite ? (
        <Text testID="sign-up.pending-invite" style={{ color: colors.ink, fontSize: 16 }}>
          {t('auth.pendingInvite')}
        </Text>
      ) : null}
      <TextField
        ref={nameRef}
        testID="sign-up.name"
        label={t('auth.fields.displayName')}
        value={displayName}
        onChangeText={setDisplayName}
        error={fieldError('displayName')}
        textContentType="name"
        autoComplete="name"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
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
        spellCheck={false}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <View style={{ gap: space(2) }}>
        <PasswordField
          ref={passwordRef}
          testID="sign-up.password"
          label={t('auth.fields.password')}
          value={password}
          onChangeText={setPassword}
          onBlur={() => setPair((s) => nextPairState(s, 'blurPassword'))}
          error={pairError('password')}
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        {shownPair.password ? null : (
          <Text style={{ color: colors.muted, fontSize: 14 }}>{t('auth.hints.passwordRule')}</Text>
        )}
      </View>
      <PasswordField
        ref={confirmRef}
        testID="sign-up.password-confirm"
        label={t('auth.fields.passwordConfirm')}
        value={confirm}
        onChangeText={setConfirm}
        onBlur={() => setPair((s) => nextPairState(s, 'blurConfirm'))}
        error={pairError('confirm')}
        textContentType="newPassword"
        autoComplete="new-password"
        confirmedLabel={matches ? t('auth.hints.passwordMatch') : undefined}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (!loading) void submit();
        }}
      />
      {formError ? <ErrorText>{t(formError)}</ErrorText> : null}
      <Button
        testID="sign-up.submit"
        title={t('auth.signUp.submit')}
        icon={actionIcons.signUp}
        width="full"
        onPress={() => void submit()}
        loading={loading}
      />
      {/* What creating the account accepts, with both pages a tap away (bloque 15.5: Apple and
          Google ask for it in apps with an account). */}
      <View testID="sign-up.legal" style={{ gap: space(1) }}>
        <Text style={{ color: colors.muted, fontSize: 14 }}>{t('auth.signUp.legal')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space(4) }}>
          <Button
            testID="sign-up.terms"
            title={t('legal.terms')}
            variant="tertiary"
            width="hug"
            flush
            onPress={() => void openLegal('terms')}
          />
          <Button
            testID="sign-up.privacy"
            title={t('legal.privacy')}
            variant="tertiary"
            width="hug"
            flush
            onPress={() => void openLegal('privacy')}
          />
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: space(1),
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 16 }}>{t('auth.signUp.haveAccount')}</Text>
        <Button
          testID="sign-up.go-sign-in"
          title={t('auth.signUp.goSignIn')}
          variant="tertiary"
          width="hug"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
        />
      </View>
    </CenteredCard>
  );
}
