import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View, type TextInput } from 'react-native';
import { requestPasswordReset, resetPassword } from '@/features/auth/api';
import { toAuthFailure } from '@/features/auth/errors';
import { fieldErrors, visibleAuthError } from '@/features/auth/form-errors';
import {
  nextPairState,
  pairErrors,
  pairMatches,
  type PairState,
} from '@/features/auth/password-pair';
import { secondsLeft } from '@/features/auth/resend-cooldown';
import { emailSchema, resetPasswordSchema } from '@/features/auth/schemas';
import { t, type MessageKey } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { BrandHeader } from '@/ui/components/BrandHeader';
import { CenteredCard } from '@/ui/components/CenteredCard';
import { CodeField } from '@/ui/components/CodeField';
import { ErrorText } from '@/ui/components/ErrorText';
import { PasswordField } from '@/ui/components/PasswordField';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme';

const nowMs = () => Date.now();

export default function ForgotPasswordScreen() {
  const { colors, space } = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pair, setPair] = useState<PairState>({
    passwordTouched: false,
    confirmTouched: false,
    submitted: false,
  });
  const codeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [errors, setErrors] = useState<Record<string, MessageKey>>({});
  const [formError, setFormError] = useState<MessageKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(nowMs);
  const left = secondsLeft(sentAt, now);

  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setNow(nowMs()), 500);
    return () => clearInterval(id);
  }, [left]);

  function markSent() {
    const sent = nowMs();
    setSentAt(sent);
    setNow(sent);
  }

  function showFailure(e: unknown) {
    setFormError(visibleAuthError(toAuthFailure(e).code));
  }

  async function sendCode() {
    setFormError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setErrors({ email: 'auth.errors.emailInvalid' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await requestPasswordReset(parsed.data);
      markSent();
      setStep('code');
    } catch (e) {
      showFailure(e);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setFormError(null);
    setResending(true);
    try {
      await requestPasswordReset(email.trim());
      markSent();
    } catch (e) {
      showFailure(e);
    } finally {
      setResending(false);
    }
  }

  async function submit() {
    setFormError(null);
    setPair((s) => nextPairState(s, 'submit'));
    const parsed = resetPasswordSchema.safeParse({ code, password, passwordConfirm: confirm });
    if (!parsed.success) {
      const found = fieldErrors(parsed.error, { form: 'reset' });
      setErrors(found);
      const onSubmit = pairErrors(
        { passwordTouched: true, confirmTouched: true, submitted: true },
        { password, confirm },
      );
      const first: TextInput | null =
        (found.code ? codeRef.current : null) ??
        (onSubmit.password ? passwordRef.current : null) ??
        (onSubmit.confirm ? confirmRef.current : null);
      first?.focus();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await resetPassword({
        email: email.trim(),
        code: parsed.data.code,
        password: parsed.data.password,
      });
      // The new session makes the route guard move on.
    } catch (e) {
      showFailure(e);
    } finally {
      setLoading(false);
    }
  }

  const fieldError = (name: string) => {
    const key = errors[name];
    return key ? t(key) : undefined;
  };

  const shownPair = pairErrors(pair, { password, confirm });
  const pairError = (name: 'password' | 'confirm') => {
    const key = shownPair[name];
    return key ? t(`auth.errors.${key}`) : undefined;
  };
  const matches = pairMatches({ password, confirm });

  return (
    <CenteredCard header={<BrandHeader />}>
      <ScreenTitle subtitle={t('brand.tagline')}>{t('auth.forgot.title')}</ScreenTitle>
      {step === 'email' ? (
        <>
          <TextField
            testID="forgot-password.email"
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
          {formError ? <ErrorText>{t(formError)}</ErrorText> : null}
          <Button
            testID="forgot-password.send"
            title={t('auth.forgot.send')}
            icon={actionIcons.sendCode}
            width="full"
            onPress={() => void sendCode()}
            loading={loading}
          />
        </>
      ) : (
        <>
          <Text testID="forgot-password.sent" style={{ color: colors.ink, fontSize: 16 }}>
            {t('auth.forgot.sent')}
          </Text>
          <CodeField
            ref={codeRef}
            testID="forgot-password.code"
            label={t('auth.verify.code')}
            value={code}
            onChangeText={setCode}
            error={fieldError('code')}
          />
          <View style={{ gap: space(2) }}>
            <PasswordField
              ref={passwordRef}
              testID="forgot-password.password"
              label={t('auth.forgot.newPassword')}
              value={password}
              onChangeText={setPassword}
              onBlur={() => setPair((s) => nextPairState(s, 'blurPassword'))}
              error={pairError('password')}
              textContentType="newPassword"
              autoComplete="new-password"
            />
            {shownPair.password ? null : (
              <Text style={{ color: colors.muted, fontSize: 14 }}>
                {t('auth.hints.passwordRule')}
              </Text>
            )}
          </View>
          <PasswordField
            ref={confirmRef}
            testID="forgot-password.password-confirm"
            label={t('auth.fields.passwordConfirm')}
            value={confirm}
            onChangeText={setConfirm}
            onBlur={() => setPair((s) => nextPairState(s, 'blurConfirm'))}
            error={pairError('confirm')}
            textContentType="newPassword"
            autoComplete="new-password"
            confirmedLabel={matches ? t('auth.hints.passwordMatch') : undefined}
          />
          {formError ? <ErrorText>{t(formError)}</ErrorText> : null}
          <Button
            testID="forgot-password.submit"
            title={t('auth.forgot.submit')}
            icon={actionIcons.saveAndEnter}
            width="full"
            onPress={() => void submit()}
            loading={loading}
          />
          <Button
            testID="forgot-password.resend"
            title={
              left > 0 ? t('auth.verify.resendIn', { seconds: left }) : t('auth.verify.resend')
            }
            variant="tertiary"
            icon={actionIcons.resend}
            width="hug"
            disabled={left > 0}
            loading={resending}
            onPress={() => void resend()}
          />
        </>
      )}
    </CenteredCard>
  );
}
