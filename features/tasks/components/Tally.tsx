import { Text, View } from 'react-native';
import type { TodayLine } from '@/domain/tasks/todayLine';
import { DayDone } from '@/features/tasks/components/DayDone';
import { todayLineText } from '@/features/tasks/todayLineText';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { DoorHeadline, useDoorType } from '@/ui/components/DoorHeader';
import { DOOR_MAX_SCALE } from '@/ui/door';
import { useTheme } from '@/ui/theme';

/**
 * The headline of Hoy's door (§2.4b): what is yours today (or the household's, or a member's) in
 * Rounded 800 at the door's headline size, the number a point larger in the same colour, and
 * under it, muted, what is left for the household. The end of the day is the brand's figures.
 */
export function TallyView({ line, onSeeAll }: { line: TodayLine; onSeeAll?: () => void }) {
  const { colors, space } = useTheme();
  const type = useDoorType();
  const { first, number, second } = todayLineText(line);
  const label = second === null ? first : `${first} ${second}`;

  const seeAll = line.kind === 'nothingMine' && line.unassigned > 0 && onSeeAll;
  return (
    <View>
      <View
        testID="today.door-line"
        accessible
        accessibilityLabel={label}
        accessibilityLiveRegion="polite"
      >
        {line.kind === 'allDone' ? <DayDone /> : <DoorHeadline text={first} number={number} />}
        {second !== null ? (
          <Text
            maxFontSizeMultiplier={DOOR_MAX_SCALE}
            style={{ marginTop: space(1), color: colors.muted, fontSize: type.secondary }}
          >
            {second}
          </Text>
        ) : null}
      </View>
      {seeAll ? (
        <Button
          testID="today.see-all"
          title={t('today.seeAll')}
          variant="tertiary"
          onPress={onSeeAll}
        />
      ) : null}
    </View>
  );
}
