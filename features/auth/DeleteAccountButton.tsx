import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { toAppError } from '@/data/supabase/errors';
import { deleteFailureKind, transferNames, type DeleteFailure } from '@/domain/account/delete';
import { joinNames } from '@/domain/members/names';
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
  aloneIn,
  disabled = false,
  quiet = false,
}: {
  testID: string;
  /** The person is the only member of a household: deleting also deletes the household. */
  alone?: boolean;
  /**
   * With several households (bloque 12): those where the person is alone, which go with the
   * account. Left out with a single household, where `alone` says it.
   */
  aloneIn?: readonly string[];
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
  // The households to hand over first, when the server names them (bloque 12).
  const [toTransfer, setToTransfer] = useState<string[]>([]);
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
          <ErrorText testID={`${testID}.error`}>
            {toTransfer.length === 1
              ? t('settings.deleteAccountTransferOne', { household: toTransfer[0] ?? '' })
              : toTransfer.length > 1
                ? t('settings.deleteAccountTransferMany', { households: joinNames(toTransfer) })
                : t('settings.deleteAccountTransfer')}
          </ErrorText>
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
        testID="delete-account"
        visible={confirming}
        title={t('settings.deleteAccountTitle')}
        message={
          aloneIn !== undefined
            ? aloneIn.length > 0
              ? t('settings.deleteAccountMessageAloneIn', { households: joinNames(aloneIn) })
              : t('settings.deleteAccountMessage')
            : t(alone ? 'settings.deleteAccountMessageAlone' : 'settings.deleteAccountMessage')
        }
        confirmLabel={t('settings.deleteAccountAction')}
        destructive
        loading={deletion.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          deletion.run({
            onError: (e) => {
              const error = toAppError(e);
              setConfirming(false);
              setFailure(deleteFailureKind(error.code));
              setToTransfer(transferNames(error.detail));
            },
          })
        }
      />
    </View>
  );
}
