import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { sortList, type ShoppingItem } from '@/domain/shopping/list';
import { countLabel } from '@/domain/shopping/screen';
import type { HistoryEntry } from '@/domain/shopping/suggest';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { newShoppingItemId } from '@/features/shopping/api';
import { AddItemField } from '@/features/shopping/components/AddItemField';
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
import { useMemberLabels } from '@/features/tasks/useMemberLabels';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { DoorHeader } from '@/ui/components/DoorHeader';
import { ErrorText } from '@/ui/components/ErrorText';
import { FridgeRefresh } from '@/ui/components/FridgeRefresh';
import { useNotice } from '@/ui/components/Notice';
import { useTheme } from '@/ui/theme';

const NO_ITEMS: ShoppingItem[] = [];
const NO_HISTORY: HistoryEntry[] = [];

export default function ShoppingScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
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
    setPulling(true);
    try {
      await Promise.all([itemsQuery.refetch(), historyQuery.refetch(), membersQuery.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  const door = (
    <DoorHeader
      title={t('shopping.title')}
      titleSize="medium"
      subtitle={itemsQuery.data ? countLabel(pending.length) : undefined}
    >
      <AddItemField
        items={items}
        history={history}
        onAdd={add}
        onListed={(id) => setFlash((current) => ({ id, count: (current?.count ?? 0) + 1 }))}
      />
    </DoorHeader>
  );

  // Loading, a load error with nothing cached, empty, or the sheet.
  let body;
  if (itemsQuery.data === undefined && itemsQuery.isError) {
    body = (
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
  } else if (itemsQuery.data === undefined) {
    body = (
      <View style={{ paddingVertical: space(6), alignItems: 'center' }}>
        <ActivityIndicator color={colors.muted} accessibilityLabel={t('members.loading')} />
      </View>
    );
  } else if (items.length === 0) {
    body = <Text style={{ color: colors.muted, fontSize: 16 }}>{t('shopping.empty')}</Text>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <FridgeRefresh refreshing={pulling} onRefresh={() => void refresh()}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: space(10) }}
        >
          {door}
          {online ? null : <OfflineBand />}
          <View style={{ paddingTop: online ? space(6) : space(2) }}>
            {body ? (
              <View style={{ paddingHorizontal: space(5) }}>{body}</View>
            ) : (
              <ShoppingSheet
                pending={pending}
                bought={bought}
                unsentIds={unsentIds}
                marks={marks}
                names={names}
                flash={flash}
                online={online}
                clearing={clearBought.isPending}
                onToggle={toggle}
                onOpen={open}
                onClear={clear}
              />
            )}
          </View>
        </ScrollView>
      </FridgeRefresh>
    </View>
  );
}
