import { useEffect, useMemo } from 'react'
import { useTimerStore } from '../store/timer'

export function useCountdown() {
  const {
    durationMs,
    remainingMs,
    isRunning,
    startAt,
    endAt,
    start,
    pause,
    resume,
    extend,
    reset,
    sync,
  } = useTimerStore((state) => ({
    durationMs: state.durationMs,
    remainingMs: state.remainingMs,
    isRunning: state.isRunning,
    startAt: state.startAt,
    endAt: state.endAt,
    start: state.start,
    pause: state.pause,
    resume: state.resume,
    extend: state.extend,
    reset: state.reset,
    sync: state.sync,
  }))

  useEffect(() => {
    let rafId: number | null = null
    const tick = () => {
      sync()
      if (isRunning) {
        rafId = requestAnimationFrame(tick)
      }
    }
    if (isRunning) {
      rafId = requestAnimationFrame(tick)
    }
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [isRunning, sync])

  const seconds = useMemo(() => Math.ceil(remainingMs / 1000), [remainingMs])

  return {
    durationMs,
    remainingMs,
    startAt,
    endAt,
    seconds,
    isRunning,
    start,
    pause,
    resume,
    extend,
    reset,
  }
}
