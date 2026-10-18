import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { toAppError } from '@/data/supabase/errors';
import { deleteFailureKind, type DeleteFailure } from '@/domain/account/delete';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { ErrorText } from '@/ui/components/ErrorText';
import { pressedOpacity } from '@/ui/buttonLook';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import { useDeleteAccount } from './useDeleteAccount';

/**
 * "Borrar cuenta" with its confirmation and failure messages. `testID` is the button's; the
 * error and the go-to-members button use `${testID}.error` and `${testID}.go-members`.
 */
export function DeleteAccountButton({
  testID,
  alone = false,
  disabled = false,
  quiet = false,
}: {
  testID: string;
  /** The person is the only member of a household: deleting also deletes the household. */
  alone?: boolean;
  disabled?: boolean;
  /**
   * A small muted link («Borrar mi cuenta…») under the account's main action, away from it, in
   * place of the red tertiary. The confirmation is the same.
   */
  quiet?: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const deletion = useDeleteAccount();
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<DeleteFailure | null>(null);
  const open = () => {
    setFailure(null);
    setConfirming(true);
  };

  return (
    <View>
      {quiet ? (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={open}
          style={({ pressed }) => ({
            minHeight: MIN_TOUCH,
            alignSelf: 'flex-start',
            justifyContent: 'center',
            opacity: pressedOpacity(pressed),
          })}
        >
          <Text style={{ color: colors.muted, fontSize: 14, textDecorationLine: 'underline' }}>
            {t('settings.deleteAccountLink')}
          </Text>
        </Pressable>
      ) : (
        <Button
          testID={testID}
          width="hug"
          title={t('settings.deleteAccount')}
          variant="tertiary"
          tone="destructive"
          icon={actionIcons.delete}
          disabled={disabled}
          onPress={open}
        />
      )}
      {failure === 'transfer' ? (
        <>
          <ErrorText testID={`${testID}.error`}>{t('settings.deleteAccountTransfer')}</ErrorText>
          <Button
            testID={`${testID}.go-members`}
            title={t('settings.goToMembers')}
            variant="secondary"
            width="hug"
            onPress={() => router.push('/household/members')}
          />
        </>
      ) : failure === 'unknown' ? (
        <ErrorText testID={`${testID}.error`}>{t('members.errors.UNKNOWN')}</ErrorText>
      ) : null}
      <ConfirmDialog
        visible={confirming}
        title={t('settings.deleteAccountTitle')}
        message={t(alone ? 'settings.deleteAccountMessageAlone' : 'settings.deleteAccountMessage')}
        confirmLabel={t('settings.deleteAccountAction')}
        destructive
        loading={deletion.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          deletion.run({
            onError: (e) => {
              setConfirming(false);
              setFailure(deleteFailureKind(toAppError(e).code));
            },
          })
        }
      />
    </View>
  );
}
