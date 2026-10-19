import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { completeBoxLook } from '../completeBox';
import { useTheme } from '../theme';
import { COMPLETE_BOX } from '../tokens';

const RADIUS = 8;
const EDGE = 2;
const CHECK = 20;

/** The box that completes a task. Drawing only: the note's Pressable carries the role and label. */
export function CompleteBox({ checked }: { checked: boolean }) {
  const { colors } = useTheme();
  const look = completeBoxLook(checked, colors);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: COMPLETE_BOX,
        height: COMPLETE_BOX,
        flexShrink: 0,
        borderRadius: RADIUS,
        borderWidth: EDGE,
        borderColor: look.border,
        backgroundColor: look.fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {look.check ? (
        <Ionicons name="checkmark" size={CHECK} color={look.check} accessible={false} />
      ) : null}
    </View>
  );
}
