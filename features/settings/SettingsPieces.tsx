import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import { useSetDisplayName } from '@/features/households/queries';
import { settingsErrorMessage } from '@/features/settings/errors';
import { t } from '@/i18n';
import { pressedOpacity } from '@/ui/buttonLook';
import { Button } from '@/ui/components/Button';
import { useDoorCompact, useDoorType } from '@/ui/components/DoorHeader';
import { DOOR_MAX_SCALE } from '@/ui/door';
import { Magnet } from '@/ui/components/Magnet';
import { NidoSymbol } from '@/ui/components/NidoSymbol';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme';
import { displayFont, displayFontBold } from '@/ui/tokens';

const NAME_MAX = 40;

const PLATE = 48;

/** The symbol on a small brand-band disc at the door's right: decorative, the only place in Ajustes. */
export function BrandPlate() {
  const { colors } = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: PLATE,
        height: PLATE,
        borderRadius: PLATE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.brandBand,
      }}
    >
      <NidoSymbol size={30} onSlate />
    </View>
  );
}

/** Your account's note while the members load, before your magnet is known (fase 10f). */
export function Note({ children }: { children: ReactNode }) {
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
export function NameHeading({
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
  const type = useDoorType();
  // A compact door is at most 40 % of a short window: under the lg magnet the household line
  // was cut at its edge, so there the magnet is md like the door's other magnets.
  const compact = useDoorCompact();
  const save = useSetDisplayName();
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | undefined>(undefined);
  const titleStyle = {
    color: colors.ink,
    fontFamily: displayFont,
    fontSize: type.heading,
    lineHeight: type.lineHeight,
    letterSpacing: -type.heading * 0.02,
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
      onError: (e) => setError(settingsErrorMessage(e)),
    });
  };

  const magnet = mark ? (
    <Magnet
      initial={mark.initial}
      color={mark.color}
      size={compact ? 'md' : 'lg'}
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
        <Text
          style={[titleStyle, { flexShrink: 1 }]}
          numberOfLines={1}
          ellipsizeMode="tail"
          maxFontSizeMultiplier={DOOR_MAX_SCALE}
        >
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
