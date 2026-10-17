import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { buttonLook, buttonMetrics, pressedOpacity } from '@/ui/buttonLook';
import { useNotice } from '@/ui/components/Notice';
import { useTheme } from '@/ui/theme';
import { createTask, newTaskId } from '../api';
import { taskErrorMessage } from '../errors';
import { quickAddInput } from '../quickAddInput';
import { useTaskMutation } from '../queries';

const ADD_SIZE = 40;

type Props = {
  householdId: string | undefined;
  assigneeId: string | null;
  dueOn: string;
  placeholder: string;
  testID: string;
};

/**
 * One line to jot a task down: type a title and send it. It lands on the given day for the given
 * person, and the field stays ready for the next one.
 */
export function QuickAdd({ householdId, assigneeId, dueOn, placeholder, testID }: Props) {
  const { colors, radii, space } = useTheme();
  const notify = useNotice();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  // Set synchronously, so a second Enter before the next render cannot send twice. Cleared when
  // the create itself ends, not when the list refetch that follows it does.
  const inFlight = useRef(false);
  const look = buttonLook('primary', 'default', 'enabled', colors);
  const create = useTaskMutation(
    async ({ id, task }: { id: string; task: NonNullable<ReturnType<typeof quickAddInput>> }) => {
      try {
        return await createTask(id, householdId as string, task);
      } finally {
        inFlight.current = false;
      }
    },
  );

  const send = () => {
    const task = quickAddInput(text, assigneeId, dueOn);
    // An empty field is not an error: it just stays.
    if (task === null || householdId === undefined || inFlight.current) return;
    inFlight.current = true;
    // Cleared at once, so the next task can be typed while this one saves; put back on error.
    setText('');
    create.mutate(
      { id: newTaskId(), task },
      {
        onSuccess: () => {
          input.current?.focus();
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        },
        onError: (error) => {
          // The failed title comes back only if nothing was typed since; the notice carries the error.
          setText((typed) => (typed === '' ? task.title : typed));
          notify(taskErrorMessage(error));
        },
      },
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: buttonMetrics('primary').minHeight,
        paddingLeft: space(4),
        paddingRight: space(1),
        borderRadius: radii.pill,
        // Same width in every state, so focusing never shifts the text.
        borderWidth: 2,
        borderColor: focused ? colors.cobalt : colors.outline,
        backgroundColor: colors.note,
      }}
    >
      <TextInput
        ref={input}
        testID={testID}
        value={text}
        onChangeText={setText}
        onSubmitEditing={send}
        returnKeyType="done"
        // Keeps the keyboard up so several tasks go in one after another.
        submitBehavior="submit"
        autoCapitalize="sentences"
        autoCorrect={false}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        placeholderTextColor={colors.muted}
        selectionColor={colors.textSelection}
        cursorColor={colors.cobalt}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          alignSelf: 'stretch',
          paddingVertical: space(2),
          color: colors.ink,
          fontSize: 17,
        }}
      />
      <Pressable
        testID={`${testID}.submit`}
        accessibilityRole="button"
        accessibilityLabel={t('shopping.add')}
        // The circle is 40 dp inside the pill; the slop brings the touch area to 44 dp.
        hitSlop={space(1)}
        onPress={send}
        style={({ pressed }) => ({
          width: ADD_SIZE,
          height: ADD_SIZE,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.pill,
          backgroundColor: look.fill,
          opacity: pressedOpacity(pressed),
        })}
      >
        <Ionicons name={actionIcons.add} size={24} color={look.foreground} accessible={false} />
      </Pressable>
    </View>
  );
}
