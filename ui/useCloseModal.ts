import { useNavigation, useRouter, type Href } from 'expo-router';

/**
 * Closes the current modal. A save that settles after the modal already left (back gesture,
 * Guard redirect) does nothing, and a modal opened with nothing behind it (deep link, reload)
 * goes to `fallback` instead of dispatching a GO_BACK no navigator handles. Returns whether it
 * navigated.
 */
export function useCloseModal(fallback: Href) {
  const router = useRouter();
  const navigation = useNavigation();
  return (): boolean => {
    if (!navigation.isFocused()) return false;
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
    return true;
  };
}
