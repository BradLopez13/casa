import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { toAppError } from '@/data/supabase/errors';
import { deleteFailureKind, type DeleteFailure } from '@/domain/account/delete';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { ErrorText } from '@/ui/components/ErrorText';
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
   * «Borrar mi cuenta…» as a plain tertiary, flush like «Cerrar sesión» above it, in place of the
   * red one. The confirmation is the same.
   */
  quiet?: boolean;
}) {
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
        <Button
          testID={testID}
          width="hug"
          flush
          title={t('settings.deleteAccountLink')}
          variant="tertiary"
          icon={actionIcons.delete}
          disabled={disabled}
          onPress={open}
        />
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
            variant="outlined"
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
