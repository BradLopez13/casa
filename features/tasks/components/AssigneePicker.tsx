import type { ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import type { Member } from '@/features/households/api';
import { t } from '@/i18n';
import { pressedOpacity } from '@/ui/buttonLook';
import { Magnet } from '@/ui/components/Magnet';
import { useTheme } from '@/ui/theme';
import { magnetSizes, MIN_TOUCH } from '@/ui/tokens';

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
        numberOfLines={2}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}
      >
        {name}
      </Text>
    </View>
  );
}

const NOBODY_SLOP = Math.max(0, Math.ceil((MIN_TOUCH - magnetSizes.md) / 2));

/** The «Sin asignar» choice: a plain circle with a person outline, not the dashed empty magnet of a task. */
function NobodyChoice({ selected, onPress }: { selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID="task-form.assignee.none"
      onPress={onPress}
      hitSlop={NOBODY_SLOP}
      accessibilityRole="radio"
      accessibilityLabel={t('taskForm.nobody')}
      accessibilityState={{ selected, checked: selected }}
      style={({ pressed }) => ({ opacity: pressedOpacity(pressed) })}
    >
      <View
        style={{
          padding: 3,
          borderWidth: 2,
          borderRadius: (magnetSizes.md + 10) / 2,
          borderColor: selected ? colors.selection : 'transparent',
          backgroundColor: selected ? colors.door : 'transparent',
        }}
      >
        <View
          style={{
            width: magnetSizes.md,
            height: magnetSizes.md,
            borderRadius: magnetSizes.md / 2,
            borderWidth: 1.5,
            borderColor: colors.outline,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="person-outline" size={20} color={colors.muted} accessible={false} />
        </View>
      </View>
    </Pressable>
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
        <NobodyChoice selected={value === null} onPress={() => onChange(null)} />
      </Choice>
    </View>
  );
}
