import { useEffect } from 'react'
import { useTimerStore } from '../store/timer'

function format(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.max(0, seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function useTimerDocumentTitle(baseTitle = '실랜디 30') {
  const { remainingMs, isRunning } = useTimerStore((state) => ({
    remainingMs: state.remainingMs,
    isRunning: state.isRunning,
  }))

  useEffect(() => {
    const seconds = Math.ceil(remainingMs / 1000)
    document.title = isRunning ? `⏱️ ${format(seconds)} · ${baseTitle}` : baseTitle
  }, [remainingMs, isRunning, baseTitle])
}
