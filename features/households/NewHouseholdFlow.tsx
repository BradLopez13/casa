import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AppError } from '@/data/supabase/errors';
import { ROOMS, type Room } from '@/domain/tasks/rooms';
import { signOut } from '@/features/auth/api';
import { AccountMenu } from '@/features/auth/AccountMenu';
import { useSession } from '@/features/auth/SessionProvider';
import { createHousehold, setHouseholdRooms } from '@/features/households/api';
import { parseInviteToken } from '@/features/households/invite-link';
import { leaveToHome } from '@/features/households/leaveToHome';
import { householdNameSchema } from '@/features/households/schemas';
import { householdsKey, membershipKey, setActiveHousehold } from '@/features/households/queries';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { pressedOpacity } from '@/ui/buttonLook';
import { BrandHeader } from '@/ui/components/BrandHeader';
import { Button } from '@/ui/components/Button';
import { useNotice } from '@/ui/components/Notice';
import { ErrorText } from '@/ui/components/ErrorText';
import { CenteredCard } from '@/ui/components/CenteredCard';
import { Magnet } from '@/ui/components/Magnet';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { onboardingErrorMessage } from '@/features/households/errors';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme';
import { displayFontBold, MIN_TOUCH } from '@/ui/tokens';

/**
 * Creating a household or joining one with a link: onboarding, and, with `another`, «Crear otra
 * casa» and «Unirme con un enlace» for someone who already has one (bloque 12). The same screen,
 * with «Volver» on the band instead of the account; the new household becomes the one this phone
 * shows.
 */
export function NewHouseholdFlow({
  another = false,
  focusLink = false,
}: {
  another?: boolean;
  focusLink?: boolean;
}) {
  // Created but not yet shown to the guard: the rooms step comes first, then Hoy.
  const [created, setCreated] = useState<string | null>(null);
  return created !== null ? (
    <RoomsStep householdId={created} another={another} />
  ) : (
    <CreateStep onCreated={setCreated} another={another} focusLink={focusLink} />
  );
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
      aria-checked={checked}
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
        check={checked ? 'filled' : undefined}
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
function RoomsStep({ householdId, another }: { householdId: string; another: boolean }) {
  const { space } = useTheme();
  const router = useRouter();
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [rooms, setRooms] = useState<ReadonlySet<Room>>(() => new Set(ROOMS));
  const [error, setError] = useState<string | undefined>();
  const save = useMutation<void, AppError, Room[]>({
    mutationFn: async (chosen) => {
      await setHouseholdRooms(householdId, chosen);
      // The new household is the one this phone shows from now on.
      await setActiveHousehold(queryClient, userId, householdId);
    },
  });
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
        // The membership refetch makes the guard move to /today; it stays busy until then. From
        // another household the guard has nothing to do: the screen goes there itself.
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: householdsKey });
          const refetched = queryClient.invalidateQueries({ queryKey: membershipKey });
          if (another) void refetched.finally(() => leaveToHome(router, '/today'));
        },
        onError: (e) => {
          switch (e.code) {
            case 'NOT_A_MEMBER':
              // The household is gone: refresh so the guard sorts it out.
              void queryClient.invalidateQueries({ queryKey: membershipKey });
              break;
            default:
              setError(onboardingErrorMessage(e.code));
          }
        },
      },
    );
  };

  return (
    <CenteredCard header={<BrandHeader variant="hero" />}>
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

function CreateStep({
  onCreated,
  another,
  focusLink,
}: {
  onCreated: (householdId: string) => void;
  another: boolean;
  focusLink: boolean;
}) {
  const { colors, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Not useHouseholdMutation: refreshing the membership now would send the guard to Hoy before
  // the rooms step.
  const create = useMutation<string, AppError, string>({ mutationFn: createHousehold });
  const [name, setName] = useState(
    another ? t('onboarding.anotherDefaultName') : t('onboarding.defaultName'),
  );
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | undefined>();
  const notify = useNotice();
  const joinBlock = useRef<View>(null);
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
            setNameError(onboardingErrorMessage(error.code));
            break;
          case 'ALREADY_IN_HOUSEHOLD':
            // A server before bloque 12 allows one household. From onboarding the user already
            // has one: refresh so the guard redirects. From «Crear otra casa», say so.
            if (another) setFormError(onboardingErrorMessage(error.code));
            else void queryClient.invalidateQueries({ queryKey: membershipKey });
            break;
          default:
            setFormError(onboardingErrorMessage(error.code));
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

  // The account waits behind «⋯»: the first steps are only «create» or «paste a link». Another
  // household is a secondary screen: the common header, «Volver» on the left and its title, no
  // band (bloque 13, P2-6).
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));
  return (
    <CenteredCard
      header={
        another ? undefined : (
          <BrandHeader
            variant="hero"
            trailing={<AccountMenu onSignOut={leave} signingOut={signingOut} />}
          />
        )
      }
      bar={
        another ? (
          <ModalHeader
            title={t('onboarding.anotherTitle')}
            step={2}
            cancel={{ testID: 'onboarding.back', label: t('onboarding.back'), onPress: back }}
          />
        ) : undefined
      }
    >
      {another ? null : <ScreenTitle>{t('onboarding.title')}</ScreenTitle>}
      <Text style={{ color: colors.ink, fontSize: 16 }}>
        {another ? t('onboarding.anotherWelcome') : t('onboarding.welcome')}
      </Text>
      <TextField
        testID="onboarding.name"
        label={another ? t('onboarding.anotherNameLabel') : t('onboarding.nameLabel')}
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
        title={another ? t('onboarding.anotherCreate') : t('onboarding.create')}
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
      <View ref={joinBlock} collapsable={false} style={{ gap: space(4) }}>
        <TextField
          testID="onboarding.link"
          label={t('onboarding.linkLabel')}
          // With the keyboard up, «Unirme» comes into view with the field (bloque 13, P2-6).
          revealBlock={joinBlock}
          value={link}
          onChangeText={setLink}
          error={linkError}
          keyboardType="url"
          autoFocus={focusLink}
          textContentType="URL"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submitJoin}
        />
        <Button
          testID="onboarding.join"
          title={t('onboarding.join')}
          variant="outlined"
          icon={actionIcons.join}
          width="full"
          onPress={submitJoin}
        />
      </View>
    </CenteredCard>
  );
}
