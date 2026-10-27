import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { firstInitial } from '@/domain/members/marks';
import { t } from '@/i18n';
import { announce } from '@/ui/a11y';
import { actionIcons } from '@/ui/actionIcons';
import { pressedOpacity } from '@/ui/buttonLook';
import { Button } from '@/ui/components/Button';
import { ListRow } from '@/ui/components/ListRow';
import { HouseMagnet } from '@/ui/components/HouseMagnet';
import { useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';
import type { Membership } from './api';

/**
 * Ajustes' «Tus casas» note (bloque 12): a row per household (the one shown says «Estás aquí»;
 * tapping another switches to it), its licence, and «Crear otra casa» and «Unirme con un enlace».
 * With a single household it keeps that household, the licence and the two actions.
 */
export function HouseholdsSection({
  households,
  activeId,
  onSwitch,
}: {
  households: readonly Membership[];
  activeId: string | undefined;
  onSwitch: (householdId: string) => void;
}) {
  const { colors, space } = useTheme();
  const router = useRouter();
  return (
    <View style={{ gap: space(2) }}>
      <Text
        accessibilityRole="header"
        style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 15 }}
      >
        {t('households.title')}
      </Text>
      <View>
        {households.map((household) => {
          const active = household.householdId === activeId;
          return (
            <Pressable
              key={household.householdId}
              testID={`settings.household.${household.householdId}`}
              accessibilityRole="button"
              aria-selected={active}
              accessibilityLabel={
                active
                  ? `${household.householdName}, ${t('households.here')}`
                  : t('households.switchTo', { household: household.householdName })
              }
              onPress={() => {
                if (active) return;
                onSwitch(household.householdId);
                announce(t('households.nowIn', { household: household.householdName }));
              }}
              style={({ pressed }) => ({
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space(3),
                opacity: pressedOpacity(pressed),
              })}
            >
              <HouseMagnet
                size="sm"
                initial={firstInitial(household.householdName)}
                active={active}
              />
              <Text style={{ flex: 1, color: colors.ink, fontSize: 17 }}>
                {household.householdName}
              </Text>
              {active ? (
                <Text style={{ color: colors.muted, fontSize: 14 }}>{t('households.here')}</Text>
              ) : (
                <Ionicons
                  name={actionIcons.chevron}
                  size={22}
                  color={colors.muted}
                  accessible={false}
                  importantForAccessibility="no"
                />
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline }}>
        <ListRow
          testID="settings.license"
          title={t('households.license')}
          onPress={() => router.push('/household/license')}
        />
      </View>
      <Button
        testID="settings.household-create"
        title={t('households.create')}
        variant="outlined"
        icon={actionIcons.home}
        width="full"
        onPress={() => router.push('/household/new')}
      />
      <Button
        testID="settings.household-join"
        title={t('households.join')}
        variant="tertiary"
        icon={actionIcons.join}
        width="hug"
        flush
        onPress={() => router.push('/household/new?join=1')}
      />
    </View>
  );
}
