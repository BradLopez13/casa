import { SectionList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import type { MemberMark } from '@/domain/members/marks';
import type { ShoppingItem } from '@/domain/shopping/list';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';
import { ShoppingRow } from './ShoppingRow';
import { actionIcons } from '@/ui/actionIcons';

export type Flash = { id: string; count: number };

type ListSection = { key: 'pending' | 'bought'; data: ShoppingItem[] };

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
 * The list as one white sheet on the page: a SectionList with what is left to buy, then
 * "Compradas". On two panes each side gets a sheet of its own (one of `pending` or `bought`
 * empty), so a marked row moves across.
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

  const sections: ListSection[] = [
    { key: 'pending', data: pending },
    { key: 'bought', data: bought },
  ];

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
        {/* The screen already scrolls (its door and field are part of the same scroll), so the
            list lays out in full; it still keys and renders its rows as a list. */}
        <SectionList<ShoppingItem, ListSection>
          sections={sections}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          renderItem={({ item, index, section }) => {
            const buyer = item.boughtBy ?? undefined;
            return (
              <ShoppingRow
                item={item}
                first={section.key === 'pending' && index === 0}
                unsent={unsentIds.has(item.id)}
                buyerMark={buyer ? marks.get(buyer) : undefined}
                buyerName={buyer ? names.get(buyer) : undefined}
                flash={flash?.id === item.id ? flash.count : 0}
                onToggle={() => onToggle(item)}
                onOpen={item.boughtAt === null ? () => onOpen(item.id) : undefined}
              />
            );
          }}
          renderSectionHeader={({ section }) =>
            section.key === 'bought' && bought.length > 0 ? (
              <Animated.View
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
                  backgroundColor: colors.note,
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
            ) : null
          }
        />
      </View>
    </View>
  );
}
