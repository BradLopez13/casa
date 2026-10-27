import type { useRouter } from 'expo-router';

/**
 * Into the household just created or joined: whatever led there («Otra casa», the invitation) is
 * closed first, so going back from the new household never returns to it (bloque 12).
 */
export function leaveToHome(
  router: ReturnType<typeof useRouter>,
  href: '/' | '/today' = '/',
): void {
  if (router.canDismiss?.()) router.dismissAll();
  router.replace(href);
}
