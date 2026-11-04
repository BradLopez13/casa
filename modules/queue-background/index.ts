import { requireOptionalNativeModule } from 'expo';

type QueueBackgroundModule = {
  wait(ms: number): Promise<void>;
  holdNetwork(): void;
  releaseNetwork(): void;
};

const native = requireOptionalNativeModule<QueueBackgroundModule>('QueueBackground');

/**
 * A wait that runs with the app behind, on Android (bloque 15.1): React Native fires no JS timer
 * while the app is not in front, and the offline queue waits between two tries on this one
 * (`setQueueWaiter`, `data/query/setup.ts`). Null where the module is not built in (iOS, the web,
 * Expo Go, Node): the queue waits on a JS timer there, as before.
 */
export const backgroundWait: ((ms: number) => Promise<void>) | null =
  native === null ? null : (ms) => native.wait(ms);

/**
 * The network for the queue with the app behind, on Android (`watchNetworkPass`): a job that
 * needs the network, which Android lets the app use while it runs. Null without the module.
 */
export const networkPass: { hold: () => void; release: () => void } | null =
  native === null
    ? null
    : { hold: () => native.holdNetwork(), release: () => native.releaseNetwork() };
