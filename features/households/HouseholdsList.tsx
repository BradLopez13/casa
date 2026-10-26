import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { firstInitial } from '@/domain/members/marks';
import { t } from '@/i18n';
import { announce } from '@/ui/a11y';
import { actionIcons } from '@/ui/actionIcons';
import { pressedOpacity } from '@/ui/buttonLook';
import { Button } from '@/ui/components/Button';
import { PinnedNote } from '@/ui/components/PinnedNote';
import { useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';
import type { Membership } from './api';

/** «2 personas · Llevas la casa»: how many live there, and whether you run it. */
export function householdDetails(household: Membership, active: boolean): string {
  const parts: string[] = [];
  if (active) parts.push(t('households.here'));
  const count = household.memberCount;
  if (count !== undefined) {
    parts.push(count === 1 ? t('households.peopleOne') : t('households.peopleOther', { count }));
  }
  if (household.role === 'owner') parts.push(t('households.leads'));
  return parts.join(' · ');
}

/**
 * «Tus casas» (bloque 12): one note per household, held by its magnet with its initial; the one
 * shown has its magnet in `selection` and says «Estás aquí». Tapping another switches to it.
 * Under them, «Crear otra casa» with a border and «Unirme con un enlace»: neither is pósit,
 * switching household is not «doing».
 */
export function HouseholdsList({
  households,
  activeId,
  onSwitch,
  onLeave,
}: {
  households: readonly Membership[];
  activeId: string | undefined;
  /** Switches to the household; the caller closes the sheet. */
  onSwitch: (householdId: string) => void;
  /** Before going to create or join: the sheet closes. */
  onLeave?: () => void;
}) {
  const { colors, space } = useTheme();
  const router = useRouter();
  const go = (path: '/household/new' | '/household/new?join=1') => {
    onLeave?.();
    router.push(path);
  };
  return (
    <View style={{ gap: space(4) }}>
      {households.map((household) => {
        const active = household.householdId === activeId;
        const details = householdDetails(household, active);
        return (
          <Pressable
            key={household.householdId}
            testID={`households.${household.householdId}`}
            accessibilityRole="button"
            aria-selected={active}
            accessibilityLabel={`${household.householdName}, ${details}`}
            accessibilityHint={
              active ? undefined : t('households.switchTo', { household: household.householdName })
            }
            onPress={() => {
              onSwitch(household.householdId);
              if (!active) announce(t('households.nowIn', { household: household.householdName }));
            }}
            style={({ pressed }) => ({ opacity: pressedOpacity(pressed) })}
          >
            <PinnedNote
              side="left"
              pin={{ house: { initial: firstInitial(household.householdName), active } }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
                <View style={{ flex: 1, gap: space(1) }}>
                  <Text style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 17 }}>
                    {household.householdName}
                  </Text>
                  {details ? (
                    <Text style={{ color: colors.muted, fontSize: 15 }}>{details}</Text>
                  ) : null}
                </View>
                {active ? (
                  <Ionicons name="checkmark" size={22} color={colors.ink} accessible={false} />
                ) : null}
              </View>
            </PinnedNote>
          </Pressable>
        );
      })}
      <Button
        testID="households.create"
        title={t('households.create')}
        variant="outlined"
        icon={actionIcons.home}
        width="full"
        onPress={() => go('/household/new')}
      />
      <Button
        testID="households.join"
        title={t('households.join')}
        variant="tertiary"
        icon={actionIcons.join}
        width="hug"
        onPress={() => go('/household/new?join=1')}
      />
    </View>
  );
}
