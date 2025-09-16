import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type LanguageOption = 'any' | 'ko'
type ThemeOption = 'system' | 'light' | 'dark'

export interface HideMetaSettings {
  tags: boolean
  algorithms: boolean
  tier: boolean
}

export interface SoundSettings {
  enabled: boolean
  volume: number
}

export interface AppSettings {
  bojHandle: string
  excludeSolved: boolean
  excludeTried: boolean
  language: LanguageOption
  defaultDurationMin: number
  extendStepMin: number
  hideMeta: HideMetaSettings
  queryBoostTags: string[]
  theme: ThemeOption
  sound: SoundSettings
  historyLimit: number
  recentProblemIds: number[]
  webhookOverride?: string
  autoStartOnOpen: boolean
  apiKey?: string
}

interface SettingsState {
  settings: AppSettings
  fileHandle: globalThis.FileSystemFileHandle | null
  setSettings: (settings: Partial<AppSettings>) => void
  setAllSettings: (settings: AppSettings) => void
  addRecentProblem: (problemId: number) => void
  resetRecentProblems: () => void
  setFileHandle: (handle: globalThis.FileSystemFileHandle | null) => void
}

export const DEFAULT_SETTINGS: AppSettings = {
  bojHandle: '',
  excludeSolved: true,
  excludeTried: true,
  language: 'any',
  defaultDurationMin: 30,
  extendStepMin: 5,
  hideMeta: {
    tags: true,
    algorithms: true,
    tier: false,
  },
  queryBoostTags: [],
  theme: 'system',
  sound: {
    enabled: true,
    volume: 0.7,
  },
  historyLimit: 100,
  recentProblemIds: [],
  webhookOverride: undefined,
  autoStartOnOpen: true,
  apiKey: undefined,
}

function clampVolume(volume: number) {
  return Math.min(1, Math.max(0, volume))
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      fileHandle: null,
      setSettings: (partial) => {
        const next = { ...get().settings, ...partial }
        if ('sound' in partial && partial.sound) {
          next.sound = {
            enabled: partial.sound.enabled ?? next.sound.enabled,
            volume: clampVolume(partial.sound.volume ?? next.sound.volume),
          }
        }
        if ('queryBoostTags' in partial && partial.queryBoostTags) {
          next.queryBoostTags = Array.from(new Set(partial.queryBoostTags.map((tag) => tag.trim()).filter(Boolean)))
        }
        set({ settings: next })
      },
      setAllSettings: (settings) => {
        set({ settings: { ...DEFAULT_SETTINGS, ...settings } })
      },
      addRecentProblem: (problemId) => {
        const current = get().settings.recentProblemIds
        const filtered = [problemId, ...current.filter((id) => id !== problemId)].slice(0, get().settings.historyLimit)
        set({ settings: { ...get().settings, recentProblemIds: filtered } })
      },
      resetRecentProblems: () => {
        set({ settings: { ...get().settings, recentProblemIds: [] } })
      },
      setFileHandle: (handle) => {
        set({ fileHandle: handle })
      },
    }),
    {
      name: 'solandi:settings',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ settings: state.settings }),
      merge: (persisted: unknown, current: SettingsState) => {
        const data = persisted as { settings?: Partial<AppSettings> }
        const mergedSettings = { ...DEFAULT_SETTINGS, ...data?.settings }
        return { ...current, settings: mergedSettings }
      },
    },
  ),
)

export function exportSettings(): string {
  const state = useSettingsStore.getState().settings
  return JSON.stringify(state, null, 2)
}

export async function importSettings(json: string) {
  const parsed = JSON.parse(json)
  useSettingsStore.getState().setAllSettings({ ...DEFAULT_SETTINGS, ...parsed })
}
