import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePersistentState } from './hooks/usePersistentState'
import { useCountdownTimer } from './hooks/useCountdownTimer'
import {
  normalizeQuerySettings,
  parseTagsInput,
  type QuerySettings,
  type TagMode,
  buildSearchQuery,
} from './utils/query'
import {
  fetchRandomProblemWithRelaxations,
  type FetchWithRelaxationsResult,
} from './utils/fetchRandomProblem'
import type { ProblemSummary } from './utils/problem'

const SETTINGS_STORAGE_KEY = 'silver30:settings'
const RECENT_STORAGE_KEY = 'silver30:recentProblems'
const INITIAL_TIMER_SECONDS = 30 * 60
const TIMER_EXTEND_SECONDS = 5 * 60
const MAX_RECENT_IDS = 20

const numberFormatter = new Intl.NumberFormat('ko-KR')

type ThemeSetting = 'system' | 'light' | 'dark'

type LanguageSetting = 'any' | 'ko'

interface AppSettings {
  handle: string
  excludeSolved: boolean
  excludeTried: boolean
  language: LanguageSetting
  includeTagsInput: string
  includeTagMode: TagMode
  excludeTagsInput: string
  useProxy: boolean
  theme: ThemeSetting
}

type ProxyResponse = FetchWithRelaxationsResult

const DEFAULT_SETTINGS: AppSettings = {
  handle: '',
  excludeSolved: true,
  excludeTried: true,
  language: 'any',
  includeTagsInput: '',
  includeTagMode: 'any',
  excludeTagsInput: '',
  useProxy: false,
  theme: 'system',
}

const BASE_TITLE = '실랜디 30'

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function classNames(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

function useTheme(theme: ThemeSetting) {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const root = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const shouldUseDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches)
      root.classList.toggle('dark', shouldUseDark)
    }

    applyTheme()

    if (theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme)
      return () => mediaQuery.removeEventListener('change', applyTheme)
    }

    return () => {
      root.classList.toggle('dark', theme === 'dark')
    }
  }, [theme])
}

function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return
  }

  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => undefined)
  }
}

function sendTimerNotification() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return
  }

  if (Notification.permission === 'granted') {
    try {
      new Notification('실랜디 30', {
        body: '30분 타이머가 종료되었습니다. 수고하셨습니다!',
        icon: '/vite.svg',
      })
    } catch (error) {
      console.warn('Failed to show notification', error)
    }
  }
}

const audioContextRef: { current: AudioContext | null } = { current: null }

function playAlarmTone() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    const context = audioContextRef.current
    if (context.state === 'suspended') {
      context.resume().catch(() => undefined)
    }

    const oscillator = context.createOscillator()
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(880, context.currentTime)

    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.2)

    oscillator.connect(gain)
    gain.connect(context.destination)

    oscillator.start()
    oscillator.stop(context.currentTime + 1.3)
  } catch (error) {
    console.warn('Failed to play alarm tone', error)
  }
}

function useDocumentTitle(seconds: number, isRunning: boolean) {
  useEffect(() => {
    const formatted = formatSeconds(seconds)
    document.title = isRunning ? `⏱️ ${formatted} · ${BASE_TITLE}` : BASE_TITLE
  }, [isRunning, seconds])
}

