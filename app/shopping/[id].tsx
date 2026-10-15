import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ShoppingItem } from '@/domain/shopping/list';
import { useMembership } from '@/features/households/queries';
import { OfflineBand } from '@/features/shopping/components/OfflineBand';
import { shoppingErrorMessage } from '@/features/shopping/errors';
import {
  useDeleteItem,
  useEditItem,
  useIsOnline,
  useShoppingItems,
} from '@/features/shopping/queries';
import { shoppingNameSchema, shoppingQuantitySchema } from '@/features/shopping/schemas';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { ErrorText } from '@/ui/components/ErrorText';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { ModalSheet, useModalFill } from '@/ui/components/ModalSheet';
import { Screen } from '@/ui/components/Screen';
import { TextField } from '@/ui/components/TextField';
import { FocusRevealContext } from '@/ui/focusReveal';
import { formDensity } from '@/ui/sheet';
import { useTheme } from '@/ui/theme';
import { useCloseModal } from '@/ui/useCloseModal';
import { useLayout } from '@/ui/useLayout';
import { useRevealFocusedField } from '@/ui/useRevealFocusedField';

/** Mounted once inside its frame, so rotating never remounts the form. */
export default function EditShoppingItemRoute() {
  return (
    <ModalSheet>
      <EditShoppingItemScreen />
    </ModalSheet>
  );
}

function EditShoppingItemScreen() {
  const { colors, space } = useTheme();
  const closeModal = useCloseModal('/shopping');
  const { id } = useLocalSearchParams<{ id: string }>();
  const householdId = useMembership().data?.householdId;
  const itemsQuery = useShoppingItems(householdId);
  const online = useIsOnline();
  const found = itemsQuery.data?.find((item) => item.id === id && item.boughtAt === null);

  const edit = useEditItem();
  const remove = useDeleteItem();
  // Only an item that is still pending can be edited. Keep the last one seen while a delete
  // closes the modal (the refreshed list no longer has it), so it doesn't flash not-found.
  const [last, setLast] = useState<ShoppingItem | undefined>(found);
  if (found !== undefined && found !== last) setLast(found);
  const item = found ?? (remove.isPending || remove.isSuccess ? last : undefined);

  const [confirming, setConfirming] = useState(false);
  const locked = useRef(false);
  // Cancel isn't covered by the submit lock: only the first close goes back.
  const closed = useRef(false);
  const close = () => {
    if (closed.current) return;
    closed.current = closeModal();
  };

  if (item === undefined) {
    const loading = itemsQuery.data === undefined && !itemsQuery.isError;
    return (
      <Screen>
        {loading ? (
          <View style={{ paddingVertical: space(6), alignItems: 'center' }}>
            <ActivityIndicator color={colors.muted} accessibilityLabel={t('members.loading')} />
          </View>
        ) : (
          <>
            <ErrorText testID="shopping.edit.not-found">
              {itemsQuery.data === undefined
                ? shoppingErrorMessage(itemsQuery.error)
                : t('shopping.errors.ITEM_NOT_FOUND')}
            </ErrorText>
            <Button testID="shopping.edit.close" title={t('taskForm.close')} onPress={close} />
          </>
        )}
      </Screen>
    );
  }

  // Saving or deleting locks the other, and a success keeps both locked while the modal closes.
  const busy = edit.isPending || edit.isSuccess || remove.isPending || remove.isSuccess;
  const failure = remove.error ?? edit.error;

  // One submit at a time, checked synchronously: render-time state lags behind a quick double tap.
  const submit = (run: (done: { onSuccess: () => void; onError: () => void }) => void) => {
    if (locked.current) return;
    locked.current = true;
    run({
      onSuccess: () => {
        setConfirming(false);
        close();
      },
      onError: () => {
        locked.current = false;
        setConfirming(false);
      },
    });
  };

  return (
    <>
      <EditForm
        key={item.id}
        item={item}
        online={online}
        busy={busy}
        error={failure ? shoppingErrorMessage(failure) : null}
        onCancel={close}
        onSave={(name, quantity) => {
          remove.reset();
          submit((done) => edit.mutate({ id: item.id, name, quantity }, done));
        }}
        onDelete={() => setConfirming(true)}
      />
      <ConfirmDialog
        visible={confirming}
        title={t('shopping.edit.deleteTitle')}
        message={t('shopping.edit.deleteMessage')}
        confirmLabel={t('shopping.edit.deleteAction')}
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          if (!online) return;
          edit.reset();
          submit((done) => remove.mutate({ id: item.id }, done));
        }}
      />
    </>
  );
}

function EditForm({
  item,
  online,
  busy,
  error,
  onCancel,
  onSave,
  onDelete,
}: {
  item: ShoppingItem;
  online: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (name: string, quantity: string | null) => void;
  onDelete: () => void;
}) {
  const { colors, space } = useTheme();
  const { fill, avoidKeyboard, edges } = useModalFill();
  const density = formDensity(useLayout());
  const { scroll, reveal } = useRevealFocusedField();
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? '');

  const parsedName = shoppingNameSchema.safeParse(name);
  const parsedQuantity = shoppingQuantitySchema.safeParse(quantity);
  // An empty name only disables Save; a too-long one says why.
  const nameInvalid = name.trim() !== '' && !parsedName.success;
  const quantityInvalid = !parsedQuantity.success;
  const canSave = parsedName.success && parsedQuantity.success && online && !busy;
  const save = () => {
    if (parsedName.success && parsedQuantity.success) onSave(parsedName.data, parsedQuantity.data);
  };

  return (
    <SafeAreaView edges={edges} style={[fill, { backgroundColor: colors.page }]}>
      <ModalHeader
        title={t('shopping.edit.title')}
        step={density.headerStep}
        cancel={{
          testID: 'shopping.edit.cancel',
          label: t('shopping.edit.cancel'),
          onPress: onCancel,
        }}
        action={{
          testID: 'shopping.edit.save',
          label: t('shopping.edit.save'),
          onPress: save,
          disabled: !canSave,
          busy,
        }}
      />
      {online ? null : <OfflineBand />}
      <KeyboardAvoidingView
        enabled={avoidKeyboard}
        style={fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          {...scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: space(5),
            paddingTop: space(density.topStep),
            paddingBottom: space(density.bottomStep),
            gap: space(density.gapStep),
          }}
        >
          {/* Every field asks for it on focus, as in CenteredCard. */}
          <FocusRevealContext.Provider value={reveal}>
            <TextField
              testID="shopping.edit.name"
              label={t('shopping.edit.name')}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              error={nameInvalid ? t('shopping.errors.INVALID_ITEM_NAME') : undefined}
            />
            <TextField
              testID="shopping.edit.quantity"
              label={t('shopping.edit.quantity')}
              value={quantity}
              onChangeText={setQuantity}
              returnKeyType="done"
              error={quantityInvalid ? t('shopping.errors.INVALID_QUANTITY') : undefined}
            />
            {error ? <ErrorText testID="shopping.edit.error">{error}</ErrorText> : null}
            <Button
              testID="shopping.edit.delete"
              title={t('shopping.edit.delete')}
              variant="danger"
              disabled={!online || busy}
              onPress={onDelete}
            />
          </FocusRevealContext.Provider>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
