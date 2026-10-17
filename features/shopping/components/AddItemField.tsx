import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { ShoppingItem } from '@/domain/shopping/list';
import { pendingNames, planAdd } from '@/domain/shopping/screen';
import { suggest, type HistoryEntry } from '@/domain/shopping/suggest';
import { t } from '@/i18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ErrorText } from '@/ui/components/ErrorText';
import { useFocusReveal } from '@/ui/focusReveal';
import { buttonLook, buttonMetrics, pressedOpacity } from '@/ui/buttonLook';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import { shoppingNameSchema } from '../schemas';
import { actionIcons } from '@/ui/actionIcons';

const ADD_SIZE = 40;

type EntryOptions = {
  items: readonly ShoppingItem[];
  history: readonly HistoryEntry[];
  onAdd: (name: string) => void;
  /** The name is already on the list: the screen flashes that row. */
  onListed: (id: string) => void;
};

/**
 * What is being typed, its error and the history's suggestions for it. Held by the screen, so a
 * turn of the tablet (the field moves from the door to the left pane) keeps the text.
 */
export function useItemEntry({ items, history, onAdd, onListed }: EntryOptions) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const pendingSet = useMemo(() => pendingNames(items), [items]);
  const suggestions = useMemo(
    () => suggest(history, text, pendingSet),
    [history, text, pendingSet],
  );

  const change = (next: string) => {
    setText(next);
    setError(undefined);
  };

  /** False when the name was rejected, so the field can take focus back. */
  const submit = (name: string): boolean => {
    const parsed = shoppingNameSchema.safeParse(name);
    if (!parsed.success) {
      // An empty field asks for a name; a name too long says why.
      setError(
        name.trim() === '' ? t('shopping.nameRequired') : t('shopping.errors.INVALID_ITEM_NAME'),
      );
      return false;
    }
    const plan = planAdd(items, parsed.data);
    // Either way the name is on the list now, so the field is ready for the next one.
    setText('');
    if (plan.kind === 'listed') {
      setError(t('shopping.alreadyListed'));
      onListed(plan.id);
      return true;
    }
    setError(undefined);
    onAdd(plan.name);
    return true;
  };

  return { text, error, suggestions, change, submit };
}

export type ItemEntry = ReturnType<typeof useItemEntry>;

/**
 * The field: type a name and send it, or tap one of the suggestions that follow under it while
 * typing. On the door in one column, at the top of the left pane on two.
 */
export function AddItemField({ entry }: { entry: ItemEntry }) {
  const { colors, radii, space } = useTheme();
  const [focused, setFocused] = useState(false);
  const { text, error, change, submit } = entry;
  // In Compra's left pane, the field with its error and suggestions stays above the keyboard;
  // elsewhere (on the door) this does nothing.
  const reveal = useFocusReveal();
  const look = buttonLook('primary', 'default', 'enabled', colors);
  const block = useRef<View>(null);
  const input = useRef<TextInput>(null);
  const shown = entry.suggestions.length;
  useEffect(() => {
    if (focused) reveal(block.current);
  }, [focused, error, shown, reveal]);

  return (
    <View ref={block} style={{ gap: space(3) }}>
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
          testID="shopping.input"
          value={text}
          onChangeText={change}
          onSubmitEditing={() => {
            submit(text);
          }}
          returnKeyType="done"
          // Keeps the keyboard up so several items go in one after another.
          submitBehavior="submit"
          autoCapitalize="sentences"
          autoCorrect={false}
          placeholder={t('shopping.input')}
          accessibilityLabel={t('shopping.input')}
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
          testID="shopping.add"
          accessibilityRole="button"
          accessibilityLabel={t('shopping.add')}
          // The circle is 40 dp inside the pill; the slop brings the touch area to 44 dp.
          hitSlop={space(1)}
          onPress={() => {
            if (!submit(text)) input.current?.focus();
          }}
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
      {error ? <ErrorText testID="shopping.error">{error}</ErrorText> : null}
      <ItemSuggestions entry={entry} />
    </View>
  );
}

/** The history's names that match what is typed, as pills; a tap adds that name. */
function ItemSuggestions({ entry }: { entry: ItemEntry }) {
  const { colors, radii, space } = useTheme();
  if (entry.suggestions.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
      {entry.suggestions.map((suggestion) => (
        <Pressable
          key={suggestion.normalizedName}
          testID={`shopping.suggestion.${suggestion.normalizedName}`}
          onPress={() => entry.submit(suggestion.name)}
          accessibilityRole="button"
          accessibilityLabel={t('shopping.a11y.addSuggestion', { name: suggestion.name })}
          style={({ pressed }) => ({
            minHeight: MIN_TOUCH,
            justifyContent: 'center',
            paddingHorizontal: space(4),
            borderRadius: radii.pill,
            borderWidth: 1.5,
            borderColor: colors.cobalt,
            backgroundColor: colors.note,
            opacity: pressedOpacity(pressed),
          })}
        >
          <Text style={{ color: colors.cobalt, fontSize: 15 }}>{suggestion.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}
