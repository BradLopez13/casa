import { useSegments } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { isScreenReaderOn, useScreenReader } from '../a11y';
import { useTheme } from '../theme';
import { MIN_TOUCH, radii } from '../tokens';
import { useTabBarClearance } from '../useTabBarClearance';
import { NOTICE_ACTION_MS, noticeDuration } from './noticeTiming';

export type NoticeAction = { label: string; onPress: () => void; testID?: string };
type Notify = (message: string, action?: NoticeAction) => void;
/** ms null: no timer, the notice waits (a screen reader is on and there is an action to reach). */
type Shown = { message: string; action?: NoticeAction; ms: number | null; tab: string | null };

/** Long enough for the new pill to be laid out before the screen reader is sent to it. */
const FOCUS_DELAY_MS = 300;

const NoticeContext = createContext<Notify>(() => undefined);

export const useNotice = () => useContext(NoticeContext);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const segments = useSegments();
  // The tab bar exists only on the tabs; on any other screen (a sheet, sign in) only the inset.
  const onTabs = segments[0] === '(tabs)';
  const screenReader = useScreenReader();
  const [notice, setNotice] = useState<Shown | null>(null);

  // The last tab seen: a sheet over a tab keeps it, so opening or closing one changes nothing.
  const currentTab = onTabs ? segments.join('/') : null;
  const [tab, setTab] = useState(currentTab);
  if (currentTab !== null && currentTab !== tab) {
    setTab(currentTab);
    // A notice that waits for the person stays on its tab: going to another one puts it away.
    if (notice?.ms === null && notice.tab !== currentTab) setNotice(null);
  }
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  // The screen reader went off while a notice waited: from now on it times out like any other.
  if (!screenReader && notice?.ms === null) setNotice({ ...notice, ms: NOTICE_ACTION_MS });

  const notify = useCallback<Notify>((message, action) => {
    const ms = noticeDuration({ action: !!action, screenReader: isScreenReaderOn() });
    setNotice({ message, action, ms, tab: tabRef.current });
    // A waiting notice takes the screen reader's focus instead (below), which reads it.
    if (ms !== null) AccessibilityInfo.announceForAccessibility(message);
  }, []);

  const dismiss = useCallback(() => setNotice(null), []);

  // Each notice shown starts its own timer; a newer one, or putting it away, cancels it.
  useEffect(() => {
    if (notice?.ms == null) return;
    const timer = setTimeout(() => setNotice(null), notice.ms);
    return () => clearTimeout(timer);
  }, [notice]);

  // The row that was just completed leaves the list and takes the focus with it: a waiting
  // notice catches it, so «Deshacer» is the next swipe and not a hunt to the bottom.
  const messageRef = useRef<Text>(null);
  useEffect(() => {
    if (notice?.ms !== null || !notice) return;
    const id = setTimeout(() => {
      const tag = findNodeHandle(messageRef.current);
      if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(id);
  }, [notice]);

  const action = notice?.action;
  const actionText = {
    color: colors.page,
    fontSize: 15,
    textDecorationLine: 'underline',
  } as const;

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
            <Text ref={messageRef} style={{ color: colors.page, fontSize: 15, fontWeight: '600' }}>
              {notice.message}
            </Text>
            {action ? (
              <Pressable
                testID={action.testID}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                hitSlop={space(1)}
                onPress={() => {
                  dismiss();
                  action.onPress();
                }}
                style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}
              >
                {/* The pill is `ink`, where `cobalt` text would vanish in light: page tone on it. */}
                <Text style={{ ...actionText, fontWeight: '700' }}>{action.label}</Text>
              </Pressable>
            ) : null}
            {notice.ms === null ? (
              // Without a timer the notice needs a way out that is not its action.
              <Pressable
                testID="notice.close"
                accessibilityRole="button"
                accessibilityLabel={t('notice.close')}
                hitSlop={space(1)}
                onPress={dismiss}
                style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}
              >
                <Text style={{ ...actionText, fontWeight: '600' }}>{t('notice.close')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </NoticeContext.Provider>
  );
}
