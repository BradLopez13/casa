import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { ShoppingItem } from '@/domain/shopping/list';
import { pendingNames, planAdd } from '@/domain/shopping/screen';
import { suggest, type HistoryEntry } from '@/domain/shopping/suggest';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import { shoppingNameSchema } from '../schemas';

type EntryOptions = {
  items: readonly ShoppingItem[];
  history: readonly HistoryEntry[];
  onAdd: (name: string) => void;
  /** The name is already on the list: the screen flashes that row. */
  onListed: (id: string) => void;
};

/**
 * What is being typed, its error and the history's suggestions for it. Held by the screen, so the
 * field and the suggestions can sit apart (two panes) and a turn of the tablet keeps the text.
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

  const submit = (name: string) => {
    const parsed = shoppingNameSchema.safeParse(name);
    if (!parsed.success) {
      // An empty field just does nothing; a name too long says why.
      if (name.trim() !== '') setError(t('shopping.errors.INVALID_ITEM_NAME'));
      return;
    }
    const plan = planAdd(items, parsed.data);
    // Either way the name is on the list now, so the field is ready for the next one.
    setText('');
    if (plan.kind === 'listed') {
      setError(t('shopping.alreadyListed'));
      onListed(plan.id);
      return;
    }
    setError(undefined);
    onAdd(plan.name);
  };

  return { text, error, suggestions, change, submit };
}

export type ItemEntry = ReturnType<typeof useItemEntry>;

/**
 * The field: type a name and send it. With `withSuggestions` (one column, on the door) the
 * history's suggestions follow under it; on two panes they have the right pane to themselves.
 */
export function AddItemField({
  entry,
  withSuggestions = true,
}: {
  entry: ItemEntry;
  withSuggestions?: boolean;
}) {
  const { colors, radii, space } = useTheme();
  const [focused, setFocused] = useState(false);
  const { text, error, change, submit } = entry;

  return (
    <View style={{ gap: space(3) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <TextInput
          testID="shopping.input"
          value={text}
          onChangeText={change}
          onSubmitEditing={() => submit(text)}
          returnKeyType="done"
          // Keeps the keyboard up so several items go in one after another.
          submitBehavior="submit"
          autoCapitalize="sentences"
          autoCorrect={false}
          placeholder={t('shopping.input')}
          accessibilityLabel={t('shopping.input')}
          placeholderTextColor={colors.muted}
          selectionColor={colors.cobalt}
          cursorColor={colors.cobalt}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            minHeight: 48,
            paddingHorizontal: space(4),
            paddingVertical: space(3),
            borderRadius: radii.note,
            // Same width in every state, so focusing never shifts the text.
            borderWidth: 2,
            borderColor: focused ? colors.cobalt : colors.outline,
            backgroundColor: colors.note,
            color: colors.ink,
            fontSize: 17,
          }}
        />
        <Button
          testID="shopping.add"
          title={t('shopping.add')}
          disabled={text.trim() === ''}
          onPress={() => submit(text)}
        />
      </View>
      {error ? <ErrorText testID="shopping.error">{error}</ErrorText> : null}
      {withSuggestions ? <ItemSuggestions entry={entry} /> : null}
    </View>
  );
}

/** The history's names that match what is typed, as pills; a tap adds that name. */
export function ItemSuggestions({ entry }: { entry: ItemEntry }) {
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
          accessibilityLabel={suggestion.name}
          style={({ pressed }) => ({
            minHeight: MIN_TOUCH,
            justifyContent: 'center',
            paddingHorizontal: space(4),
            borderRadius: radii.pill,
            borderWidth: 1.5,
            borderColor: colors.cobalt,
            backgroundColor: colors.note,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text maxFontSizeMultiplier={1.3} style={{ color: colors.cobalt, fontSize: 15 }}>
            {suggestion.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
