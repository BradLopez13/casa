package expo.modules.backgroundwait

import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.delay

/**
 * A wait that runs with the app behind (bloque 15.1). React Native stops every JS timer while the
 * app is not in front (JavaTimerManager.onHostPause), and the offline queue waits between two
 * tries on one; the network's events and the answers still reach JS, so a wait that does not
 * depend on the frame callback keeps the queue going behind (data/query/retry.ts).
 */
class BackgroundWaitModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BackgroundWait")

    AsyncFunction("wait") Coroutine { ms: Long ->
      delay(ms)
    }
  }
}
