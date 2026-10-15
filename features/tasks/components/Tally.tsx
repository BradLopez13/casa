import { Text, View } from 'react-native';
import type { Tally } from '@/domain/tasks/tally';
import { t } from '@/i18n';
import { useDoorCompact } from '@/ui/components/DoorHeader';
import { useTheme } from '@/ui/theme';

const PIP = 8;

/**
 * One pip per task (filled when done), with the count and whose tasks they are underneath. In a
 * compact door (a phone on its side) only the count shows, beside the title: the selected magnet
 * already says whose tasks they are, and the scope stays in the label for screen readers.
 */
export function TallyView({ tally, scope }: { tally: Tally; scope: string }) {
  const { colors, space } = useTheme();
  const compact = useDoorCompact();
  const text =
    tally.total === 0
      ? t('today.tallyEmpty')
      : t('today.tally', { done: tally.done, total: tally.total });
  if (compact) {
    return (
      <Text
        accessibilityLabel={`${text} · ${scope}`}
        maxFontSizeMultiplier={1.3}
        style={{ color: colors.ink, fontSize: 15, fontVariant: ['tabular-nums'] }}
      >
        {text}
      </Text>
    );
  }
  return (
    <View style={{ gap: space(1) }}>
      {tally.total > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}
        >
          {Array.from({ length: tally.total }, (_, i) => (
            <View
              key={i}
              style={{
                width: PIP,
                height: PIP,
                borderRadius: PIP / 2,
                ...(i < tally.done
                  ? { backgroundColor: colors.ink }
                  : { borderWidth: 1.5, borderColor: colors.outline }),
              }}
            />
          ))}
        </View>
      ) : null}
      <Text
        maxFontSizeMultiplier={1.3}
        style={{ color: colors.ink, fontSize: 15, fontVariant: ['tabular-nums'] }}
      >
        {text}
        <Text style={{ color: colors.muted }}>{` · ${scope}`}</Text>
      </Text>
    </View>
  );
}
