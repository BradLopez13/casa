import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { useMembers, useMembership } from '@/features/households/queries';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme';

export default function TodayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const membership = useMembership().data;
  const members = useMembers(membership?.householdId);
  const count = members.data?.length;

  return (
    <Screen>
      <Text
        testID="today.household-name"
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}
      >
        {membership?.householdName ?? ''}
      </Text>
      {count !== undefined ? (
        <Text testID="today.member-count" style={{ color: colors.muted, fontSize: 16 }}>
          {count === 1 ? t('members.countOne') : t('members.count', { count })}
        </Text>
      ) : null}
      {count === 1 ? (
        <>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>
            {t('today.empty.title')}
          </Text>
          <Text style={{ color: colors.text, fontSize: 16 }}>{t('today.empty.body')}</Text>
          <Button
            testID="today.invite"
            title={t('today.empty.cta')}
            onPress={() => router.push('/household/members')}
          />
        </>
      ) : null}
    </Screen>
  );
}
