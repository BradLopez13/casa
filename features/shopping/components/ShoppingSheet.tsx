import { useState, type ReactElement } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { MemberMark } from '@/domain/members/marks';
import { categorize, type Category } from '@/domain/shopping/categories';
import type { ShoppingItem } from '@/domain/shopping/list';
import type { HistoryEntry } from '@/domain/shopping/suggest';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { pressedOpacity } from '@/ui/buttonLook';
import { displayFontBold, MIN_TOUCH } from '@/ui/tokens';
import {
  isBoughtHeader,
  isCategoryHeader,
  sheetRows,
  type SheetGrouping,
  type SheetRow,
} from '../sheetRows';
import { CategoryPicker } from './CategoryPicker';
import { ShoppingRow } from './ShoppingRow';
import { actionIcons } from '@/ui/actionIcons';

export type Flash = { id: string; count: number };

type Props = {
  pending: ShoppingItem[];
  bought: ShoppingItem[];
  /** Items with a change still on its way to the server. */
  unsentIds: Set<string>;
  marks: Map<string, MemberMark>;
  names: Map<string, string>;
  flash: Flash | null;
  /** «Vaciar bolsa» only runs online. */
  online: boolean;
  clearing: boolean;
  onToggle: (item: ShoppingItem) => void;
  onOpen: (id: string) => void;
  onClear: () => void;
  /** Groups what is left to buy by category, in the household order, under a quiet heading. */
  grouping?: SheetGrouping;
  /** Moves a pending item to another category (for the whole household). */
  onCategory?: (item: ShoppingItem, category: Category) => void;
  /** No side margin of its own: inside a TwoPane pane, which already keeps the gutter. */
  flush?: boolean;
  /**
   * Makes the list the screen's scroller: what sits above the rows (the door, the offline band,
   * the state line) is its header, and `FridgeRefresh` hands over the props below. Without it the
   * list lays out in full inside a pane that scrolls on its own.
   */
  header?: ReactElement;
  /** The one-column frame each row keeps to (`useOneColumn`). */
  column?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentInsetAdjustmentBehavior?: 'automatic' | 'scrollableAxes' | 'never' | 'always';
};

/** «En la bolsa (n)»: the heading of the bought rows, also over the empty right pane on two. */
export function BoughtTitle({ count }: { count: number }) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.muted,
        fontFamily: displayFontBold,
        fontSize: 15,
        fontVariant: ['tabular-nums'],
      }}
    >
      {t('shopping.boughtTitle', { n: count })}
    </Text>
  );
}

/**
 * The list as one white sheet on the page: a single keyed FlatList with what is left to buy, the
 * «En la bolsa» header (a toggle that folds the bought ones), then the bought ones. Every row keeps its item id as key, so a row that is
 * marked keeps its identity and slides down (`itemLayoutAnimation`). The sheet's look (paper,
 * rounded ends) is drawn cell by cell, since the cells are virtualised. On two panes each side
 * gets a sheet of its own (one of `pending` or `bought` empty), so a marked row moves across.
 */
