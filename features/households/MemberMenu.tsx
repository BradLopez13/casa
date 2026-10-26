import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { pressedOpacity } from '@/ui/buttonLook';
import { Button } from '@/ui/components/Button';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

type Props = {
  userId: string;
  name: string;
  onMakeOwner: () => void;
  onRemove: () => void;
};

/**
 * «⋯» on a member's note: handing over the household and removing the person wait in a small
 * menu instead of sitting on every card of a screen opened to invite (fase 10a). Each action
 * still goes through its own `ConfirmDialog`.
 */
export function MemberMenu({ userId, name, onMakeOwner, onRemove }: Props) {
  const { colors, radii, space } = useTheme();
  const reduceMotion = useReduceMotion();
  const [open, setOpen] = useState(false);
  // On iOS a Modal opened while another fades out never shows: the chosen action (and its
  // ConfirmDialog) waits for this menu to be gone. Android opens it at once.
  const [chosen, setChosen] = useState<(() => void) | null>(null);
  const close = () => setOpen(false);
  const choose = (action: () => void) => () => {
    close();
    if (Platform.OS === 'ios') setChosen(() => action);
    else action();
  };

  return (
    <>
      <Pressable
        testID={`members.menu.${userId}`}
        accessibilityRole="button"
        accessibilityLabel={t('members.more', { name })}
        aria-expanded={open}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          width: MIN_TOUCH,
          height: MIN_TOUCH,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressedOpacity(pressed),
        })}
      >
        <Ionicons name="ellipsis-horizontal" size={24} color={colors.ink} accessible={false} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={close}
        onDismiss={() => {
          chosen?.();
          setChosen(null);
        }}
      >
        <Pressable
          accessible={false}
          onPress={close}
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: space(6),
            backgroundColor: colors.scrim,
          }}
        >
          {/* A tap on the card stays on the card; only the scrim closes. */}
          <Pressable
            accessible={false}
            accessibilityViewIsModal
            onPress={() => undefined}
            style={{
              width: '100%',
              maxWidth: 440,
              alignSelf: 'center',
              gap: space(3),
              padding: space(6),
              borderRadius: radii.note,
              backgroundColor: colors.note,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ color: colors.ink, fontSize: 20, fontWeight: '700' }}
            >
              {name}
            </Text>
            <View accessibilityRole="menu" style={{ alignItems: 'flex-start', gap: space(2) }}>
              <Button
                testID={`members.make-owner.${userId}`}
                title={t('members.makeOwner')}
                variant="tertiary"
                icon={actionIcons.makeOwner}
                width="hug"
                role="menuitem"
                onPress={choose(onMakeOwner)}
              />
              <Button
                testID={`members.remove.${userId}`}
                title={t('members.remove')}
                variant="tertiary"
                tone="destructive"
                icon={actionIcons.removeMember}
                width="hug"
                role="menuitem"
                onPress={choose(onRemove)}
              />
            </View>
            <Button
              testID={`members.menu.${userId}.close`}
              title={t('account.close')}
              variant="outlined"
              width="full"
              onPress={close}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
