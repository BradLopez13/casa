import { Pressable, View } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '../theme';
import { MIN_TOUCH } from '../tokens';

/**
 * The door's handle, on its bottom edge: a 36 × 4 bar inside a 44 × 44 touch target that
 * refreshes the pane the door sits in. Drawn in the door's bottom padding: Android drops taps that
 * reach past the parent, so only 2 dp of the bar overflow.
 */
export function DoorHandle({ onRefresh }: { onRefresh: () => void }) {
  const { colors, radii } = useTheme();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: MIN_TOUCH,
        alignItems: 'center',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('refresh.pull')}
        onPress={onRefresh}
        style={{
          width: MIN_TOUCH,
          height: MIN_TOUCH,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {/* 36 x 4 drawn, sitting on the door's edge. */}
        <View
          style={{
            width: 36,
            height: 4,
            marginBottom: -2,
            borderRadius: radii.pill,
            backgroundColor: colors.outline,
          }}
        />
      </Pressable>
    </View>
  );
}