export function ShoppingSheet({
  pending,
  bought,
  unsentIds,
  marks,
  names,
  flash,
  online,
  clearing,
  onToggle,
  onOpen,
  onClear,
  grouping,
  onCategory,
  flush = false,
  header,
  column,
  refreshControl,
  contentContainerStyle,
  contentInsetAdjustmentBehavior,
}: Props) {
  const { colors, radii, noteEdge, space } = useTheme();
  const reduceMotion = useReduceMotion();
  const [boughtCollapsed, setBoughtCollapsed] = useState(false);
  const [picking, setPicking] = useState<{
    item: ShoppingItem;
    name: string;
    category: Category;
  } | null>(null);
  const rows = sheetRows(pending, bought, boughtCollapsed, grouping);
  const categoryOf = (item: ShoppingItem) =>
    item.category ?? categorize(item.normalizedName, grouping?.overrides);
  // Dark has its 1 dp edge; light has none (the shadow did the work), so a hairline stands in.
  const hasEdge = noteEdge.borderWidth > 0;
  const edge = hasEdge ? noteEdge.borderWidth : StyleSheet.hairlineWidth;
  const edgeColor = hasEdge ? noteEdge.borderColor : colors.hairline;

  const cell = (index: number): ViewStyle => {
    const firstCell = index === 0;
    const lastCell = index === rows.length - 1;
    return {
      marginHorizontal: flush ? 0 : space(5),
      backgroundColor: colors.note,
      borderColor: edgeColor,
      borderLeftWidth: edge,
      borderRightWidth: edge,
      borderTopWidth: firstCell ? edge : 0,
      borderBottomWidth: lastCell ? edge : 0,
      borderTopLeftRadius: firstCell ? radii.note : 0,
      borderTopRightRadius: firstCell ? radii.note : 0,
      borderBottomLeftRadius: lastCell ? radii.note : 0,
      borderBottomRightRadius: lastCell ? radii.note : 0,
      // Clips the rows' flash to the rounded ends.
      overflow: 'hidden',
    };
  };

  return (
    <>
      <Animated.FlatList<SheetRow>
        data={rows}
        keyExtractor={(row) => row.id}
        scrollEnabled={header !== undefined}
        keyboardShouldPersistTaps="handled"
        itemLayoutAnimation={reduceMotion ? undefined : LinearTransition}
        ListHeaderComponent={header}
        refreshControl={refreshControl}
        contentContainerStyle={contentContainerStyle}
        contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
        renderItem={({ item: row, index }) => (
          <View style={column}>
            <View style={cell(index)}>
              {isCategoryHeader(row) ? (
                <Text
                  testID={`shopping.${row.id}`}
                  accessibilityRole="header"
                  style={{
                    color: colors.muted,
                    fontFamily: displayFontBold,
                    fontSize: 13,
                    paddingHorizontal: space(4),
                    paddingTop: space(index > 0 ? 4 : 3),
                    paddingBottom: space(1),
                    borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                    borderTopColor: colors.hairline,
                  }}
                >
                  {t(`shopping.category.${row.category}`)}
                </Text>
              ) : isBoughtHeader(row) ? (
                <Animated.View
                  entering={reduceMotion ? undefined : FadeIn}
                  exiting={reduceMotion ? undefined : FadeOut}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: space(3),
                    paddingHorizontal: space(4),
                    paddingTop: space(4),
                    paddingBottom: space(2),
                    borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                    borderTopColor: colors.hairline,
                  }}
                >
                  <Pressable
                    testID="shopping.bought.toggle"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !boughtCollapsed }}
                    onPress={() => setBoughtCollapsed((c) => !c)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space(2),
                      minHeight: MIN_TOUCH,
                      opacity: pressedOpacity(pressed),
                    })}
                  >
                    <Ionicons
                      name={boughtCollapsed ? 'chevron-forward' : 'chevron-down'}
                      size={18}
                      color={colors.muted}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    />
                    <BoughtTitle count={bought.length} />
                  </Pressable>
                  <Button
                    testID="shopping.clear"
                    title={t('shopping.clear')}
                    variant="tertiary"
                    tone="destructive"
                    icon={actionIcons.delete}
                    disabled={!online}
                    loading={clearing}
                    onPress={onClear}
                  />
                </Animated.View>
              ) : (
                <ShoppingRow
                  item={row}
                  first={index === 0 || isCategoryHeader(rows[index - 1] as SheetRow)}
                  unsent={unsentIds.has(row.id)}
                  buyerMark={row.boughtBy ? marks.get(row.boughtBy) : undefined}
                  buyerName={row.boughtBy ? names.get(row.boughtBy) : undefined}
                  flash={flash?.id === row.id ? flash.count : 0}
                  onToggle={() => onToggle(row)}
                  onOpen={row.boughtAt === null ? () => onOpen(row.id) : undefined}
                  category={row.boughtAt === null && onCategory ? categoryOf(row) : undefined}
                  onCategory={() =>
                    setPicking({ item: row, name: row.name, category: categoryOf(row) })
                  }
                />
              )}
            </View>
          </View>
        )}
      />
      <CategoryPicker
        target={picking}
        onCancel={() => setPicking(null)}
        onPick={(category) => {
          const item = picking?.item;
          setPicking(null);
          if (item && category !== picking?.category) onCategory?.(item, category);
        }}
      />
    </>
  );
}

/**
 * The empty list: the invitation to add, and, when the history has names that are not on the list,
 * «¿Falta algo de lo de siempre?» with the most used ones as pills; a tap adds that name.
 */
export function EmptyList({
  usual,
  onAdd,
}: {
  usual: readonly HistoryEntry[];
  onAdd: (name: string) => void;
}) {
  const { colors, radii, space } = useTheme();
  return (
    <View style={{ gap: space(3) }}>
      <Text style={{ color: colors.muted, fontSize: 16 }}>{t('shopping.empty')}</Text>
      {usual.length > 0 ? (
        <>
          <Text style={{ color: colors.muted, fontSize: 15 }}>{t('shopping.usualTitle')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {usual.map((entry) => (
              <Pressable
                key={entry.normalizedName}
                testID={`shopping.usual.${entry.normalizedName}`}
                onPress={() => onAdd(entry.name)}
                accessibilityRole="button"
                accessibilityLabel={t('shopping.a11y.addSuggestion', { name: entry.name })}
                style={({ pressed }) => ({
                  minHeight: MIN_TOUCH,
                  justifyContent: 'center',
                  paddingHorizontal: space(4),
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  opacity: pressedOpacity(pressed),
                })}
              >
                <Text style={{ color: colors.ink, fontSize: 15 }}>{entry.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
