import { ChangeEvent, useMemo, useRef } from 'react'
import { useSettingsStore, exportSettings, importSettings } from '../store/settings'
import { useSettingsFileSync } from '../hooks/useSettingsFileSync'

const supportsFileSystemAccess = typeof window !== 'undefined' && 'showOpenFilePicker' in window

interface PickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}

interface MinimalOpenFilePickerOptions {
  multiple?: boolean
  types?: PickerAcceptType[]
}

interface MinimalSaveFilePickerOptions {
  suggestedName?: string
  types?: PickerAcceptType[]
}

async function readFile(file: File) {
  const text = await file.text()
  await importSettings(text)
}

export function SettingsPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { settings, setSettings, setFileHandle } = useSettingsStore((state) => ({
    settings: state.settings,
    setSettings: state.setSettings,
    setFileHandle: state.setFileHandle,
  }))

  useSettingsFileSync()

  const tagsInput = useMemo(() => settings.queryBoostTags.join(', '), [settings.queryBoostTags])

  const handleTagChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value
    const tags = raw
      .split(/[,\s]+/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
    setSettings({ queryBoostTags: tags })
  }

  const handleExport = () => {
    const blob = new Blob([exportSettings()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'solandi-settings.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await readFile(file)
    event.target.value = ''
  }

  const handleConnectFile = async () => {
    type OpenPicker = (options?: MinimalOpenFilePickerOptions) => Promise<globalThis.FileSystemFileHandle[]>
    const openPicker = (window as typeof window & { showOpenFilePicker?: OpenPicker }).showOpenFilePicker
    if (!supportsFileSystemAccess || typeof openPicker !== 'function') return
    try {
      const [handle] = await openPicker.call(window, {
        multiple: false,
        types: [
          {
            description: 'JSON 설정 파일',
            accept: { 'application/json': ['.json'] },
          },
        ],
      })
      if (handle) {
        const file = await handle.getFile()
        await readFile(file)
        setFileHandle(handle)
      }
    } catch (error) {
      console.warn('파일 연결 실패', error)
    }
  }

  const handleCreateFile = async () => {
    type SavePicker = (options?: MinimalSaveFilePickerOptions) => Promise<globalThis.FileSystemFileHandle>
    const savePicker = (window as typeof window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker
    if (!supportsFileSystemAccess || typeof savePicker !== 'function') return
    try {
      const handle = await savePicker.call(window, {
        suggestedName: 'solandi.config.json',
        types: [
          {
            description: 'JSON 설정 파일',
            accept: { 'application/json': ['.json'] },
          },
        ],
      })
      setFileHandle(handle)
    } catch (error) {
      console.warn('파일 생성 실패', error)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">설정</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            내보내기
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            가져오기
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">백준 핸들</span>
          <input
            type="text"
            value={settings.bojHandle}
            onChange={(event) => setSettings({ bojHandle: event.target.value })}
            placeholder="예: baekjoon_id"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">언어 제한</span>
          <select
            value={settings.language}
            onChange={(event) => setSettings({ language: event.target.value as typeof settings.language })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="any">전체 언어</option>
            <option value="ko">한국어 문제만</option>
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">푼/시도 문제 제외</span>
          <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-300">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                checked={settings.excludeSolved}
                onChange={(event) => setSettings({ excludeSolved: event.target.checked })}
                disabled={!settings.bojHandle.trim()}
              />
              <span>푼 문제 제외</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                checked={settings.excludeTried}
                onChange={(event) => setSettings({ excludeTried: event.target.checked })}
                disabled={!settings.bojHandle.trim()}
              />
              <span>시도 문제 제외</span>
            </label>
          </div>
          {!settings.bojHandle.trim() && (
            <p className="text-xs text-slate-500 dark:text-slate-400">핸들을 입력해야 해당 옵션을 사용할 수 있어요.</p>
          )}
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">기본 타이머 (분)</span>
          <input
            type="number"
            min={5}
            max={180}
            value={settings.defaultDurationMin}
            onChange={(event) => setSettings({ defaultDurationMin: Number.parseInt(event.target.value, 10) || 30 })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">연장 단위 (분)</span>
          <input
            type="number"
            min={1}
            max={30}
            value={settings.extendStepMin}
            onChange={(event) => setSettings({ extendStepMin: Number.parseInt(event.target.value, 10) || 5 })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">선호 태그</span>
          <input
            type="text"
            value={tagsInput}
            onChange={handleTagChange}
            placeholder="예: greedy, dp"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">스포일러 숨김</span>
          <div className="flex flex-wrap gap-3 text-sm text-slate-700 dark:text-slate-300">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.hideMeta.tier}
                onChange={(event) => setSettings({ hideMeta: { ...settings.hideMeta, tier: event.target.checked } })}
              />
              <span>티어</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.hideMeta.tags}
                onChange={(event) => setSettings({ hideMeta: { ...settings.hideMeta, tags: event.target.checked } })}
              />
              <span>태그</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.hideMeta.algorithms}
                onChange={(event) =>
                  setSettings({ hideMeta: { ...settings.hideMeta, algorithms: event.target.checked } })
                }
              />
              <span>알고리즘 분류</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">테마</span>
          <select
            value={settings.theme}
            onChange={(event) => setSettings({ theme: event.target.value as typeof settings.theme })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="system">시스템 기본</option>
            <option value="light">라이트</option>
            <option value="dark">다크</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">사운드</span>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={settings.sound.enabled}
              onChange={(event) => setSettings({ sound: { ...settings.sound, enabled: event.target.checked } })}
            />
            <span>알람 사운드 사용</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={settings.sound.volume}
            onChange={(event) => setSettings({ sound: { ...settings.sound, volume: Number.parseFloat(event.target.value) } })}
          />
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Discord 웹훅 URL (개인)</span>
          <input
            type="url"
            value={settings.webhookOverride ?? ''}
            onChange={(event) => setSettings({ webhookOverride: event.target.value })}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">API 키</span>
          <input
            type="password"
            value={settings.apiKey ?? ''}
            onChange={(event) => setSettings({ apiKey: event.target.value })}
            placeholder="서버 API 키"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
      </div>

      {supportsFileSystemAccess && (
        <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={handleConnectFile}
            className="rounded-lg border border-slate-300 px-3 py-2 font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            설정 파일 연결
          </button>
          <button
            type="button"
            onClick={handleCreateFile}
            className="rounded-lg border border-slate-300 px-3 py-2 font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            새 설정 파일 만들기
          </button>
        </div>
      )}
    </div>
  )
}
