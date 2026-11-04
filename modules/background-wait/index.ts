import { requireOptionalNativeModule } from 'expo-modules-core';

type BackgroundWaitModule = { wait(ms: number): Promise<void> };

const native = requireOptionalNativeModule<BackgroundWaitModule>('BackgroundWait');

/**
 * A wait that runs with the app behind, on Android (bloque 15.1): React Native fires no JS timer
 * while the app is not in front, and the offline queue waits between two tries on this one
 * (`setQueueWaiter`, `data/query/setup.ts`). Null where the module is not built in (iOS, the web,
 * Expo Go, Node): the queue waits on a JS timer there, as before.
 */
export const backgroundWait: ((ms: number) => Promise<void>) | null =
  native === null ? null : (ms) => native.wait(ms);
