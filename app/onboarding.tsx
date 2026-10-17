import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { signOut } from '@/features/auth/api';
import { DeleteAccountButton } from '@/features/auth/DeleteAccountButton';
import { createHousehold } from '@/features/households/api';
import { parseInviteToken } from '@/features/households/invite-link';
import { householdNameSchema } from '@/features/households/schemas';
import { membershipKey, useHouseholdMutation } from '@/features/households/queries';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { AccountZone } from '@/ui/components/AccountZone';
import { BrandHeader } from '@/ui/components/BrandHeader';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { CenteredCard } from '@/ui/components/CenteredCard';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme';

export default function OnboardingScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const create = useHouseholdMutation(createHousehold);
  const [name, setName] = useState(t('onboarding.defaultName'));
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | undefined>();

  function submitCreate() {
    setFormError(undefined);
    const parsed = householdNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(t('onboarding.errors.nameInvalid'));
      return;
    }
    setNameError(undefined);
    create.mutate(parsed.data, {
      // On success the membership refetch makes the guard move to /today.
      onError: (error) => {
        switch (error.code) {
          case 'INVALID_NAME':
            setNameError(t('onboarding.errors.nameInvalid'));
            break;
          case 'ALREADY_IN_HOUSEHOLD':
            // The user already has a household: refresh so the guard redirects.
            void queryClient.invalidateQueries({ queryKey: membershipKey });
            break;
          case 'NETWORK':
            setFormError(t('onboarding.errors.NETWORK'));
            break;
          default:
            setFormError(t('onboarding.errors.UNKNOWN'));
        }
      },
    });
  }

  function submitJoin() {
    const token = parseInviteToken(link);
    if (!token) {
      setLinkError(t('onboarding.errors.linkInvalid'));
      return;
    }
    setLinkError(undefined);
    router.push({ pathname: '/invite', params: { token } });
  }

  return (
    <CenteredCard header={<BrandHeader />}>
      <ScreenTitle subtitle={t('brand.tagline')}>{t('onboarding.title')}</ScreenTitle>
      <Text style={{ color: colors.ink, fontSize: 16 }}>{t('onboarding.welcome')}</Text>
      <TextField
        testID="onboarding.name"
        label={t('onboarding.nameLabel')}
        value={name}
        onChangeText={setName}
        error={nameError}
      />
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <Button
        testID="onboarding.create"
        title={t('onboarding.create')}
        icon={actionIcons.home}
        width="full"
        loading={create.isPending}
        onPress={submitCreate}
      />
      {/* The second way in starts a new group, further from the first than its own parts are. */}
      <Text
        accessibilityRole="header"
        style={{ marginTop: space(4), color: colors.ink, fontSize: 18, fontWeight: '600' }}
      >
        {t('onboarding.linkTitle')}
      </Text>
      <TextField
        testID="onboarding.link"
        label={t('onboarding.linkLabel')}
        value={link}
        onChangeText={setLink}
        error={linkError}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button
        testID="onboarding.join"
        title={t('onboarding.join')}
        variant="secondary"
        icon={actionIcons.join}
        width="full"
        onPress={submitJoin}
      />
      <AccountZone>
        <Button
          testID="onboarding.sign-out"
          title={t('auth.signOut')}
          variant="tertiary"
          icon={actionIcons.signOut}
          width="hug"
          onPress={() => void signOut().catch(() => undefined)}
        />
        <DeleteAccountButton testID="onboarding.delete-account" />
      </AccountZone>
    </CenteredCard>
  );
}
