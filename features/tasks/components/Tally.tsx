import { Text, View } from 'react-native';
import type { Tally } from '@/domain/tasks/tally';
import { t } from '@/i18n';
import { useTheme } from '@/ui/theme';

const PIP = 8;

/** One pip per task (filled when done), with the count and whose tasks they are underneath. */
export function TallyView({ tally, scope }: { tally: Tally; scope: string }) {
  const { colors, space } = useTheme();
  const text =
    tally.total === 0
      ? t('today.tallyEmpty')
      : t('today.tally', { done: tally.done, total: tally.total });
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
