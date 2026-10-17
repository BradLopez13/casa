import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { toAppError } from '@/data/supabase/errors';
import type { MemberMark } from '@/domain/members/marks';
import { isOwnerAlone } from '@/domain/account/delete';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/SessionProvider';
import { DeleteAccountButton } from '@/features/auth/DeleteAccountButton';
import { HouseholdNoticesSection } from '@/features/push/HouseholdNoticesSection';
import { ReminderSettingsSection } from '@/features/reminders/ReminderSettingsSection';
import { useMembers, useMembership, useSetDisplayName } from '@/features/households/queries';
import { householdLine } from '@/features/settings/householdLine';
import { settingsPanes, type SettingsGroup } from '@/features/settings/settingsPanes';
import { useMemberLabels } from '@/features/tasks/useMemberLabels';
import { t, type MessageKey } from '@/i18n';
import { pressedOpacity } from '@/ui/buttonLook';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { DoorHeader, useDoorCompact } from '@/ui/components/DoorHeader';
import { useNotice } from '@/ui/components/Notice';
import { ListRow } from '@/ui/components/ListRow';
import { Magnet } from '@/ui/components/Magnet';
import { TextField } from '@/ui/components/TextField';
import { TwoPane } from '@/ui/components/TwoPane';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { displayFont, displayFontBold } from '@/ui/tokens';
import { useLayout } from '@/ui/useLayout';

const NAME_MAX = 40;

function nameErrorKey(code: string): MessageKey {
  if (code === 'INVALID_DISPLAY_NAME') return 'errors.INVALID_DISPLAY_NAME';
  if (code === 'NETWORK') return 'members.errors.NETWORK';
  return 'members.errors.UNKNOWN';
}

export default function SettingsScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const notify = useNotice();
  const [signingOut, setSigningOut] = useState(false);
  const leave = () => {
    setSigningOut(true);
    signOut()
      .catch(() => notify(t('auth.signOutFailed')))
      .finally(() => setSigningOut(false));
  };
  const { userId } = useSession();
  const membership = useMembership().data;
  const members = useMembers(membership?.householdId);
  const list = useMemo(() => members.data ?? [], [members.data]);
  const { marks } = useMemberLabels(list, userId);
  const displayName = list.find((m) => m.userId === userId)?.displayName ?? '';
  const others = list.filter((m) => m.userId !== userId).map((m) => m.displayName);
  const alone = isOwnerAlone(membership?.role, members.data, userId);
  const { left, right } = settingsPanes(paneMode(useLayout()));
  // While the name is open, its Guardar is the screen's one pósit; Invitar steps back.
  const [editing, setEditing] = useState(false);

  const group = (key: SettingsGroup) => {
    switch (key) {
      case 'members':
        return (
          <Note>
            <ListRow
              testID="settings.members"
              title={t('settings.members')}
              icon={actionIcons.people}
              onPress={() => router.push('/household/members')}
            />
            <Button
              testID="settings.invite"
              title={t('settings.invite')}
              icon={actionIcons.invite}
              variant={editing ? 'secondary' : 'primary'}
              onPress={() => router.push('/household/members')}
            />
          </Note>
        );
      case 'reminders':
        return (
          <Note>
            <ReminderSettingsSection />
          </Note>
        );
      case 'notices':
        return (
          <Note>
            <HouseholdNoticesSection />
          </Note>
        );
      case 'account':
        return (
          <Note>
            <Text
              accessibilityRole="header"
              style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 15 }}
            >
              {t('settings.account')}
            </Text>
            <Button
              testID="settings.sign-out"
              title={t('auth.signOut')}
              variant="secondary"
              icon={actionIcons.signOut}
              width="full"
              loading={signingOut}
              onPress={leave}
            />
            <DeleteAccountButton
              testID="settings.delete-account"
              alone={alone}
              disabled={!members.data}
              quiet
            />
          </Note>
        );
    }
  };

  const pane = (groups: SettingsGroup[]) => (
    <View style={{ gap: space(4), paddingTop: space(5) }}>
      {groups.map((key) => (
        <View key={key}>{group(key)}</View>
      ))}
    </View>
  );

  const door = (
    <DoorHeader
      title={displayName}
      eyebrow={t('settings.title')}
      heading={
        <NameHeading
          name={displayName}
          mark={userId ? marks.get(userId) : undefined}
          editing={editing}
          onEditingChange={setEditing}
        />
      }
      subtitle={membership ? householdLine(membership.householdName, others) : undefined}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <TwoPane
        header={door}
        left={pane(left)}
        right={right.length > 0 ? pane(right) : null}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space(8) }}
      />
    </View>
  );
}

