import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { requestPasswordReset, resetPassword } from '@/features/auth/api';
import { toAuthFailure } from '@/features/auth/errors';
import { fieldErrors, visibleAuthError } from '@/features/auth/form-errors';
import { secondsLeft } from '@/features/auth/resend-cooldown';
import { emailSchema, resetPasswordSchema } from '@/features/auth/schemas';
import { t, type MessageKey } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { CenteredCard } from '@/ui/components/CenteredCard';
import { CodeField } from '@/ui/components/CodeField';
import { ErrorText } from '@/ui/components/ErrorText';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme';

const nowMs = () => Date.now();

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
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
    const parsed = resetPasswordSchema.safeParse({ code, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error, { form: 'reset' }));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await resetPassword({ email: email.trim(), ...parsed.data });
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

  return (
    <CenteredCard>
      <ScreenTitle>{t('auth.forgot.title')}</ScreenTitle>
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
            testID="forgot-password.code"
            label={t('auth.verify.code')}
            value={code}
            onChangeText={setCode}
            error={fieldError('code')}
          />
          <TextField
            testID="forgot-password.password"
            label={t('auth.forgot.newPassword')}
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
            testID="forgot-password.submit"
            title={t('auth.forgot.submit')}
            onPress={() => void submit()}
            loading={loading}
          />
          <Button
            testID="forgot-password.resend"
            title={
              left > 0 ? t('auth.verify.resendIn', { seconds: left }) : t('auth.verify.resend')
            }
            variant="secondary"
            disabled={left > 0}
            loading={resending}
            onPress={() => void resend()}
          />
        </>
      )}
    </CenteredCard>
  );
}
