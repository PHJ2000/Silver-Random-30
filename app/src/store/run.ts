import { create } from 'zustand'
import type { RunResult } from 'shared/types'
import type { Problem } from 'shared/types'

interface SpoilerState {
  tier: boolean
  tags: boolean
  algorithms: boolean
}

interface RunState {
  problem: (Problem & { tier?: string; tags?: string[] }) | null
  runId: string | null
  startedAt: number | null
  durationSec: number
  revealsUsed: number
  spoiler: SpoilerState
  autoRevealedAt: number | null
  warningSent: boolean
  timeoutSent: boolean
  result: RunResult | null
  notes: string
  setProblem: (problem: Problem & { tier?: string; tags?: string[] }, durationSec: number) => void
  setRunId: (id: string | null) => void
  setStartedAt: (timestamp: number | null) => void
  incrementReveals: () => void
  setSpoilerVisibility: (key: keyof SpoilerState, visible: boolean) => void
  setAutoRevealedAt: (timestamp: number | null) => void
  setWarningSent: (value: boolean) => void
  setTimeoutSent: (value: boolean) => void
  setResult: (result: RunResult | null) => void
  setNotes: (notes: string) => void
  setDurationSec: (value: number) => void
  reset: () => void
}

const defaultSpoiler: SpoilerState = {
  tier: false,
  tags: false,
  algorithms: false,
}

export const useRunStore = create<RunState>((set) => ({
  problem: null,
  runId: null,
  startedAt: null,
  durationSec: 1800,
  revealsUsed: 0,
  spoiler: { ...defaultSpoiler },
  autoRevealedAt: null,
  warningSent: false,
  timeoutSent: false,
  result: null,
  notes: '',
  setProblem: (problem, durationSec) =>
    set({
      problem,
      durationSec,
      revealsUsed: 0,
      spoiler: { ...defaultSpoiler },
      autoRevealedAt: null,
      warningSent: false,
      timeoutSent: false,
      result: null,
      notes: '',
    }),
  setRunId: (id) => set({ runId: id }),
  setStartedAt: (timestamp) => set({ startedAt: timestamp }),
  incrementReveals: () => set((state) => ({ revealsUsed: state.revealsUsed + 1 })),
  setSpoilerVisibility: (key, visible) =>
    set((state) => ({ spoiler: { ...state.spoiler, [key]: visible } as SpoilerState })),
  setAutoRevealedAt: (timestamp) => set({ autoRevealedAt: timestamp }),
  setWarningSent: (value) => set({ warningSent: value }),
  setTimeoutSent: (value) => set({ timeoutSent: value }),
  setResult: (result) => set({ result }),
  setNotes: (notes) => set({ notes }),
  setDurationSec: (value) => set({ durationSec: value }),
  reset: () =>
    set({
      problem: null,
      runId: null,
      startedAt: null,
      durationSec: 1800,
      revealsUsed: 0,
      spoiler: { ...defaultSpoiler },
      autoRevealedAt: null,
      warningSent: false,
      timeoutSent: false,
      result: null,
      notes: '',
    }),
}))
