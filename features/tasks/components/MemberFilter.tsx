import { ScrollView, Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import type { Member } from '@/features/households/api';
import { t } from '@/i18n';
import { useDoorCompact } from '@/ui/components/DoorHeader';
import { Magnet } from '@/ui/components/Magnet';
import { NidoSymbol } from '@/ui/components/NidoSymbol';
import { useTheme } from '@/ui/theme';

type Props = {
  members: Member[];
  marks: Map<string, MemberMark>;
  userId: string | null;
  selected: string | null;
  onSelect: (userId: string | null) => void;
  /** Medium magnets without names, as in a compact door, even in a full one. */
  dense?: boolean;
};

/**
 * A radio row of magnets: "Todos" first (the Nido symbol on slate, chosen by default), then one per
 * person. Tapping one filters by them; tapping the chosen one keeps it, "Todos" clears.
 * In a compact door (a phone on its side) the magnets are the medium size, ring included still a
 * 48 dp target, and the names under them give way, so the row is one touch height: each magnet
 * keeps its initial and colour on screen and the name for screen readers. `dense` forces that
 * layout in a full door.
 */
export function MemberFilter({ members, marks, userId, selected, onSelect, dense = false }: Props) {
  const { colors, space } = useTheme();
  const compact = useDoorCompact() || dense;
  const allName = t('tasks.filterAll');
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('tasks.filterLabel')}
      // Dense, the magnets close up to 8 dp so «Todos» and five people fit across a 375 dp phone.
      contentContainerStyle={{
        gap: compact ? space(2) : space(3),
        paddingVertical: compact ? 0 : space(1),
      }}
    >
      <View style={{ alignItems: 'center', gap: space(1) }}>
        <Magnet
          initial=""
          color="teal"
          size={compact ? 'md' : 'lg'}
          selected={selected === null}
          glyph={{ node: <NidoSymbol size={24} onSlate />, fill: colors.brandBand }}
          accessibilityRole="radio"
          accessibilityLabel={allName}
          testID="member-filter.all"
          onPress={() => onSelect(null)}
        />
        {compact ? null : (
          <Text
            numberOfLines={2}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}
          >
            {allName}
          </Text>
        )}
      </View>
      {members.map((member) => {
        const mark = marks.get(member.userId);
        if (!mark) return null;
        const name = member.userId === userId ? t('members.youName') : member.displayName;
        return (
          <View key={member.userId} style={{ alignItems: 'center', gap: space(1) }}>
            <Magnet
              initial={mark.initial}
              color={mark.color}
              size={compact ? 'md' : 'lg'}
              selected={member.userId === selected}
              accessibilityRole="radio"
              accessibilityLabel={name}
              testID={`member-filter.${member.userId}`}
              onPress={() => onSelect(member.userId)}
            />
            {/* The magnet already carries the name for screen readers. */}
            {compact ? null : (
              <Text
                numberOfLines={2}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}
              >
                {name}
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
