import { useSegments } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { MIN_TOUCH, radii } from '../tokens';
import { useTabBarClearance } from '../useTabBarClearance';
import { noticeDuration } from './noticeTiming';

export type NoticeAction = { label: string; onPress: () => void; testID?: string };
type Notify = (message: string, action?: NoticeAction) => void;

const NoticeContext = createContext<Notify>(() => undefined);

export const useNotice = () => useContext(NoticeContext);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  // The tab bar exists only on the tabs; on any other screen (a sheet, sign in) only the inset.
  const onTabs = useSegments()[0] === '(tabs)';
  const [notice, setNotice] = useState<{ message: string; action?: NoticeAction } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const notify = useCallback<Notify>((message, action) => {
    clearTimeout(timer.current);
    setNotice({ message, action });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setNotice(null), noticeDuration({ action: !!action }));
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const action = notice?.action;

  return (
    <NoticeContext.Provider value={notify}>
      {children}
      {notice === null ? null : (
        <View
          // The pill is tappable only for its action; everything around it lets touches through.
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            // Clear of a side notch on a phone on its side.
            left: space(4) + insets.left,
            right: space(4) + insets.right,
            bottom: (onTabs ? tabClearance : insets.bottom) + space(3),
            alignItems: 'center',
          }}
        >
          <View
            testID="notice"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
              columnGap: space(4),
              backgroundColor: colors.ink,
              borderRadius: radii.pill,
              paddingHorizontal: space(5),
              paddingVertical: action ? space(1) : space(3),
            }}
          >
            <Text style={{ color: colors.page, fontSize: 15, fontWeight: '600' }}>
              {notice.message}
            </Text>
            {action ? (
              <Pressable
                testID={action.testID}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                hitSlop={space(1)}
                onPress={() => {
                  clearTimeout(timer.current);
                  setNotice(null);
                  action.onPress();
                }}
                style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}
              >
                {/* The pill is `ink`, where `cobalt` text would vanish in light: page tone on it. */}
                <Text
                  style={{
                    color: colors.page,
                    fontSize: 15,
                    fontWeight: '700',
                    textDecorationLine: 'underline',
                  }}
                >
                  {action.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </NoticeContext.Provider>
  );
}
