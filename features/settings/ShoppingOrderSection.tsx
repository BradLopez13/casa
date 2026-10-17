import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { CATEGORIES, DEFAULT_ORDER, type Category } from '@/domain/shopping/categories';
import { useMembership } from '@/features/households/queries';
import { shoppingErrorMessage } from '@/features/shopping/errors';
import { useItemCategories, useSetCategoryOrder } from '@/features/shopping/queries';
import { t } from '@/i18n';
import { pressedOpacity } from '@/ui/buttonLook';
import { useNotice } from '@/ui/components/Notice';
import { useTheme } from '@/ui/theme';
import { displayFontBold, MIN_TOUCH } from '@/ui/tokens';

/** The household order with any category it lacks appended, as the sheet shows it. */
function fullOrder(order: readonly Category[] | null): Category[] {
  const base = order ?? DEFAULT_ORDER;
  return [...base, ...CATEGORIES.filter((c) => !base.includes(c))];
}

function moved(order: readonly Category[], index: number, by: -1 | 1): Category[] {
  const next = [...order];
  const other = index + by;
  const a = next[index];
  const b = next[other];
  if (a === undefined || b === undefined) return next;
  next[index] = b;
  next[other] = a;
  return next;
}

/**
 * «Orden de la compra»: the ten categories in the household's aisle order, each with Subir and
 * Bajar. A move is saved at once for the whole household (online only).
 */
export function ShoppingOrderSection() {
  const { colors, space } = useTheme();
  const notify = useNotice();
  const householdId = useMembership().data?.householdId;
  const { order } = useItemCategories(householdId);
  const save = useSetCategoryOrder();
  const list = fullOrder(order);

  const move = (index: number, by: -1 | 1) => {
    if (householdId === undefined) return;
    save.mutate(
      { householdId, order: moved(list, index, by) },
      { onError: (error) => notify(shoppingErrorMessage(error)) },
    );
  };

  const arrow = (category: Category, index: number, by: -1 | 1) => {
    const up = by === -1;
    const disabled = up ? index === 0 : index === list.length - 1;
    const name = t(`shopping.category.${category}`);
    return (
      <Pressable
        testID={`settings.category.${category}.${up ? 'up' : 'down'}`}
        accessibilityRole="button"
        accessibilityLabel={t(up ? 'settings.moveUpCategory' : 'settings.moveDownCategory', {
          category: name,
        })}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => move(index, by)}
        style={({ pressed }) => ({
          width: MIN_TOUCH,
          height: MIN_TOUCH,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressedOpacity(pressed),
        })}
      >
        <Ionicons
          name={up ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={disabled ? colors.muted : colors.cobalt}
          accessible={false}
          importantForAccessibility="no"
        />
      </Pressable>
    );
  };

  return (
    <View style={{ gap: space(1) }}>
      <Text
        accessibilityRole="header"
        style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 15 }}
      >
        {t('settings.shoppingOrder')}
      </Text>
      {list.map((category, index) => (
        <View
          key={category}
          testID={`settings.category.${category}`}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ flex: 1, color: colors.ink, fontSize: 16 }}>
            {t(`shopping.category.${category}`)}
          </Text>
          {arrow(category, index, -1)}
          {arrow(category, index, 1)}
        </View>
      ))}
    </View>
  );
}
