import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { resendSignUpCode, verifySignUpCode } from '@/features/auth/api';
import { toAuthFailure } from '@/features/auth/errors';
import { fieldErrors, visibleAuthError } from '@/features/auth/form-errors';
import { secondsLeft } from '@/features/auth/resend-cooldown';
import { codeSchema } from '@/features/auth/schemas';
import { t, type MessageKey } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { BrandHeader } from '@/ui/components/BrandHeader';
import { Button } from '@/ui/components/Button';
import { CenteredCard } from '@/ui/components/CenteredCard';
import { CodeField } from '@/ui/components/CodeField';
import { ErrorText } from '@/ui/components/ErrorText';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { useTheme } from '@/ui/theme';
import { z } from 'zod';

const nowMs = () => Date.now();

export default function VerifyEmailScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; name?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const name = typeof params.name === 'string' ? params.name : '';
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<MessageKey | null>(null);
  const [formError, setFormError] = useState<MessageKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  // The code was just sent when this screen opens, so the cooldown starts now.
  const [sentAt, setSentAt] = useState(nowMs);
  const [now, setNow] = useState(nowMs);
  const left = secondsLeft(sentAt, now);

  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setNow(nowMs()), 500);
    return () => clearInterval(id);
  }, [left]);

  function showFailure(e: unknown) {
    setFormError(visibleAuthError(toAuthFailure(e).code));
  }

  async function submit() {
    setFormError(null);
    const parsed = z.object({ code: codeSchema }).safeParse({ code });
    if (!parsed.success) {
      setCodeError(fieldErrors(parsed.error, { form: 'verify' }).code ?? 'auth.errors.codeInvalid');
      return;
    }
    setCodeError(null);
    setLoading(true);
    try {
      await verifySignUpCode({ email, code: parsed.data.code });
      // The route guard moves on once the session appears.
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
      await resendSignUpCode(email);
      const sent = nowMs();
      setSentAt(sent);
      setNow(sent);
    } catch (e) {
      showFailure(e);
    } finally {
      setResending(false);
    }
  }

  if (!email) return <Redirect href="/sign-up" />;

  return (
    <CenteredCard header={<BrandHeader />}>
      <ScreenTitle subtitle={t('brand.tagline')}>{t('auth.verify.title')}</ScreenTitle>
      <Text testID="verify-email.body" style={{ color: colors.ink, fontSize: 16 }}>
        {t('auth.verify.body', { email })}
      </Text>
      <CodeField
        testID="verify-email.code"
        label={t('auth.verify.code')}
        value={code}
        onChangeText={setCode}
        error={codeError ? t(codeError) : undefined}
      />
      {formError ? <ErrorText>{t(formError)}</ErrorText> : null}
      <Button
        testID="verify-email.submit"
        title={t('auth.verify.submit')}
        icon={actionIcons.confirm}
        width="full"
        onPress={() => void submit()}
        loading={loading}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(4) }}>
        <Button
          testID="verify-email.resend"
          title={left > 0 ? t('auth.verify.resendIn', { seconds: left }) : t('auth.verify.resend')}
          variant="tertiary"
          icon={actionIcons.resend}
          width="hug"
          disabled={left > 0}
          loading={resending}
          onPress={() => void resend()}
        />
        <Button
          testID="verify-email.change-email"
          title={t('auth.verify.changeEmail')}
          variant="tertiary"
          icon={actionIcons.changeEmail}
          width="hug"
          onPress={() => router.replace({ pathname: '/sign-up', params: { email, name } })}
        />
      </View>
    </CenteredCard>
  );
}
