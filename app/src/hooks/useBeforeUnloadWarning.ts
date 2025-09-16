import { useEffect } from 'react'
import { useTimerStore } from '../store/timer'

export function useBeforeUnloadWarning() {
  const isRunning = useTimerStore((state) => state.isRunning)

  useEffect(() => {
    if (!isRunning) {
      return
    }

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [isRunning])
}
