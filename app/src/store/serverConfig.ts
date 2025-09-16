import { create } from 'zustand'
import type { ServerConfig } from 'shared/types'

interface ServerConfigState {
  config: ServerConfig | null
  loading: boolean
  error: string | null
  fetchConfig: () => Promise<ServerConfig>
}

export const useServerConfigStore = create<ServerConfigState>((set, get) => ({
  config: null,
  loading: false,
  error: null,
  fetchConfig: async () => {
    const existing = get().config
    if (existing) {
      return existing
    }
    if (get().loading) {
      return new Promise((resolve, reject) => {
        const unsubscribe = useServerConfigStore.subscribe((state) => {
          if (!state.loading) {
            unsubscribe()
            if (state.config) {
              resolve(state.config)
            } else {
              reject(new Error(state.error ?? '서버 설정을 불러올 수 없습니다.'))
            }
          }
        })
      })
    }
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/config')
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(`서버 설정을 불러오지 못했습니다: ${response.status} ${detail}`)
      }
      const data = (await response.json()) as ServerConfig
      set({ config: data, loading: false })
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : '서버 설정을 불러오는 중 오류가 발생했습니다.'
      set({ error: message, loading: false })
      throw new Error(message)
    }
  },
}))
