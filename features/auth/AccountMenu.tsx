import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { DeleteAccountButton } from './DeleteAccountButton';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { pressedOpacity } from '@/ui/buttonLook';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import { Button } from '@/ui/components/Button';

const SIZE = 48;

/**
 * «⋯» on the brand band of onboarding and invite: signing out and deleting the account wait in a
 * small dialog instead of sitting next to the first steps. Deleting keeps its own confirmation.
 */
export function AccountMenu({
  onSignOut,
  signingOut = false,
}: {
  onSignOut: () => void;
  signingOut?: boolean;
}) {
  const { colors, radii, space } = useTheme();
  const reduceMotion = useReduceMotion();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        testID="account-menu"
        accessibilityRole="button"
        accessibilityLabel={t('account.menu')}
        onPress={() => setOpen(true)}
        hitSlop={Math.max(0, (MIN_TOUCH - SIZE) / 2)}
        style={({ pressed }) => ({
          width: SIZE,
          height: SIZE,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressedOpacity(pressed),
        })}
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={24}
          color={colors.onBrandBand}
          accessible={false}
        />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={close}
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
              {t('account.menu')}
            </Text>
            <View style={{ alignItems: 'flex-start', gap: space(2) }}>
              <Button
                testID="account-menu.sign-out"
                title={t('auth.signOut')}
                variant="tertiary"
                icon={actionIcons.signOut}
                width="hug"
                loading={signingOut}
                onPress={onSignOut}
              />
              <DeleteAccountButton testID="account-menu.delete-account" />
            </View>
            <Button
              testID="account-menu.close"
              title={t('account.close')}
              variant="secondary"
              width="full"
              onPress={close}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
