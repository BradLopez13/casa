import { useRouter } from 'expo-router';
import { useMemo, useState, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { sortList, type ShoppingItem } from '@/domain/shopping/list';
import { countLabel } from '@/domain/shopping/screen';
import type { HistoryEntry } from '@/domain/shopping/suggest';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { newShoppingItemId } from '@/features/shopping/api';
import {
  AddItemField,
  useItemEntry,
  type ItemEntry,
} from '@/features/shopping/components/AddItemField';
import { OfflineBand } from '@/features/shopping/components/OfflineBand';
import { ShoppingSheet, type Flash } from '@/features/shopping/components/ShoppingSheet';
import { shoppingErrorMessage } from '@/features/shopping/errors';
import {
  useAddItem,
  useClearBought,
  useIsOnline,
  usePendingItemIds,
  useSetBought,
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
import { DoorHeader } from '@/ui/components/DoorHeader';
import { ErrorText } from '@/ui/components/ErrorText';
import { FridgeRefresh, usePaneRefreshControl } from '@/ui/components/FridgeRefresh';
import { useNotice } from '@/ui/components/Notice';
import { TwoPane } from '@/ui/components/TwoPane';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { useOneColumn } from '@/ui/useOneColumn';

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

  const clear = () => {
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

  const door = (children: ReactNode) => (
    <DoorHeader
      title={t('shopping.title')}
      titleSize="medium"
      subtitle={itemsQuery.data ? countLabel(pending.length) : undefined}
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
    stateView = <Text style={{ color: colors.muted, fontSize: 16 }}>{t('shopping.empty')}</Text>;
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
    },
    online,
    door,
    pulling,
    refresh: () => void refresh(),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {paneMode(layout) === 'split' ? <ShoppingSplit {...parts} /> : <ShoppingStack {...parts} />}
    </View>
  );
}

/** One column (phones, small tablets): the field on the door, then one sheet, pulled by the door. */
function ShoppingStack({
  entry,
  pending,
  bought,
  stateView,
  sheet,
  online,
  door,
  pulling,
  refresh,
}: ShoppingParts) {
  const { space } = useTheme();
  const column = useOneColumn();
  return (
    <FridgeRefresh refreshing={pulling} onRefresh={refresh}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space(10) }}
      >
        {door(<AddItemField entry={entry} />)}
        {online ? null : <OfflineBand />}
        {/* The door runs edge to edge; the sheet keeps to the column. */}
        <View style={[column, { paddingTop: space(listTopStep(online)) }]}>
          {stateView ?? <ShoppingSheet flush pending={pending} bought={bought} {...sheet} />}
        </View>
      </ScrollView>
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
          {panes.boughtEmpty ? (
            <Text testID="shopping.pane.bought-empty" style={{ color: colors.muted, fontSize: 16 }}>
              {t('shopping.bought.empty')}
            </Text>
          ) : null}
        </View>
      }
    />
  );
}
