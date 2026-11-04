package expo.modules.queuebackground

import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.delay

/**
 * What the offline queue needs from Android to keep going with the app behind (bloque 15.1,
 * prueba en el .51 del 4 de noviembre):
 *
 * - wait: React Native stops every JS timer while the app is not in front
 *   (JavaTimerManager.onHostPause), and the queue waits between two tries on one.
 * - holdNetwork / releaseNetwork: some 5 s after the app goes behind, Android takes its network
 *   away (blocked=APP_BACKGROUND, the background firewall chain). A job that needs the network
 *   gives it back while it runs (QueuePassJob).
 */
class QueueBackgroundModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QueueBackground")

    AsyncFunction("wait") Coroutine { ms: Long ->
      delay(ms)
    }

    Function("holdNetwork") {
      appContext.reactContext?.applicationContext?.let { QueuePassJob.hold(it) }
    }

    Function("releaseNetwork") {
      appContext.reactContext?.applicationContext?.let { QueuePassJob.release(it) }
    }
  }
}
