import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

function isUpdater<T>(value: unknown): value is (prev: T) => T {
  return typeof value === 'function'
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn('Failed to parse localStorage item', error)
    return fallback
  }
}

export function usePersistentState<T>(
  key: string,
  defaultValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const isFirstRender = useRef(true)
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultValue
    }

    return safeParse<T>(window.localStorage.getItem(key), defaultValue)
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.warn('Failed to persist state to localStorage', error)
    }
  }, [key, state])

  const set: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      setState((prev) => {
        if (isUpdater<T>(value)) {
          return value(prev)
        }
        return value as T
      })
    },
    [],
  )

  return [state, set]
}
