import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const DEFAULT_DURATION_MS = 30 * 60 * 1000

interface TimerState {
  durationMs: number
  remainingMs: number
  startAt: number | null
  endAt: number | null
  isRunning: boolean
  lastTick: number | null
  start: (durationMs: number) => void
  pause: () => void
  resume: () => void
  extend: (deltaMs: number) => void
  reset: (durationMs?: number) => void
  sync: () => void
}

function clampMs(value: number) {
  return Math.max(0, Math.round(value))
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      durationMs: DEFAULT_DURATION_MS,
      remainingMs: DEFAULT_DURATION_MS,
      startAt: null,
      endAt: null,
      isRunning: false,
      lastTick: null,
      start: (durationMs: number) => {
        const now = Date.now()
        set({
          durationMs: clampMs(durationMs),
          remainingMs: clampMs(durationMs),
          startAt: now,
          endAt: now + clampMs(durationMs),
          isRunning: true,
          lastTick: now,
        })
      },
      pause: () => {
        const state = get()
        if (!state.isRunning) return
        const now = Date.now()
        const remaining = clampMs((state.endAt ?? now) - now)
        set({
          isRunning: false,
          remainingMs: remaining,
          endAt: null,
          lastTick: now,
        })
      },
      resume: () => {
        const state = get()
        if (state.isRunning) return
        const now = Date.now()
        const remaining = clampMs(state.remainingMs)
        set({
          isRunning: true,
          endAt: now + remaining,
          startAt: state.startAt ?? now,
          lastTick: now,
        })
      },
      extend: (deltaMs: number) => {
        if (!Number.isFinite(deltaMs)) return
        const state = get()
        const delta = clampMs(deltaMs)
        if (state.isRunning && state.endAt) {
          set({
            durationMs: state.durationMs + delta,
            remainingMs: clampMs((state.endAt + delta) - Date.now()),
            endAt: state.endAt + delta,
          })
        } else {
          set({
            durationMs: state.durationMs + delta,
            remainingMs: clampMs(state.remainingMs + delta),
          })
        }
      },
      reset: (durationMs?: number) => {
        const base = clampMs(durationMs ?? DEFAULT_DURATION_MS)
        set({
          durationMs: base,
          remainingMs: base,
          startAt: null,
          endAt: null,
          isRunning: false,
          lastTick: null,
        })
      },
      sync: () => {
        const state = get()
        if (!state.isRunning || !state.endAt) {
          return
        }
        const remaining = clampMs(state.endAt - Date.now())
        if (remaining <= 0) {
          set({
            isRunning: false,
            remainingMs: 0,
            endAt: null,
            lastTick: Date.now(),
          })
        } else {
          set({
            remainingMs: remaining,
            lastTick: Date.now(),
          })
        }
      },
    }),
    {
      name: 'solandi:timer',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (state.isRunning && state.endAt) {
          const remaining = state.endAt - Date.now()
          if (remaining <= 0) {
            state.isRunning = false
            state.remainingMs = 0
            state.endAt = null
          } else {
            state.remainingMs = clampMs(remaining)
          }
        }
      },
    },
  ),
)
