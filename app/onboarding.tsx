import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AppError } from '@/data/supabase/errors';
import { ROOMS, type Room } from '@/domain/tasks/rooms';
import { signOut } from '@/features/auth/api';
import { AccountMenu } from '@/features/auth/AccountMenu';
import { createHousehold, setHouseholdRooms } from '@/features/households/api';
import { parseInviteToken } from '@/features/households/invite-link';
import { householdNameSchema } from '@/features/households/schemas';
import { membershipKey } from '@/features/households/queries';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { pressedOpacity } from '@/ui/buttonLook';
import { BrandHeader } from '@/ui/components/BrandHeader';
import { Button } from '@/ui/components/Button';
import { useNotice } from '@/ui/components/Notice';
import { ErrorText } from '@/ui/components/ErrorText';
import { CenteredCard } from '@/ui/components/CenteredCard';
import { Magnet } from '@/ui/components/Magnet';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme';
import { displayFontBold, MIN_TOUCH } from '@/ui/tokens';

export default function OnboardingScreen() {
  // Created but not yet shown to the guard: the rooms step comes first, then Hoy.
  const [created, setCreated] = useState(false);
  return created ? <RoomsStep /> : <CreateStep onCreated={() => setCreated(true)} />;
}

function RoomToggle({
  room,
  checked,
  onToggle,
}: {
  room: Room;
  checked: boolean;
  onToggle: () => void;
}) {
  const { colors, space } = useTheme();
  const label = t(`rooms.${room}`);
  return (
    <Pressable
      testID={`onboarding.room.${room}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(3),
        opacity: pressedOpacity(pressed),
      })}
    >
      {/* The check mark, not only the colour, shows the choice. */}
      <Magnet
        size="sm"
        decorative
        variant="empty"
        check={checked ? 'filled' : 'faint'}
        color="teal"
        initial=""
        accessibilityLabel={label}
      />
      <Text style={{ flex: 1, color: colors.ink, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Right after creating the household: which rooms the home has, all of them to start with. The
 * catalogue of tasks and the room picker then offer only these. Continuing saves them and lets
 * the guard take the person to Hoy.
 */
function RoomsStep() {
  const { space } = useTheme();
  const queryClient = useQueryClient();
  const [rooms, setRooms] = useState<ReadonlySet<Room>>(() => new Set(ROOMS));
  const [error, setError] = useState<string | undefined>();
  const save = useMutation<void, AppError, Room[]>({ mutationFn: setHouseholdRooms });
  const toggle = (room: Room) =>
    setRooms((current) => {
      const next = new Set(current);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  const proceed = () => {
    setError(undefined);
    save.mutate(
      ROOMS.filter((room) => rooms.has(room)),
      {
        // The membership refetch makes the guard move to /today; it stays busy until then.
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: membershipKey });
        },
        onError: (e) => {
          switch (e.code) {
            case 'INVALID_ROOM':
              setError(t('errors.INVALID_ROOM'));
              break;
            case 'NOT_A_MEMBER':
              // The household is gone: refresh so the guard sorts it out.
              void queryClient.invalidateQueries({ queryKey: membershipKey });
              break;
            case 'NETWORK':
              setError(t('onboarding.errors.NETWORK'));
              break;
            default:
              setError(t('onboarding.errors.UNKNOWN'));
          }
        },
      },
    );
  };

  return (
    <CenteredCard header={<BrandHeader />}>
      <ScreenTitle subtitle={t('onboarding.roomsHint')}>{t('onboarding.roomsTitle')}</ScreenTitle>
      <View style={{ gap: space(1) }}>
        {ROOMS.map((room) => (
          <RoomToggle
            key={room}
            room={room}
            checked={rooms.has(room)}
            onToggle={() => toggle(room)}
          />
        ))}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button
        testID="onboarding.rooms.continue"
        title={t('onboarding.roomsContinue')}
        width="full"
        disabled={rooms.size === 0}
        loading={save.isPending || save.isSuccess}
        onPress={proceed}
      />
    </CenteredCard>
  );
}

function CreateStep({ onCreated }: { onCreated: () => void }) {
  const { colors, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Not useHouseholdMutation: refreshing the membership now would send the guard to Hoy before
  // the rooms step.
  const create = useMutation<string, AppError, string>({ mutationFn: createHousehold });
  const [name, setName] = useState(t('onboarding.defaultName'));
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | undefined>();
  const notify = useNotice();
  const [signingOut, setSigningOut] = useState(false);
  const leave = () => {
    setSigningOut(true);
    signOut()
      .catch(() => notify(t('auth.signOutFailed')))
      .finally(() => setSigningOut(false));
  };

  function submitCreate() {
    setFormError(undefined);
    const parsed = householdNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(t('onboarding.errors.nameInvalid'));
      return;
    }
    setNameError(undefined);
    create.mutate(parsed.data, {
      onSuccess: onCreated,
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

  // The account waits behind «⋯»: the first steps are only «create» or «paste a link».
  return (
    <CenteredCard
      header={<BrandHeader trailing={<AccountMenu onSignOut={leave} signingOut={signingOut} />} />}
    >
      <ScreenTitle>{t('onboarding.title')}</ScreenTitle>
      <Text style={{ color: colors.ink, fontSize: 16 }}>{t('onboarding.welcome')}</Text>
      <TextField
        testID="onboarding.name"
        label={t('onboarding.nameLabel')}
        value={name}
        onChangeText={setName}
        error={nameError}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (!create.isPending) submitCreate();
        }}
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
        style={{
          marginTop: space(4),
          color: colors.ink,
          fontFamily: displayFontBold,
          fontSize: 15,
        }}
      >
        {t('onboarding.linkTitle')}
      </Text>
      <TextField
        testID="onboarding.link"
        label={t('onboarding.linkLabel')}
        value={link}
        onChangeText={setLink}
        error={linkError}
        keyboardType="url"
        textContentType="URL"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submitJoin}
      />
      <Button
        testID="onboarding.join"
        title={t('onboarding.join')}
        variant="secondary"
        icon={actionIcons.join}
        width="full"
        onPress={submitJoin}
      />
    </CenteredCard>
  );
}
