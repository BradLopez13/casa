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

type Props = {
  items: readonly ShoppingItem[];
  history: readonly HistoryEntry[];
  onAdd: (name: string) => void;
  /** The name is already on the list: the screen flashes that row. */
  onListed: (id: string) => void;
};

/** The field on the door: type a name and send it, or tap one of the suggestions. */
export function AddItemField({ items, history, onAdd, onListed }: Props) {
  const { colors, radii, space } = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [focused, setFocused] = useState(false);

  const pendingSet = useMemo(() => pendingNames(items), [items]);
  const suggestions = useMemo(
    () => suggest(history, text, pendingSet),
    [history, text, pendingSet],
  );

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

  return (
    <View style={{ gap: space(3) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <TextInput
          testID="shopping.input"
          value={text}
          onChangeText={(next) => {
            setText(next);
            setError(undefined);
          }}
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
      {suggestions.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {suggestions.map((entry) => (
            <Pressable
              key={entry.normalizedName}
              testID={`shopping.suggestion.${entry.normalizedName}`}
              onPress={() => submit(entry.name)}
              accessibilityRole="button"
              accessibilityLabel={entry.name}
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
                {entry.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
