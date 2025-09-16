import { useCallback, useEffect, useRef, useState } from 'react'

export interface CountdownTimerOptions {
  onComplete?: () => void
}

export interface CountdownTimer {
  secondsLeft: number
  isRunning: boolean
  start: () => void
  pause: () => void
  reset: () => void
  extend: (seconds: number) => void
  setSeconds: (seconds: number) => void
}

const TICK = 1000

export function useCountdownTimer(initialSeconds: number, options: CountdownTimerOptions = {}): CountdownTimer {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const initialRef = useRef(initialSeconds)
  const completeRef = useRef(options.onComplete)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    completeRef.current = options.onComplete
  }, [options.onComplete])

  useEffect(() => {
    initialRef.current = initialSeconds
  }, [initialSeconds])

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearInterval(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isRunning) {
      clearTimer()
      return
    }

    timeoutRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, TICK)

    return clearTimer
  }, [clearTimer, isRunning])

  useEffect(() => {
    if (secondsLeft === 0 && isRunning) {
      setIsRunning(false)
      clearTimer()
      completeRef.current?.()
    }
  }, [clearTimer, isRunning, secondsLeft])

  const start = useCallback(() => {
    setSecondsLeft((prev) => (prev === 0 ? initialRef.current : prev))
    setIsRunning(true)
  }, [])

  const pause = useCallback(() => {
    setIsRunning(false)
  }, [])

  const reset = useCallback(() => {
    setIsRunning(false)
    setSecondsLeft(initialRef.current)
  }, [])

  const extend = useCallback((seconds: number) => {
    setSecondsLeft((prev) => Math.max(0, prev + seconds))
  }, [])

  const setSeconds = useCallback((seconds: number) => {
    setSecondsLeft(Math.max(0, Math.floor(seconds)))
  }, [])

  useEffect(() => () => clearTimer(), [clearTimer])

  return { secondsLeft, isRunning, start, pause, reset, extend, setSeconds }
}
