import { ScrollView, Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import type { Member } from '@/features/households/api';
import { t } from '@/i18n';
import { Magnet } from '@/ui/components/Magnet';
import { useTheme } from '@/ui/theme';

type Props = {
  members: Member[];
  marks: Map<string, MemberMark>;
  userId: string | null;
  selected: string | null;
  onToggle: (userId: string) => void;
};

/** A straight row of magnets, one per person; tapping one filters by them, tapping again clears. */
export function MemberFilter({ members, marks, userId, selected, onToggle }: Props) {
  const { colors, space } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('tasks.filterLabel')}
      contentContainerStyle={{ gap: space(3), paddingVertical: space(1) }}
    >
      {members.map((member) => {
        const mark = marks.get(member.userId);
        if (!mark) return null;
        const name = member.userId === userId ? t('members.youName') : member.displayName;
        return (
          <View key={member.userId} style={{ alignItems: 'center', gap: space(1) }}>
            <Magnet
              initial={mark.initial}
              color={mark.color}
              size="lg"
              selected={member.userId === selected}
              accessibilityRole="radio"
              accessibilityLabel={name}
              testID={`member-filter.${member.userId}`}
              onPress={() => onToggle(member.userId)}
            />
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={{ color: colors.muted, fontSize: 13 }}
            >
              {name}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
