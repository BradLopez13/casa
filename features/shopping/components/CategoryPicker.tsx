import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { CATEGORIES, type Category } from '@/domain/shopping/categories';
import { t } from '@/i18n';
import { pressedOpacity } from '@/ui/buttonLook';
import { Button } from '@/ui/components/Button';
import { useTheme } from '@/ui/theme';
import { displayFontBold, MIN_TOUCH } from '@/ui/tokens';

type Props = {
  /** The item being moved; null hides the picker. */
  target: { name: string; category: Category } | null;
  onPick: (category: Category) => void;
  onCancel: () => void;
};

/**
 * «Cambiar categoría»: the ten categories as pills on a small card, the current one outlined.
 * A custom Modal, like ConfirmDialog, so Maestro taps the same testIDs on iOS and Android.
 */
export function CategoryPicker({ target, onPick, onCancel }: Props) {
  const { colors, radii, space } = useTheme();
  // Keep the last item while the Modal fades out, so the card does not blank.
  const [shown, setShown] = useState(target);
  if (target !== null && target !== shown) setShown(target);

  return (
    <Modal visible={target !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: space(6),
          backgroundColor: colors.scrim,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 440,
            alignSelf: 'center',
            gap: space(3),
            padding: space(6),
            borderRadius: radii.note,
            backgroundColor: colors.note,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 20 }}
          >
            {t('shopping.changeCategory')}
          </Text>
          {shown ? (
            <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 15 }}>
              {shown.name}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {CATEGORIES.map((category) => {
              const selected = shown?.category === category;
              return (
                <Pressable
                  key={category}
                  testID={`shopping.category.${category}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onPick(category)}
                  style={({ pressed }) => ({
                    minHeight: MIN_TOUCH,
                    justifyContent: 'center',
                    paddingHorizontal: space(4),
                    borderRadius: radii.pill,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.cobalt : colors.hairline,
                    opacity: pressedOpacity(pressed),
                  })}
                >
                  <Text style={{ color: colors.ink, fontSize: 15 }}>
                    {t(`shopping.category.${category}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ marginTop: space(2) }}>
            <Button
              testID="shopping.category.cancel"
              title={t('shopping.edit.cancel')}
              variant="secondary"
              width="full"
              onPress={onCancel}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
