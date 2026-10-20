import { View } from 'react-native';
import { SYMBOL_PLATE } from '../nidoSymbol';
import { useTheme } from '../theme';
import { NidoSymbol } from './NidoSymbol';

/** The symbol on a slate plate, slate in both themes: the end of the day and an empty Tareas. Decorative. */
export function SymbolPlate() {
  const { colors, radii } = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: SYMBOL_PLATE.size,
        height: SYMBOL_PLATE.size,
        padding: SYMBOL_PLATE.inset,
        backgroundColor: colors.brandBand,
        borderRadius: radii.note,
      }}
    >
      <NidoSymbol size={SYMBOL_PLATE.size - 2 * SYMBOL_PLATE.inset} onSlate />
    </View>
  );
}
