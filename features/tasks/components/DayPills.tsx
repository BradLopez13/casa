import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { dayCountLabel, type StripDay } from '@/domain/tasks/strip';
import { dayPills } from '@/features/tasks/dayFilter';
import { t } from '@/i18n';
import { pressedOpacity } from '@/ui/buttonLook';
import { DOOR_MAX_SCALE } from '@/ui/door';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

type Props = {
  /** The seven days from today (`weekStrip`). */
  days: StripDay[];
  today: string;
  /** The day the list is filtered by, or null for «Todas». */
  chosen: string | null;
  names: Map<string, string>;
  onSelect: (date: string | null) => void;
};

/**
 * The row under the quick add of Tareas: «Todas · Hoy · Mañana · mié 22 ›», one line of pills
 * that scrolls sideways. It only filters the list; the chosen pill is filled with `selection`,
 * the rest outlined (§14.1, one selected style).
 */
export function DayPills({ days, today, chosen, names, onSelect }: Props) {
  const { colors, radii, space } = useTheme();
  const reduceMotion = useReduceMotion();
  const pills = dayPills(days, today);
  // Where each pill starts, so the row can bring the chosen one in: at ×1.6 «sáb» and later sat
  // past the edge, and choosing one left it half out of view (fase 10b).
  const scroll = useRef<ScrollView>(null);
  const starts = useRef(new Map<string, number>());
  const bringIn = (x: number, animated: boolean) =>
    scroll.current?.scrollTo({ x: Math.max(0, x - space(5)), animated });
  useEffect(() => {
    const x = starts.current.get(chosen ?? 'all');
    if (x !== undefined) bringIn(x, !reduceMotion);
    // Only a new choice moves the row; a pill laid out for the first time places itself below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);
  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="radiogroup"
      accessibilityLabel={t('tasks.pill.label')}
      // The row bleeds past the column so a half pill at the edge says there is more.
      style={{ marginHorizontal: -space(5) }}
      contentContainerStyle={{ paddingHorizontal: space(5), gap: space(2) }}
    >
      {pills.map((pill) => {
        const selected = pill.date === chosen;
        const day = pill.date === null ? null : days.find((d) => d.date === pill.date);
        return (
          <Pressable
            key={pill.date ?? 'all'}
            testID={`tasks.pill.${pill.date ?? 'all'}`}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={day ? dayCountLabel(day, today, names) : t('tasks.pill.allLabel')}
            onPress={() => onSelect(pill.date)}
            onLayout={(event) => {
              const key = pill.date ?? 'all';
              const first = !starts.current.has(key);
              starts.current.set(key, event.nativeEvent.layout.x);
              // Opened on a chosen day (a link, a turn): the row starts there, without a slide.
              if (first && selected && pill.date !== null)
                bringIn(event.nativeEvent.layout.x, false);
            }}
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH,
              paddingHorizontal: space(4),
              justifyContent: 'center',
              borderRadius: radii.pill,
              borderWidth: 1.5,
              borderColor: selected ? colors.selection : colors.outline,
              backgroundColor: selected ? colors.selection : 'transparent',
              opacity: pressedOpacity(pressed),
            })}
          >
            {/* The door's old control, moved down: it keeps the door's text cap so the row
                stays one line of pills at large text. */}
            <Text
              maxFontSizeMultiplier={DOOR_MAX_SCALE}
              style={{
                color: selected ? colors.onSelection : colors.ink,
                fontSize: 15,
                fontWeight: '600',
                fontVariant: ['tabular-nums'],
              }}
            >
              {pill.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
