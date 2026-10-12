import { useWindowDimensions } from 'react-native';

import { layoutFor, type Layout } from './layout';

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return layoutFor(width, height);
}
