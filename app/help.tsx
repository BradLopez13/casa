import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/features/auth/SessionProvider';
import { resetHints } from '@/features/hints/hints';
import { useMembers, useMembership } from '@/features/households/queries';
import { Note } from '@/features/settings/SettingsPieces';
import { hintName } from '@/features/tasks/quickHint';
import { t, type MessageKey } from '@/i18n';
import { announce } from '@/ui/a11y';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { ModalSheet, useModalFill } from '@/ui/components/ModalSheet';
import { useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';
import { useCloseModal } from '@/ui/useCloseModal';

type Item = { key: string; icon: keyof typeof Ionicons.glyphMap };

/**
 * What no screen shows on its own, in the order a new household meets it (fase 10d: the magnets,
 * Hoy and Tareas, earlier days and giving a task to someone else joined the five hints).
 */
export const HELP_ITEMS: readonly Item[] = [
  { key: 'write', icon: 'create-outline' },
  { key: 'assign', icon: 'person-outline' },
  { key: 'magnets', icon: 'people-outline' },
  { key: 'tabs', icon: 'today-outline' },
  { key: 'earlier', icon: 'time-outline' },
  { key: 'swipe', icon: 'arrow-forward-circle-outline' },
  { key: 'refresh', icon: 'refresh-outline' },
  { key: 'shopping', icon: 'basket-outline' },
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
 * «Cómo funciona Nido», from Ajustes and from the empty states («¿Cómo funciona?», which opens it
 * on its entry: `casa://help?entry=tabs`): one note with what the first-use hints teach and what a
 * new member asks, for whoever missed them. One thing acts: «Volver a ver las pistas».
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
  // Opened from an empty state on one entry: the list starts there.
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  const scroll = useRef<ScrollView>(null);
  const noteTop = useRef(0);
  const [again, setAgain] = useState(false);
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
        ref={scroll}
        style={fill}
        contentContainerStyle={{
          paddingHorizontal: space(5),
          paddingTop: space(3),
          paddingBottom: space(8),
        }}
      >
        <View onLayout={(event) => (noteTop.current = event.nativeEvent.layout.y)}>
          <Note>
            {HELP_ITEMS.map((item) => (
              <View
                key={item.key}
                testID={`help.${item.key}`}
                onLayout={(event) => {
                  if (item.key !== entry) return;
                  const y = noteTop.current + event.nativeEvent.layout.y;
                  scroll.current?.scrollTo({ y: Math.max(0, y - space(3)), animated: false });
                }}
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
        </View>
        {/* The hints come back by themselves after a month without use; this brings them now. */}
        <View style={{ marginTop: space(4), gap: space(2) }}>
          <Button
            testID="help.again"
            title={t('help.again')}
            variant="tertiary"
            icon={actionIcons.retry}
            width="hug"
            flush
            onPress={() => {
              resetHints();
              setAgain(true);
              announce(t('help.againDone'));
            }}
          />
          {again ? (
            <Text testID="help.again-done" style={{ color: colors.muted, fontSize: 15 }}>
              {t('help.againDone')}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
