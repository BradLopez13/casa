import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { iconFor } from '@/domain/shopping/icons';
import type { ShoppingItem } from '@/domain/shopping/list';
import { isDirty } from '@/features/forms/isDirty';
import { useDiscardGuard } from '@/features/forms/useDiscardGuard';
import { useMembership } from '@/features/households/queries';
import { useCloseOnHouseholdSwitch } from '@/features/households/useCloseOnSwitch';
import { OfflineBand } from '@/ui/components/OfflineBand';
import { useIsOnline } from '@/data/query/online';
import { shoppingErrorMessage } from '@/features/shopping/errors';
import { deleteItemWithUndo } from '@/features/shopping/deferredDelete';
import { deleteItemNow, useEditItem, useShoppingItems } from '@/features/shopping/queries';
import { shoppingNameSchema, shoppingQuantitySchema } from '@/features/shopping/schemas';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { useNotice } from '@/ui/components/Notice';
import { noticeDuration } from '@/ui/components/noticeTiming';
import { isScreenReaderOn } from '@/ui/a11y';
import { ErrorText } from '@/ui/components/ErrorText';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { ModalSheet, useModalFill } from '@/ui/components/ModalSheet';
import { PinnedNote } from '@/ui/components/PinnedNote';
import { PropertyMagnet } from '@/features/tasks/components/PropertyMagnets';
import { Screen } from '@/ui/components/Screen';
import { TextField } from '@/ui/components/TextField';
import { FocusRevealContext } from '@/ui/focusReveal';
import { formDensity } from '@/ui/sheet';
import { useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';
import { useCloseModal } from '@/ui/useCloseModal';
import { useLayout } from '@/ui/useLayout';
import { useRevealFocusedField } from '@/ui/useRevealFocusedField';

/** The product's name as a note title, a step under the task's (26) for shorter words. */
const TITLE_SIZE = 24;
/** No quantity, as the pill in the list says it (a symbol, so it stays out of the copy). */
const NO_QUANTITY = '—';

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

  const edit = useEditItem(householdId);
  const queryClient = useQueryClient();
  const notify = useNotice();
  // Deleted: the list hides it at once, and the sheet closes on the last one seen.
  const [deleted, setDeleted] = useState(false);
  // Only an item that is still pending can be edited. Keep the last one seen while a delete
  // closes the modal (the list no longer has it), so it doesn't flash not-found.
  const [last, setLast] = useState<ShoppingItem | undefined>(found);
  if (found !== undefined && found !== last) setLast(found);
  const item = found ?? (deleted ? last : undefined);

  const locked = useRef(false);
  // Cancel isn't covered by the submit lock: only the first close goes back.
  const closed = useRef(false);
  const close = () => {
    if (closed.current) return;
    closed.current = closeModal();
  };
  // Switched to another household meanwhile (bloque 12): this product is the other's.
  useCloseOnHouseholdSwitch(householdId, close);

  if (item === undefined) {
    const loading = itemsQuery.data === undefined && !itemsQuery.isError;
    return (
      <Screen>
        {loading ? (
          <View style={{ paddingVertical: space(6), alignItems: 'center' }}>
            <ActivityIndicator color={colors.muted} accessibilityLabel={t('common.loading')} />
          </View>
        ) : (
          <>
            <ErrorText testID="shopping.edit.not-found">
              {itemsQuery.data === undefined
                ? shoppingErrorMessage(itemsQuery.error)
                : t('shopping.errors.ITEM_NOT_FOUND')}
            </ErrorText>
            <Button
              testID="shopping.edit.close"
              title={t('taskForm.close')}
              variant="tertiary"
              icon={actionIcons.close}
              onPress={close}
            />
          </>
        )}
      </Screen>
    );
  }

  // Saving or deleting locks the other, and a success keeps both locked while the modal closes.
  const busy = edit.isPending || edit.isSuccess;
  const failure = edit.error;

  // Without a dialog, as a task (decisión 2 de Brad, 27 de octubre): the product leaves the list
  // at once, «Producto borrado. Deshacer» shows, and the server deletes it when the notice goes.
  const deleteNow = () => {
    if (!online || locked.current) return;
    locked.current = true;
    edit.reset();
    setDeleted(true);
    deleteItemWithUndo({
      id: item.id,
      remove: (id) => deleteItemNow(queryClient, householdId, id),
      notify,
      ms: noticeDuration({ action: true, screenReader: isScreenReaderOn() }),
      schedule: (fn, ms) => {
        const timer = setTimeout(fn, ms);
        return () => clearTimeout(timer);
      },
      watchBackground: (flush) => {
        const sub = AppState.addEventListener('change', (state) => {
          if (state === 'background') flush();
        });
        return () => sub.remove();
      },
    });
    close();
  };

  // One submit at a time, checked synchronously: render-time state lags behind a quick double tap.
  const submit = (run: (done: { onSuccess: () => void; onError: () => void }) => void) => {
    if (locked.current) return;
    locked.current = true;
    run({
      onSuccess: () => close(),
      onError: () => {
        locked.current = false;
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
        saving={edit.isPending || edit.isSuccess}
        error={failure ? shoppingErrorMessage(failure) : null}
        onCancel={close}
        onSave={(name, quantity) => {
          submit((done) => edit.mutate({ id: item.id, name, quantity }, done));
        }}
        onDelete={deleteNow}
      />
    </>
  );
}

function EditForm({
  item,
  online,
  busy,
  saving,
  error,
  onCancel,
  onSave,
  onDelete,
}: {
  item: ShoppingItem;
  online: boolean;
  /** Saving or deleting: either locks the form. */
  busy: boolean;
  /** Only the save's own progress spins the Save button. */
  saving: boolean;
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
  // What the form opened with: a refreshed item (realtime) must not count as an edit.
  const [opened] = useState({ name: item.name, quantity: item.quantity ?? '' });
  const dirty = isDirty(opened, { name, quantity });
  const { requestClose, dialog } = useDiscardGuard({
    dirty,
    onCancel,
    busy,
  });

  const parsedName = shoppingNameSchema.safeParse(name);
  const parsedQuantity = shoppingQuantitySchema.safeParse(quantity);
  const [triedSave, setTriedSave] = useState(false);
  const nameRef = useRef<TextInput>(null);
  // An empty name is explained on Save; a too-long one says why as it is typed.
  const nameBlank = name.trim() === '';
  const nameError = parsedName.success
    ? undefined
    : nameBlank
      ? triedSave
        ? t('shopping.nameRequired')
        : undefined
      : t('shopping.errors.INVALID_ITEM_NAME');
  const quantityInvalid = !parsedQuantity.success;
  // The quantity field opens from its magnet and only closes on a valid value, so it never goes
  // away mid-typing or hides what has to be fixed.
  const [quantityOpen, setQuantityOpen] = useState(false);
  const quantityShown = quantityOpen;
  const closeQuantity = () => {
    if (!quantityInvalid) setQuantityOpen(false);
  };
  // As in every edit sheet, Save waits dimmed until something changes (DESIGN.md, fase 10a).
  const canSave = online && !busy && dirty;
  const save = () => {
    if (parsedName.success && parsedQuantity.success) {
      onSave(parsedName.data, parsedQuantity.data);
      return;
    }
    setTriedSave(true);
    if (nameBlank) nameRef.current?.focus();
  };

  return (
    <>
      <SafeAreaView edges={edges} style={[fill, { backgroundColor: colors.page }]}>
        <ModalHeader
          title={t('shopping.edit.title')}
          step={density.headerStep}
          cancel={{
            testID: 'shopping.edit.cancel',
            label: t('shopping.edit.cancel'),
            onPress: requestClose,
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
            style={fill}
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
              {/* The same clean note as a task: the product's icon is the magnet that holds it, the
                  name is its title, the quantity the same property magnet as a task's, which opens a short
                  field (fase 10f). */}
              <PinnedNote pin={{ glyph: iconFor(item.normalizedName) }} side="top">
                <TextField
                  ref={nameRef}
                  bare
                  testID="shopping.edit.name"
                  label={t('shopping.edit.name')}
                  value={name}
                  onChangeText={setName}
                  returnKeyType="done"
                  error={nameError}
                  inputStyle={{
                    fontFamily: displayFontBold,
                    fontSize: TITLE_SIZE,
                    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
                  }}
                />
                <PropertyMagnet
                  testID="shopping.edit.quantity-chip"
                  glyph="scale-outline"
                  label={t('shopping.edit.quantityLabel')}
                  value={quantity.trim() === '' ? NO_QUANTITY : quantity.trim()}
                  spoken={
                    quantity.trim() === ''
                      ? t('shopping.edit.quantityNone')
                      : `${t('shopping.edit.quantityLabel')}, ${quantity.trim()}`
                  }
                  empty={quantity.trim() === ''}
                  open={quantityShown}
                  onPress={() => (quantityOpen ? closeQuantity() : setQuantityOpen(true))}
                />
                {/* A short field keeps its label: it is what tells it from the title above. */}
                {quantityShown ? (
                  <TextField
                    testID="shopping.edit.quantity"
                    label={t('shopping.edit.quantity')}
                    placeholder={t('shopping.edit.quantityExample')}
                    value={quantity}
                    onChangeText={setQuantity}
                    autoFocus={quantityOpen}
                    returnKeyType="done"
                    onSubmitEditing={closeQuantity}
                    error={quantityInvalid ? t('shopping.errors.INVALID_QUANTITY') : undefined}
                  />
                ) : null}
                {error ? <ErrorText testID="shopping.edit.error">{error}</ErrorText> : null}
              </PinnedNote>
              {/* Kept apart from the note, as the task sheet keeps «Borrar tarea». */}
              <Button
                testID="shopping.edit.delete"
                title={t('shopping.edit.delete')}
                variant="tertiary"
                tone="destructive"
                icon={actionIcons.delete}
                disabled={!online || busy}
                onPress={onDelete}
              />
            </FocusRevealContext.Provider>
          </ScrollView>
          {/* The foot: Save is the sheet's one pósit, fixed above the keyboard, as on the task
              sheet. */}
          <View
            style={{
              paddingHorizontal: space(5),
              paddingTop: space(3),
              paddingBottom: space(density.headerStep + 1),
              borderTopWidth: 1,
              borderTopColor: colors.hairline,
              backgroundColor: colors.page,
            }}
          >
            <Button
              testID="shopping.edit.save"
              title={t('shopping.edit.save')}
              width="full"
              loading={saving}
              disabled={!canSave}
              onPress={save}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {dialog}
    </>
  );
}
