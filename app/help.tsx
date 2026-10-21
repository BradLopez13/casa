import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { Note } from '@/features/settings/SettingsPieces';
import { hintName } from '@/features/tasks/quickHint';
import { t, type MessageKey } from '@/i18n';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { ModalSheet, useModalFill } from '@/ui/components/ModalSheet';
import { useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';
import { useCloseModal } from '@/ui/useCloseModal';

type Item = { key: string; icon: keyof typeof Ionicons.glyphMap };

/** The five things no screen shows on its own, in the order a new household meets them. */
const ITEMS: readonly Item[] = [
  { key: 'write', icon: 'create-outline' },
  { key: 'swipe', icon: 'arrow-forward-circle-outline' },
  { key: 'refresh', icon: 'refresh-outline' },
  { key: 'quantity', icon: 'add-circle-outline' },
  { key: 'invite', icon: 'link-outline' },
];

/** Mounted once inside its frame, so rotating never remounts it. */
export default function HelpRoute() {
  return (
    <ModalSheet>
      <HelpScreen />
    </ModalSheet>
  );
}

/**
 * «Cómo funciona Nido», from Ajustes: one note with what the first-use hints teach, for whoever
 * missed them or wants them again. Nothing here acts: it only explains.
 */
function HelpScreen() {
  const { colors, space } = useTheme();
  const { fill, edges } = useModalFill();
  const close = useCloseModal('/settings');
  const { userId } = useSession();
  const householdId = useMembership().data?.householdId;
  const members = useMembers(householdId).data ?? [];
  const name = hintName(
    members.map((m) => ({ id: m.userId, name: m.displayName })),
    userId,
  );
  const body = (key: string) =>
    key === 'write'
      ? name === null
        ? t('help.write.bodyAlone')
        : t('help.write.body', { name })
      : t(`help.${key}.body` as MessageKey);

  return (
    <SafeAreaView edges={edges} style={[fill, { backgroundColor: colors.page }]}>
      <ModalHeader
        title={t('help.title')}
        step={2}
        cancel={{ testID: 'help.back', label: t('help.back'), onPress: close }}
      />
      <ScrollView
        style={fill}
        contentContainerStyle={{
          paddingHorizontal: space(5),
          paddingTop: space(3),
          paddingBottom: space(8),
        }}
      >
        <Note>
          {ITEMS.map((item) => (
            <View
              key={item.key}
              testID={`help.${item.key}`}
              style={{ flexDirection: 'row', gap: space(3), paddingVertical: space(1) }}
            >
              <Ionicons name={item.icon} size={22} color={colors.ink} accessible={false} />
              <View style={{ flex: 1, gap: space(1) }}>
                <Text
                  accessibilityRole="header"
                  style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 16 }}
                >
                  {t(`help.${item.key}.title` as MessageKey)}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 15 }}>{body(item.key)}</Text>
              </View>
            </View>
          ))}
        </Note>
      </ScrollView>
    </SafeAreaView>
  );
}
