import { useEffect } from 'react'
import { useRunStore } from '../store/run'
import { useTimerStore } from '../store/timer'
import { useSettingsStore } from '../store/settings'
import { postRunEvent } from '../utils/api'

export function useRunEvents() {
  const { runId, warningSent, timeoutSent, setWarningSent, setTimeoutSent } = useRunStore((state) => ({
    runId: state.runId,
    warningSent: state.warningSent,
    timeoutSent: state.timeoutSent,
    setWarningSent: state.setWarningSent,
    setTimeoutSent: state.setTimeoutSent,
  }))
  const { remainingMs, isRunning } = useTimerStore((state) => ({
    remainingMs: state.remainingMs,
    isRunning: state.isRunning,
  }))
  const apiKey = useSettingsStore((state) => state.settings.apiKey)
  const webhookUrl = useSettingsStore((state) => state.settings.webhookOverride)

  useEffect(() => {
    if (!runId || warningSent) return
    if (!isRunning) return
    const seconds = Math.ceil(remainingMs / 1000)
    if (seconds <= 300 && seconds > 0) {
      setWarningSent(true)
      void postRunEvent({ id: runId, type: 'warning', apiKey, webhookUrl })
    }
  }, [runId, remainingMs, isRunning, warningSent, apiKey, webhookUrl, setWarningSent])

  useEffect(() => {
    if (!runId || timeoutSent) return
    if (remainingMs > 0) return
    setTimeoutSent(true)
    void postRunEvent({ id: runId, type: 'timeout', apiKey, webhookUrl })
  }, [runId, remainingMs, timeoutSent, apiKey, webhookUrl, setTimeoutSent])
}
