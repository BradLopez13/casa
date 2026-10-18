import { useRouter } from 'expo-router';
import { useMemo, useState, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { sortList, type ShoppingItem } from '@/domain/shopping/list';
import { doorLine, pendingNames } from '@/domain/shopping/screen';
import { usual, type HistoryEntry } from '@/domain/shopping/suggest';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { newShoppingItemId } from '@/features/shopping/api';
import {
  AddItemField,
  useItemEntry,
  type ItemEntry,
} from '@/features/shopping/components/AddItemField';
import { OfflineBand } from '@/ui/components/OfflineBand';
import { useIsOnline } from '@/data/query/online';
import {
  BoughtTitle,
  EmptyList,
  ShoppingSheet,
  type Flash,
} from '@/features/shopping/components/ShoppingSheet';
import { shoppingErrorMessage } from '@/features/shopping/errors';
import {
  useAddItem,
  useClearBought,
  usePendingItemIds,
  useSetBought,
  useSetQuantity,
  useShoppingHistory,
  useShoppingItems,
} from '@/features/shopping/queries';
import {
  listTopStep,
  shoppingPanes,
  shoppingState,
  type ShoppingState,
} from '@/features/shopping/shoppingPanes';
import { useMemberLabels } from '@/features/tasks/useMemberLabels';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { DoorHeader } from '@/ui/components/DoorHeader';
import { ErrorText } from '@/ui/components/ErrorText';
import { FridgeRefresh, usePaneRefreshControl } from '@/ui/components/FridgeRefresh';
import { useNotice } from '@/ui/components/Notice';
import { TwoPane } from '@/ui/components/TwoPane';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { useOneColumn } from '@/ui/useOneColumn';
import { actionIcons } from '@/ui/actionIcons';

const NO_ITEMS: ShoppingItem[] = [];
const NO_HISTORY: HistoryEntry[] = [];

/** Everything a sheet needs but its rows. */
type SheetProps = Omit<ComponentProps<typeof ShoppingSheet>, 'pending' | 'bought' | 'flush'>;

/** What both layouts share: the entry, the sorted list, what the list area shows and the sheet. */
type ShoppingParts = {
  entry: ItemEntry;
  pending: ShoppingItem[];
  bought: ShoppingItem[];
  state: ShoppingState;
  /** Error, loading or empty, ready to place; null once there are rows. */
  stateView: ReactNode;
  sheet: SheetProps;
  online: boolean;
  /** The door around what each layout puts on it (the field in one column, nothing on two). */
  door: (children: ReactNode) => ReactElement;
  pulling: boolean;
  refresh: () => void;
};

export default function ShoppingScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const layout = useLayout();
  const notify = useNotice();
  const { userId } = useSession();
  const householdId = useMembership().data?.householdId;
  const itemsQuery = useShoppingItems(householdId);
  const historyQuery = useShoppingHistory(householdId);
  const membersQuery = useMembers(householdId);
  const addItem = useAddItem();
  const setBought = useSetBought();
  const clearBought = useClearBought();
  const setQuantity = useSetQuantity();
  const unsentIds = usePendingItemIds();
  const online = useIsOnline();
  // Only the pull gesture shows the refresh indicator, not background refetches.
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);

  const items = itemsQuery.data ?? NO_ITEMS;
  const history = historyQuery.data ?? NO_HISTORY;
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const { marks, names } = useMemberLabels(members, userId);
  const { pending, bought } = useMemo(() => sortList(items), [items]);

  const add = (name: string) => {
    if (householdId === undefined || userId === null) return;
    addItem.mutate({ id: newShoppingItemId(), householdId, name, quantity: null, userId });
  };

  // Held by the screen, not the field: a turn of the tablet moves the field between the door and
  // the left pane, and keeps what was typed.
  const entry = useItemEntry({
    items,
    history,
    onAdd: add,
    onListed: (id) => setFlash((current) => ({ id, count: (current?.count ?? 0) + 1 })),
  });

  const toggle = (item: ShoppingItem) => {
    if (householdId === undefined || userId === null) return;
    setBought.mutate({ id: item.id, householdId, bought: item.boughtAt === null, userId });
  };

  const changeQuantity = (item: ShoppingItem, quantity: string | null) => {
    if (householdId === undefined || quantity === item.quantity) return;
    setQuantity.mutate(
      { id: item.id, householdId, name: item.name, quantity },
      { onError: (error) => notify(shoppingErrorMessage(error)) },
    );
  };

  const [confirmingClear, setConfirmingClear] = useState(false);
  const clear = () => {
    if (householdId === undefined) return;
    setConfirmingClear(true);
  };
  // The dialog closes on confirm: the clear is scoped behind the queue and can pause offline, so
  // a dialog waiting on it could stay stuck. The «Vaciar bolsa» button shows it pending.
  const confirmClear = () => {
    setConfirmingClear(false);
    if (householdId === undefined) return;
    clearBought.mutate(
      { householdId },
      { onError: (error) => notify(shoppingErrorMessage(error)) },
    );
  };

  const open = (id: string) => router.push({ pathname: '/shopping/[id]', params: { id } });

  const refresh = async () => {
    // refetch() ignores `enabled`, so never fire the queries without a household.
    if (householdId === undefined) return;
    // Offline the pull ends at once: the cached list and the offline band are all there is.
    if (!online) return;
    setPulling(true);
    try {
      await Promise.all([itemsQuery.refetch(), historyQuery.refetch(), membersQuery.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  // Until the list loads the door has no count to say: a blank headline keeps its line height.
  const line = itemsQuery.data ? doorLine(pending.length) : null;
  const door = (children: ReactNode) => (
    <DoorHeader
      eyebrow={t('shopping.title')}
      heading={line?.text ?? ' '}
      headingNumber={line?.number}
      headingTestID="shopping.door-line"
      // An empty list says one thing: the headline, without the hint under it.
      secondary={state === 'empty' ? undefined : t('shopping.doorHint')}
    >
      {children}
    </DoorHeader>
  );

  // Loading, a load error with nothing cached, empty, or the sheet.
  const state = shoppingState({
    loaded: itemsQuery.data !== undefined,
    failed: itemsQuery.isError,
    itemCount: items.length,
  });
  let stateView: ReactNode = null;
  if (state === 'error') {
    stateView = (
      <View style={{ gap: space(3) }}>
        <ErrorText>{shoppingErrorMessage(itemsQuery.error)}</ErrorText>
        <Button
          title={t('errors.retry')}
          variant="secondary"
          icon={actionIcons.retry}
          loading={itemsQuery.isFetching}
          onPress={() => void itemsQuery.refetch()}
        />
      </View>
    );
  } else if (state === 'loading') {
    stateView = (
      <View style={{ paddingVertical: space(6), alignItems: 'center' }}>
        <ActivityIndicator color={colors.muted} accessibilityLabel={t('members.loading')} />
      </View>
    );
  } else if (state === 'empty') {
    stateView = (
      <EmptyList usual={usual(history, pendingNames(items))} onAdd={(name) => entry.submit(name)} />
    );
  }

  const parts: ShoppingParts = {
    entry,
    pending,
    bought,
    state,
    stateView,
    sheet: {
      unsentIds,
      marks,
      names,
      flash,
      online,
      clearing: clearBought.isPending,
      onToggle: toggle,
      onOpen: open,
      onClear: clear,
      onQuantity: changeQuantity,
    },
    online,
    door,
    pulling,
    refresh: () => void refresh(),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {paneMode(layout) === 'split' ? <ShoppingSplit {...parts} /> : <ShoppingStack {...parts} />}
      <ConfirmDialog
        visible={confirmingClear}
        title={t('shopping.clearTitle')}
        message={
          bought.length === 1
            ? t('shopping.clearMessageOne')
            : t('shopping.clearMessageOther', { count: bought.length })
        }
        confirmLabel={t('shopping.clearAction')}
        destructive
        onCancel={() => setConfirmingClear(false)}
        onConfirm={confirmClear}
      />
    </View>
  );
}

/**
 * One column (phones, small tablets): the virtualised sheet is the screen's scroller, pulled by the
 * door; the door, the field, the offline band and the state line are its header.
 */
function ShoppingStack({
  entry,
  pending,
  bought,
  state,
  stateView,
  sheet,
  online,
  door,
  pulling,
  refresh,
}: ShoppingParts) {
  const { space } = useTheme();
  const column = useOneColumn();
  const header = (
    <>
      {door(<AddItemField entry={entry} />)}
      {online ? null : <OfflineBand />}
      {/* The door runs edge to edge; the state line keeps to the column like the rows. */}
      <View style={[column, { paddingTop: space(listTopStep(online)) }]}>{stateView}</View>
    </>
  );
  return (
    <FridgeRefresh refreshing={pulling} onRefresh={refresh}>
      <ShoppingSheet
        flush
        header={header}
        column={column}
        pending={state === 'list' ? pending : NO_ITEMS}
        bought={state === 'list' ? bought : NO_ITEMS}
        contentContainerStyle={{ paddingBottom: space(10) }}
        {...sheet}
      />
    </FridgeRefresh>
  );
}

/**
 * Two panes (wide screens), under a fixed door and the offline band: the field and what is left
 * to buy on the left (the history's suggestions under the field while typing, as on the door);
 * the bought ones on the right. The door is outside any scroll, so the left pane takes the
 * pull-to-refresh.
 */
function ShoppingSplit({
  entry,
  pending,
  bought,
  state,
  stateView,
  sheet,
  online,
  door,
  pulling,
  refresh,
}: ShoppingParts) {
  const { colors, space } = useTheme();
  const refreshControl = usePaneRefreshControl(pulling, refresh);
  const panes = shoppingPanes(state, pending.length, bought.length);
  const pane = { paddingTop: space(listTopStep(online)), gap: space(5) };

  return (
    <TwoPane
      header={
        <>
          {door(null)}
          {online ? null : <OfflineBand />}
        </>
      }
      leftTestID="shopping.pane.pending"
      revealFocusedField
      rightTestID="shopping.pane.bought"
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: space(10) }}
      left={
        <View style={pane}>
          <AddItemField entry={entry} />
          {panes.leftState ? stateView : null}
          {panes.pendingSheet ? (
            <ShoppingSheet flush pending={pending} bought={NO_ITEMS} {...sheet} />
          ) : null}
        </View>
      }
      right={
        <View style={pane}>
          {panes.boughtSheet ? (
            <ShoppingSheet flush pending={NO_ITEMS} bought={bought} {...sheet} />
          ) : null}
          {/* Nothing bought yet: the pane still opens with the bought heading and a quiet line,
              so it never reads as a message for the whole screen. */}
          {panes.boughtEmpty ? (
            <View style={{ gap: space(3) }}>
              <BoughtTitle count={0} />
              <Text
                testID="shopping.pane.bought-empty"
                style={{ color: colors.muted, fontSize: 16 }}
              >
                {t('shopping.bought.empty')}
              </Text>
            </View>
          ) : null}
        </View>
      }
    />
  );
}
