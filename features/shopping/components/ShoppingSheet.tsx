import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import type { MemberMark } from '@/domain/members/marks';
import type { ShoppingItem } from '@/domain/shopping/list';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { useReduceMotion, useTheme } from '@/ui/theme';
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
};

/** «Compradas (n)»: the heading of the bought rows, also over the empty right pane on two. */
export function BoughtTitle({ count }: { count: number }) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.muted,
        fontSize: 15,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
      }}
    >
      {t('shopping.boughtTitle', { n: count })}
    </Text>
  );
}

/**
 * The list as one white sheet on the page: what is left to buy, then "Compradas". Every row is a
 * child of the same view, so a row that is marked keeps its identity and slides down. On two
 * panes each side gets a sheet of its own (one of `pending` or `bought` empty), so a marked row
 * moves across instead.
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
}: Props) {
  const { colors, radii, shadows, noteEdge, space } = useTheme();
  const reduceMotion = useReduceMotion();
  const layout = reduceMotion ? undefined : LinearTransition;

  const row = (item: ShoppingItem, first: boolean) => {
    const buyer = item.boughtBy ?? undefined;
    return (
      <ShoppingRow
        key={item.id}
        item={item}
        first={first}
        unsent={unsentIds.has(item.id)}
        buyerMark={buyer ? marks.get(buyer) : undefined}
        buyerName={buyer ? names.get(buyer) : undefined}
        flash={flash?.id === item.id ? flash.count : 0}
        onToggle={() => onToggle(item)}
        onOpen={item.boughtAt === null ? () => onOpen(item.id) : undefined}
      />
    );
  };

  return (
    <View
      style={{
        marginHorizontal: flush ? 0 : space(5),
        borderRadius: radii.note,
        backgroundColor: colors.note,
        ...shadows.note,
        ...noteEdge,
      }}
    >
      {/* Clips the rows' flash to the rounded corners; the outer view keeps the shadow. */}
      <View style={{ borderRadius: radii.note, overflow: 'hidden' }}>
        {/* One flat array of keyed children: a row that moves to "Compradas" keeps its identity. */}
        {[
          ...pending.map((item, index) => row(item, index === 0)),
          bought.length > 0 ? (
            <Animated.View
              key="bought-header"
              layout={layout}
              entering={FadeIn}
              exiting={FadeOut}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: space(3),
                paddingHorizontal: space(4),
                paddingTop: space(4),
                paddingBottom: space(2),
                borderTopWidth: pending.length > 0 ? StyleSheet.hairlineWidth : 0,
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
          ) : null,
          ...bought.map((item) => row(item, false)),
        ]}
      </View>
    </View>
  );
}