export default function App() {
  const [settings, setSettings] = usePersistentState<AppSettings>(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS)
  const [recentProblems, setRecentProblems] = usePersistentState<number[]>(RECENT_STORAGE_KEY, [])
  const [problem, setProblem] = useState<ProblemSummary | null>(null)
  const [queryUsed, setQueryUsed] = useState<string>('')
  const [statusMessages, setStatusMessages] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [appliedSettings, setAppliedSettings] = useState<QuerySettings | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [timerFinished, setTimerFinished] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useTheme(settings.theme)

  const normalizedSettings = useMemo(() => {
    return normalizeQuerySettings({
      handle: settings.handle,
      excludeSolved: settings.excludeSolved,
      excludeTried: settings.excludeTried,
      language: settings.language,
      includeTags: parseTagsInput(settings.includeTagsInput),
      excludeTags: parseTagsInput(settings.excludeTagsInput),
      includeTagMode: settings.includeTagMode,
    })
  }, [
    settings.handle,
    settings.excludeSolved,
    settings.excludeTried,
    settings.language,
    settings.includeTagsInput,
    settings.excludeTagsInput,
    settings.includeTagMode,
  ])

  const baseQuery = useMemo(() => buildSearchQuery(normalizedSettings), [normalizedSettings])

  const onTimerComplete = useCallback(() => {
    setTimerFinished(true)
    playAlarmTone()
    sendTimerNotification()
  }, [])

  const timer = useCountdownTimer(INITIAL_TIMER_SECONDS, { onComplete: onTimerComplete })

  useDocumentTitle(timer.secondsLeft, timer.isRunning)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const updateRecentProblems = useCallback((problemId: number) => {
    setRecentProblems((prev) => {
      const next = [problemId, ...prev.filter((id) => id !== problemId)]
      return next.slice(0, MAX_RECENT_IDS)
    })
  }, [setRecentProblems])

  const fetchViaProxy = useCallback(
    async (settingsToUse: QuerySettings, avoidProblemIds: number[], signal?: AbortSignal) => {
      const params = new URLSearchParams()
      if (settingsToUse.handle) {
        params.set('handle', settingsToUse.handle)
      }
      params.set('excludeSolved', String(settingsToUse.excludeSolved))
      params.set('excludeTried', String(settingsToUse.excludeTried))
      params.set('language', settingsToUse.language)
      params.set('includeTagMode', settingsToUse.includeTagMode)
      if (settingsToUse.includeTags.length) {
        params.set('includeTags', settingsToUse.includeTags.join(','))
      }
      if (settingsToUse.excludeTags.length) {
        params.set('excludeTags', settingsToUse.excludeTags.join(','))
      }
      if (avoidProblemIds.length) {
        params.set('recentIds', avoidProblemIds.join(','))
      }

      const response = await fetch(`/api/problems/random?${params.toString()}`, { signal })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(`프록시 요청에 실패했습니다 (${response.status}): ${detail}`)
      }

      const data = (await response.json()) as ProxyResponse
      return data
    },
    [],
  )

  const handleFetchProblem = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setErrorMessage(null)
    setStatusMessages([])

    try {
      const result = settings.useProxy
        ? await fetchViaProxy(normalizedSettings, recentProblems, controller.signal)
        : await fetchRandomProblemWithRelaxations({
            settings: normalizedSettings,
            avoidProblemIds: recentProblems,
            signal: controller.signal,
          })

      setProblem(result.problem)
      setQueryUsed(result.query)
      setAppliedSettings(result.usedSettings)
      setLastUpdated(new Date())
      updateRecentProblems(result.problem.problemId)

      const summaryMessage = result.totalCount
        ? `총 ${numberFormatter.format(result.totalCount)}개의 후보 중에서 무작위로 선택했어요.`
        : '문제를 무작위로 선택했어요.'
      setStatusMessages([summaryMessage, ...result.adjustments])
    } catch (error) {
      if (!settings.useProxy && error instanceof TypeError) {
        setSettings((prev) => ({ ...prev, useProxy: true }))
        setStatusMessages(['브라우저에서 solved.ac 응답을 차단해 프록시 모드로 전환했어요. 다시 시도해 주세요.'])
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        // ignore
      } else if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('알 수 없는 오류가 발생했어요.')
      }
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [
    fetchViaProxy,
    normalizedSettings,
    recentProblems,
    settings.useProxy,
    setSettings,
    updateRecentProblems,
  ])

  const handleStartTimer = useCallback(() => {
    ensureNotificationPermission()
    setTimerFinished(false)
    timer.start()
  }, [timer])

  const handlePauseTimer = useCallback(() => {
    timer.pause()
  }, [timer])

  const handleResetTimer = useCallback(() => {
    setTimerFinished(false)
    timer.reset()
  }, [timer])

  const handleExtendTimer = useCallback(() => {
    setTimerFinished(false)
    timer.extend(TIMER_EXTEND_SECONDS)
  }, [timer])

  const timerLabel = timer.isRunning ? '진행 중' : timerFinished ? '완료됨' : '대기 중'

  return (
    <div className="min-h-full bg-slate-100 pb-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">실랜디 30</h1>
            <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
              Silver Random Challenge
            </span>
            {settings.useProxy && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-100">
                프록시 모드 사용 중
              </span>
            )}
          </div>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            solved.ac의 Silver 등급 문제를 랜덤으로 추천하고 30분 타이머를 함께 제공합니다.
            필터를 조정해 푼 문제나 시도한 문제를 제외하고, 태그나 언어 조건을 적용할 수 있어요.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">필터 설정</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">백준 핸들</span>
                  <input
                    type="text"
                    value={settings.handle}
                    onChange={(event) => setSettings((prev) => ({ ...prev, handle: event.target.value }))}
                    placeholder="예: baekjoon_id"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">언어 제한</span>
                  <select
                    value={settings.language}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        language: event.target.value as LanguageSetting,
                      }))
                    }
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
                        disabled={!settings.handle.trim()}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            excludeSolved: event.target.checked,
                          }))
                        }
                      />
                      <span>푼 문제 제외</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                        checked={settings.excludeTried}
                        disabled={!settings.handle.trim()}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            excludeTried: event.target.checked,
                          }))
                        }
                      />
                      <span>시도 문제 제외</span>
                    </label>
                  </div>
                  {!settings.handle.trim() && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      핸들을 입력해야 solved.ac에서 푼 문제/시도 문제를 제외할 수 있어요.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">선호 태그</span>
                  <input
                    type="text"
                    value={settings.includeTagsInput}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        includeTagsInput: event.target.value,
                      }))
                    }
                    placeholder="예: dp, graph"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name="includeTagMode"
                        value="any"
                        checked={settings.includeTagMode === 'any'}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            includeTagMode: event.target.value as TagMode,
                          }))
                        }
                        className="h-3.5 w-3.5 text-brand-500 focus:ring-brand-400"
                      />
                      <span>태그 중 하나라도 포함</span>
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name="includeTagMode"
                        value="all"
                        checked={settings.includeTagMode === 'all'}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            includeTagMode: event.target.value as TagMode,
                          }))
                        }
                        className="h-3.5 w-3.5 text-brand-500 focus:ring-brand-400"
                      />
                      <span>모든 태그 포함</span>
                    </label>
                  </div>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">제외 태그</span>
                  <input
                    type="text"
                    value={settings.excludeTagsInput}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        excludeTagsInput: event.target.value,
                      }))
                    }
                    placeholder="예: implementation"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">테마</span>
                  <select
                    value={settings.theme}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        theme: event.target.value as ThemeSetting,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="system">시스템 설정 따르기</option>
                    <option value="light">라이트</option>
                    <option value="dark">다크</option>
                  </select>
                </label>

                <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={settings.useProxy}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        useProxy: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                  />
                  <span>solved.ac CORS 우회를 위해 프록시 사용</span>
                </label>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleFetchProblem}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:bg-brand-400"
                >
                  {isLoading && (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {isLoading ? '문제 찾는 중...' : '문제 뽑기'}
                </button>
                <code className="rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                  {baseQuery}
                </code>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">추천 문제</h2>
                {lastUpdated && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>

              {errorMessage && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/40 dark:text-rose-100">
                  {errorMessage}
                </div>
              )}

              {statusMessages.length > 0 && (
                <ul className="mt-4 list-disc space-y-1 rounded-lg bg-slate-100/80 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {statusMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}

              {problem ? (
                <div className="mt-5 space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {problem.titleKo}
                    </h3>
                    {problem.titleEn && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{problem.titleEn}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                      {problem.tier}
                    </span>
                    <span>푼 사람 수: {numberFormatter.format(problem.acceptedUserCount)}명</span>
                    <span>평균 제출: {problem.averageTries.toFixed(2)}회</span>
                    {!problem.isSolvable && <span className="text-amber-600 dark:text-amber-300">채점 불가</span>}
                    {problem.isPartial && <span className="text-amber-600 dark:text-amber-300">부분 점수</span>}
                  </div>

                  {problem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {problem.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <a
                      href={problem.bojUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      백준에서 풀기
                    </a>
                    <a
                      href={problem.solvedAcUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      solved.ac 상세 보기
                    </a>
                    <button
                      type="button"
                      onClick={handleFetchProblem}
                      disabled={isLoading}
                      className="inline-flex items-center gap-2 rounded-lg border border-brand-400 px-4 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-500/60 dark:text-brand-200 dark:hover:bg-brand-500/10"
                    >
                      다시 뽑기
                    </button>
                  </div>

                  <div className="rounded-lg bg-slate-100/70 p-4 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                    <p>적용된 검색 쿼리: {queryUsed}</p>
                    {appliedSettings && (
                      <p className="mt-2">
                        사용된 옵션 · 언어: {appliedSettings.language === 'ko' ? '한국어만' : '전체'} · 푼 문제 제외:{' '}
                        {appliedSettings.excludeSolved ? '예' : '아니오'} · 시도 문제 제외:{' '}
                        {appliedSettings.excludeTried ? '예' : '아니오'}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white/40 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                  아직 추천된 문제가 없어요. “문제 뽑기” 버튼을 눌러 시작해 보세요!
                </div>
              )}

              {recentProblems.length > 0 && (
                <div className="mt-6 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">최근 추천 ID</h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {recentProblems.slice(0, 10).map((id) => (
                      <a
                        key={id}
                        href={`https://www.acmicpc.net/problem/${id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        #{id}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">30분 타이머</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                타이머가 종료되면 알림과 함께 사운드가 재생돼요.
              </p>
              <div className="mt-6 flex flex-col items-center gap-4">
                <div
                  className={classNames(
                    'flex h-32 w-full flex-col items-center justify-center rounded-2xl border text-4xl font-bold transition',
                    timerFinished
                      ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200'
                      : 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white',
                  )}
                >
                  <span>{formatSeconds(timer.secondsLeft)}</span>
                  <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {timerLabel}
                  </span>
                </div>

                <div className="flex w-full flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleStartTimer}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-300"
                  >
                    {timer.isRunning ? '계속 진행 중' : timerFinished ? '다시 시작' : '시작/재개'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePauseTimer}
                    disabled={!timer.isRunning}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    일시정지
                  </button>
                  <button
                    type="button"
                    onClick={handleResetTimer}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    리셋
                  </button>
                  <button
                    type="button"
                    onClick={handleExtendTimer}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  >
                    +5분 연장
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">사용 팁</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>태그는 쉼표나 공백으로 구분해 입력하세요. 예: <code className="rounded bg-slate-200 px-1 text-xs">dp graph</code></li>
                <li>프록시 모드는 solved.ac에서 CORS가 차단될 때 자동으로 켜집니다.</li>
                <li>최근 추천된 문제는 최대 {MAX_RECENT_IDS}개까지 기억해 중복 출제를 줄여요.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}
