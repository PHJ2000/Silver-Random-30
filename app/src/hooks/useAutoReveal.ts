import { useEffect } from 'react'
import { useRunStore } from '../store/run'
import { useTimerStore } from '../store/timer'

const AUTO_REVEAL_THRESHOLD_SEC = 15 * 60

export function useAutoReveal() {
  const { durationSec, autoRevealedAt, setAutoRevealedAt, setSpoilerVisibility, incrementReveals, tagsVisible } = useRunStore(
    (state) => ({
      durationSec: state.durationSec,
      autoRevealedAt: state.autoRevealedAt,
      setAutoRevealedAt: state.setAutoRevealedAt,
      setSpoilerVisibility: state.setSpoilerVisibility,
      incrementReveals: state.incrementReveals,
      tagsVisible: state.spoiler.tags,
    }),
  )
  const { remainingMs, isRunning } = useTimerStore((state) => ({
    remainingMs: state.remainingMs,
    isRunning: state.isRunning,
  }))

  useEffect(() => {
    if (!isRunning || autoRevealedAt) return
    const elapsedSec = durationSec - Math.floor(remainingMs / 1000)
    if (elapsedSec >= AUTO_REVEAL_THRESHOLD_SEC && !tagsVisible) {
      setAutoRevealedAt(Date.now())
      setSpoilerVisibility('tags', true)
      incrementReveals()
    }
  }, [
    isRunning,
    autoRevealedAt,
    remainingMs,
    durationSec,
    setAutoRevealedAt,
    setSpoilerVisibility,
    incrementReveals,
    tagsVisible,
  ])
}
