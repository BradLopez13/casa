import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import type { Member } from '@/features/households/api';
import { t } from '@/i18n';
import { Magnet } from '@/ui/components/Magnet';
import { useTheme } from '@/ui/theme';

type Props = {
  value: string | null;
  members: Member[];
  marks: Map<string, MemberMark>;
  userId: string | null;
  onChange: (id: string | null) => void;
};

function Choice({ name, children }: { name: string; children: ReactNode }) {
  const { colors, space } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space(1) }}>
      {children}
      {/* The magnet already carries the name for screen readers. */}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ color: colors.muted, fontSize: 13, maxWidth: 72 }}
      >
        {name}
      </Text>
    </View>
  );
}

/** Who does it: one magnet per member plus an empty magnet for nobody. */
export function AssigneePicker({ value, members, marks, userId, onChange }: Props) {
  const { space } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('taskForm.assigneeLabel')}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}
    >
      {members.map((member) => {
        const mark = marks.get(member.userId);
        if (!mark) return null;
        const name = member.userId === userId ? t('members.youName') : member.displayName;
        return (
          <Choice key={member.userId} name={name}>
            <Magnet
              initial={mark.initial}
              color={mark.color}
              size="md"
              selected={member.userId === value}
              accessibilityRole="radio"
              accessibilityLabel={name}
              testID={`task-form.assignee.${member.userId}`}
              onPress={() => onChange(member.userId)}
            />
          </Choice>
        );
      })}
      <Choice name={t('taskForm.nobody')}>
        <Magnet
          initial=""
          color="mustard"
          variant="empty"
          size="md"
          selected={value === null}
          accessibilityRole="radio"
          accessibilityLabel={t('taskForm.nobody')}
          testID="task-form.assignee.none"
          onPress={() => onChange(null)}
        />
      </Choice>
    </View>
  );
}
