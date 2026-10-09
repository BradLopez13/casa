import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { radii } from '../tokens';

const NOTICE_MS = 4000;
// Room for the tab bar so the pill sits above it.
const TAB_BAR_CLEARANCE = 64;

const NoticeContext = createContext<(message: string) => void>(() => undefined);

export const useNotice = () => useContext(NoticeContext);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const notify = useCallback((next: string) => {
    clearTimeout(timer.current);
    setMessage(next);
    AccessibilityInfo.announceForAccessibility(next);
    timer.current = setTimeout(() => setMessage(null), NOTICE_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <NoticeContext.Provider value={notify}>
      {children}
      {message === null ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: insets.bottom + TAB_BAR_CLEARANCE,
            alignItems: 'center',
          }}
        >
          <View
            testID="notice"
            style={{
              backgroundColor: colors.ink,
              borderRadius: radii.pill,
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: colors.page, fontSize: 15, fontWeight: '600' }}>{message}</Text>
          </View>
        </View>
      )}
    </NoticeContext.Provider>
  );
}
