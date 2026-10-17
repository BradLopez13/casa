import type { ReactElement } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import type { MemberMark } from '@/domain/members/marks';
import type { ShoppingItem } from '@/domain/shopping/list';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';
import { isBoughtHeader, sheetRows, type SheetRow } from '../sheetRows';
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
  /** "Limpiar compradas" only runs online. */
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

/** «Compradas (n)»: the heading of the bought rows, also over the empty right pane on two. */
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
 * «Compradas» header, then the bought ones. Every row keeps its item id as key, so a row that is
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
  const rows = sheetRows(pending, bought);
  const edge = noteEdge.borderWidth;

  const cell = (index: number): ViewStyle => {
    const firstCell = index === 0;
    const lastCell = index === rows.length - 1;
    return {
      marginHorizontal: flush ? 0 : space(5),
      backgroundColor: colors.note,
      borderColor: noteEdge.borderColor,
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
            {isBoughtHeader(row) ? (
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
                <BoughtTitle count={bought.length} />
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
                first={index === 0}
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
  );
}
