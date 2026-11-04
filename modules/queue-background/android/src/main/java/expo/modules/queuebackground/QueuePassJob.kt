package expo.modules.queuebackground

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.Build

/**
 * A job that needs the network and does nothing but run while the queue has changes waiting with
 * the app behind: while it runs, Android lets the app use the network again, and the queue (still
 * alive in the same process) gets through. Expedited where it can be (Android 12+, no
 * notification), so it starts as soon as there is a connection; a plain job otherwise. Stopped by
 * the system (its time is up), a fresh one is scheduled while changes still wait, never with the
 * system's growing backoff, and at most MAX_RENEWALS times in a row: a change that keeps failing
 * for hours behind does not keep the phone awake (revisión 15.1).
 */
class QueuePassJob : JobService() {
  override fun onStartJob(params: JobParameters): Boolean {
    synchronized(lock) {
      if (!held) return false
      running = this to params
    }
    return true
  }

  override fun onStopJob(params: JobParameters): Boolean {
    val renew =
      synchronized(lock) {
        running = null
        if (held && renewals < MAX_RENEWALS) {
          renewals += 1
          true
        } else {
          false
        }
      }
    if (renew) schedule(applicationContext)
    return false
  }

  companion object {
    private const val JOB_ID = 0x4e1d0
    private const val MAX_RENEWALS = 6
    private val lock = Any()
    private var held = false
    private var renewals = 0
    private var running: Pair<JobService, JobParameters>? = null

    fun hold(context: Context) {
      synchronized(lock) {
        if (held) return
        held = true
        renewals = 0
      }
      schedule(context)
    }

    fun release(context: Context) {
      val job =
        synchronized(lock) {
          if (!held) return
          held = false
          running.also { running = null }
        }
      job?.let { (service, params) -> service.jobFinished(params, false) }
      context.getSystemService(JobScheduler::class.java)?.cancel(JOB_ID)
    }

    private fun schedule(context: Context) {
      val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
      val component = ComponentName(context, QueuePassJob::class.java)
      fun job() = JobInfo.Builder(JOB_ID, component).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
      val expedited =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
          try {
            scheduler.schedule(job().setExpedited(true).build()) == JobScheduler.RESULT_SUCCESS
          } catch (_: Exception) {
            false
          }
      if (!expedited) {
        try {
          scheduler.schedule(job().build())
        } catch (_: Exception) {
          // Without the job the queue still goes as soon as the app is opened.
        }
      }
    }
  }
}