/** A section of Ajustes, held on the page as a note. */
function Note({ children }: { children: ReactNode }) {
  const { colors, radii, shadows, noteEdge, space } = useTheme();
  return (
    <View
      style={{
        gap: space(3),
        padding: space(4),
        borderRadius: radii.note,
        backgroundColor: colors.note,
        ...shadows.note,
        ...noteEdge,
      }}
    >
      {children}
    </View>
  );
}

/**
 * The headline of the Ajustes door: your magnet and your name. Tapping the name opens it in place
 * as a field with Guardar and Cancelar; a saved name goes back to the headline.
 */
function NameHeading({
  name,
  mark,
  editing,
  onEditingChange,
}: {
  name: string;
  mark: MemberMark | undefined;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const { colors, space } = useTheme();
  const compact = useDoorCompact();
  const save = useSetDisplayName();
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | undefined>(undefined);
  const size = compact ? 28 : 32;
  const titleStyle = {
    color: colors.ink,
    fontFamily: displayFont,
    fontSize: size,
    lineHeight: Math.round(size * 1.19),
    letterSpacing: -size * 0.025,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  };

  const open = () => {
    setDraft(name);
    setError(undefined);
    onEditingChange(true);
  };
  const close = () => {
    setError(undefined);
    onEditingChange(false);
  };
  const submit = () => {
    if (save.isPending) return;
    const next = draft.trim();
    if (next === '') {
      setError(t('auth.errors.nameRequired'));
      return;
    }
    if (next === name) {
      close();
      return;
    }
    setError(undefined);
    save.mutate(next, {
      onSuccess: close,
      onError: (e) => setError(t(nameErrorKey(toAppError(e).code))),
    });
  };

  const magnet = mark ? (
    <Magnet
      initial={mark.initial}
      color={mark.color}
      size="lg"
      accessibilityLabel={name}
      decorative
    />
  ) : null;

  if (editing) {
    return (
      <View style={{ gap: space(3) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          {magnet}
          <View style={{ flex: 1 }}>
            <TextField
              testID="settings.display-name.input"
              label={t('settings.displayName')}
              bare
              autoFocus
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (error) setError(undefined);
              }}
              maxLength={NAME_MAX}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={submit}
              error={error}
              inputStyle={{ fontFamily: displayFontBold, fontSize: 24 }}
            />
          </View>
        </View>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(3) }}
        >
          <Button
            testID="settings.display-name.save"
            title={t('settings.saveName')}
            loading={save.isPending}
            onPress={submit}
          />
          <Button
            testID="settings.display-name.cancel"
            title={t('settings.cancelName')}
            variant="tertiary"
            disabled={save.isPending}
            onPress={close}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
      {magnet}
      <Pressable
        testID="settings.display-name"
        accessibilityRole="button"
        accessibilityLabel={t('settings.editName')}
        accessibilityValue={{ text: name }}
        disabled={name === ''}
        onPress={open}
        hitSlop={{ top: 6, bottom: 6 }}
        style={({ pressed }) => ({
          flexShrink: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space(2),
          opacity: pressedOpacity(pressed),
        })}
      >
        <Text maxFontSizeMultiplier={1.3} style={[titleStyle, { flexShrink: 1 }]}>
          {name}
        </Text>
        <Ionicons
          name="create-outline"
          size={20}
          color={colors.muted}
          accessible={false}
          importantForAccessibility="no"
        />
      </Pressable>
    </View>
  );
}
