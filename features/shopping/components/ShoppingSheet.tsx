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
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { MemberMark } from '@/domain/members/marks';
import { iconFor } from '@/domain/shopping/icons';
import type { ShoppingItem } from '@/domain/shopping/list';
import type { HistoryEntry } from '@/domain/shopping/suggest';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { FADE_MS, layoutTransition } from '@/ui/motion';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { pressedOpacity } from '@/ui/buttonLook';
import { Magnet } from '@/ui/components/Magnet';
import { displayFontBold, MIN_TOUCH } from '@/ui/tokens';
import { isBoughtHeader, isItemRow, sheetRows, type SheetRow } from '../sheetRows';
import { ShoppingRow, type Glyph } from './ShoppingRow';
import { actionIcons } from '@/ui/actionIcons';

export type Flash = { id: string; count: number };

/** Room above the note for the magnet that holds it, so the first row stays clear of it. */
const HANG = 30;

/**
 * The pósit magnet that holds the note, hanging over its top-left corner. Decorative chrome: the
 * «+» of the field stays the screen's one primary.
 */
function HangingMagnet({ left }: { left: number }) {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left, zIndex: 1 }}>
      <Magnet
        size="md"
        decorative
        initial=""
        color="teal"
        accessibilityLabel=""
        glyph={{ node: null, fill: colors.accent }}
      />
    </View>
  );
}

const isPendingRow = (row: SheetRow) => isItemRow(row) && row.boughtAt === null;

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
  const rows = sheetRows(pending, bought, boughtCollapsed);
  // Dark has its 1 dp edge; light has none (the shadow did the work), so a hairline stands in.
  const hasEdge = noteEdge.borderWidth > 0;
  const edge = hasEdge ? noteEdge.borderWidth : StyleSheet.hairlineWidth;
  const edgeColor = hasEdge ? noteEdge.borderColor : colors.hairline;

  // The pending rows are one ruled pósit note; «En la bolsa» below is a plain sheet of its own.
  const pendingCount = rows.filter(isPendingRow).length;
  const margin = flush ? 0 : space(5);

  const cell = (index: number): ViewStyle => {
    const ruled = index < pendingCount;
    const firstCell = index === 0 || index === pendingCount;
    const lastCell = index === pendingCount - 1 || index === rows.length - 1;
    return {
      marginHorizontal: margin,
      marginTop: index === pendingCount && pendingCount > 0 ? space(4) : 0,
      backgroundColor: ruled ? colors.taskNote : colors.note,
      borderColor: edgeColor,
      borderLeftWidth: edge,
      borderRightWidth: edge,
      borderTopWidth: firstCell ? edge : 0,
      // Every ruled row ends in its hairline, so the lines survive virtualisation.
      borderBottomWidth: lastCell ? edge : ruled ? 1 : 0,
      ...(ruled && !lastCell ? { borderBottomColor: colors.hairline } : null),
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
        itemLayoutAnimation={layoutTransition(reduceMotion)}
        ListHeaderComponent={header}
        refreshControl={refreshControl}
        contentContainerStyle={contentContainerStyle}
        contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
        renderItem={({ item: row, index }) => (
          <View style={[column, index === 0 && pendingCount > 0 ? { paddingTop: HANG } : null]}>
            {index === 0 && pendingCount > 0 ? <HangingMagnet left={margin + space(3)} /> : null}
            <View style={cell(index)}>
              {isBoughtHeader(row) ? (
                <Animated.View
                  entering={reduceMotion ? undefined : FadeIn.duration(FADE_MS)}
                  exiting={reduceMotion ? undefined : FadeOut.duration(FADE_MS)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: space(3),
                    paddingHorizontal: space(4),
                    paddingTop: space(4),
                    paddingBottom: space(2),
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
                  icon={iconFor(row.normalizedName)}
                  // The ruled cells draw the lines between pending rows, so none of them adds its own.
                  first={index < pendingCount || isBoughtHeader(rows[index - 1] as SheetRow)}
                  unsent={unsentIds.has(row.id)}
                  buyerMark={row.boughtBy ? marks.get(row.boughtBy) : undefined}
                  buyerName={row.boughtBy ? names.get(row.boughtBy) : undefined}
                  flash={flash?.id === row.id ? flash.count : 0}
                  onToggle={() => onToggle(row)}
                  onOpen={row.boughtAt === null ? () => onOpen(row.id) : undefined}
                />
              )}
            </View>
          </View>
        )}
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
  const { colors, radii, noteEdge, shadows, space } = useTheme();
  return (
    <View style={{ paddingTop: HANG }}>
      <HangingMagnet left={space(3)} />
      <View
        style={{
          gap: space(3),
          padding: space(4),
          paddingTop: space(5),
          backgroundColor: colors.taskNote,
          borderRadius: radii.note,
          ...shadows.note,
          ...noteEdge,
        }}
      >
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
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space(2),
                    paddingHorizontal: space(4),
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    opacity: pressedOpacity(pressed),
                  })}
                >
                  <MaterialCommunityIcons
                    name={iconFor(entry.normalizedName) as Glyph}
                    size={18}
                    color={colors.muted}
                    accessible={false}
                    importantForAccessibility="no"
                  />
                  <Text style={{ color: colors.ink, fontSize: 15 }}>{entry.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}
