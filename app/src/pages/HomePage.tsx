import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import dayjs from 'dayjs'
import { ProblemCard } from '../components/ProblemCard'
import { SettingsPanel } from '../components/SettingsPanel'
import { TimerPanel } from '../components/TimerPanel'
import { RunHistory } from '../components/RunHistory'
import { useSettingsStore } from '../store/settings'
import { useRunStore } from '../store/run'
import { useCountdown } from '../hooks/useCountdown'
import { useTimerDocumentTitle } from '../hooks/useTimerTitle'
import { useBeforeUnloadWarning } from '../hooks/useBeforeUnloadWarning'
import { useRunEvents } from '../hooks/useRunEvents'
import { useAutoReveal } from '../hooks/useAutoReveal'
import { ensureNotificationPermission, notifyTimerFinished } from '../utils/notifications'
import { playAlarm } from '../utils/alarm'
import { createRun, fetchRandomProblem, fetchRuns, syncRunFromSolvedAc } from '../utils/api'
import type { Run } from 'shared/types'

const numberFormat = new Intl.NumberFormat('ko-KR')

export function HomePage() {
  const {
    settings,
    addRecentProblem,
  } = useSettingsStore((state) => ({
    settings: state.settings,
    addRecentProblem: state.addRecentProblem,
  }))
  const runStore = useRunStore()
  const {
    problem,
    runId,
    revealsUsed,
    setProblem,
    setRunId,
    setStartedAt,
    setSpoilerVisibility,
    durationSec,
    setResult,
    notes,
    setNotes,
    setDurationSec,
  } = useRunStore((state) => ({
    problem: state.problem,
    runId: state.runId,
    revealsUsed: state.revealsUsed,
    setProblem: state.setProblem,
    setRunId: state.setRunId,
    setStartedAt: state.setStartedAt,
    setSpoilerVisibility: state.setSpoilerVisibility,
    durationSec: state.durationSec,
    setResult: state.setResult,
    notes: state.notes,
    setNotes: state.setNotes,
    setDurationSec: state.setDurationSec,
  }))

  const [statusMessages, setStatusMessages] = useState<string[]>([])
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [querySummary, setQuerySummary] = useState<string | undefined>(undefined)
  const [history, setHistory] = useState<Run[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [lastNotificationAt, setLastNotificationAt] = useState<number | null>(null)

  const trimmedHandle = settings.bojHandle.trim()

  const timer = useCountdown()
  const hasFinished = !timer.isRunning && timer.seconds <= 0

  useTimerDocumentTitle()
  useBeforeUnloadWarning()
  useRunEvents()
  useAutoReveal()

  const fetchHistory = useCallback(() => {
    setHistoryLoading(true)
    fetchRuns(trimmedHandle, settings.historyLimit)
      .then(setHistory)
      .catch((err) => {
        console.warn(err)
      })
      .finally(() => setHistoryLoading(false))
  }, [trimmedHandle, settings.historyLimit])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleFetchProblem = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSyncStatus(null)
    try {
      const response = await fetchRandomProblem(settings)
      setProblem(response.problem, settings.defaultDurationMin * 60)
      setRunId(null)
      setStartedAt(null)
      setResult(null)
      setNotes('')
      timer.reset(settings.defaultDurationMin * 60 * 1000)
      addRecentProblem(response.problem.problemId)
      setStatusMessages([
        response.totalCount
          ? `총 ${numberFormat.format(response.totalCount)}개의 후보 중 무작위로 선택했어요.`
          : '문제를 무작위로 선택했어요.',
      ])
      setQuerySummary(response.query)
      if (!settings.hideMeta.tier) {
        setSpoilerVisibility('tier', true)
      }
      if (!settings.hideMeta.tags) {
        setSpoilerVisibility('tags', true)
      }
      if (!settings.hideMeta.algorithms) {
        setSpoilerVisibility('algorithms', true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제를 가져오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [addRecentProblem, setNotes, setProblem, setResult, setRunId, setSpoilerVisibility, setStartedAt, settings, timer])

  const handleOpenBaekjoon = useCallback(async () => {
    if (!problem) return
    setSyncStatus(null)
    ensureNotificationPermission()
    const now = Date.now()
    timer.start(timer.durationMs)
    setDurationSec(Math.round(timer.durationMs / 1000))
    setStartedAt(now)
    try {
      const response = await createRun({
        handle: trimmedHandle || 'anonymous',
        problem,
        tier: problem.tier,
        durationSec: Math.round(timer.durationMs / 1000),
        startedAt: now,
        apiKey: settings.apiKey,
        webhookUrl: settings.webhookOverride,
      })
      setRunId(response.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '기록 생성에 실패했습니다.')
    }
    window.open(problem.bojUrl, '_blank', 'noopener,noreferrer')
  }, [
    problem,
    setDurationSec,
    setRunId,
    setStartedAt,
    settings.apiKey,
    trimmedHandle,
    settings.webhookOverride,
    timer,
  ])

  const handlePause = useCallback(() => {
    timer.pause()
  }, [timer])

  const handleReset = useCallback(() => {
    timer.reset(settings.defaultDurationMin * 60 * 1000)
    setRunId(null)
    setStartedAt(null)
    setResult(null)
    setNotes('')
    setDurationSec(settings.defaultDurationMin * 60)
    setSyncStatus(null)
  }, [setDurationSec, setNotes, setResult, setRunId, setStartedAt, settings.defaultDurationMin, timer])

  const handleExtend = useCallback(() => {
    timer.extend(settings.extendStepMin * 60 * 1000)
    setDurationSec(durationSec + settings.extendStepMin * 60)
  }, [durationSec, setDurationSec, settings.extendStepMin, timer])

  const handleOpenPopup = () => {
    window.open(`${window.location.origin}/mini`, 'solandi-mini', 'width=320,height=200')
  }


  const handleSyncRecords = useCallback(async () => {
    if (!runId) {
      setError('진행 중인 기록이 없습니다.')
      return
    }
    if (!trimmedHandle) {
      setError('백준 핸들을 설정하면 solved.ac 기록을 불러올 수 있습니다.')
      return
    }
    timer.pause()
    setError(null)
    setSyncStatus('solved.ac 기록을 확인하는 중입니다...')
    try {
      const endedAt = Date.now()
      const response = await syncRunFromSolvedAc({
        id: runId,
        endedAt,
        revealsUsed,
        notes,
        apiKey: settings.apiKey,
        webhookUrl: settings.webhookOverride,
      })
      setResult(response.result)
      const message =
        response.result === 'solved'
          ? '✅ solved.ac 기록을 기반으로 해결 완료로 저장했어요.'
          : response.result === 'partial'
          ? '🟡 solved.ac에서 시도 기록만 확인되어 부분 성공으로 저장했어요.'
          : '❌ solved.ac에서 제출 기록을 찾지 못해 실패로 저장했어요.'
      setSyncStatus(message)
      fetchHistory()
    } catch (err) {
      setSyncStatus(null)
      setError(err instanceof Error ? err.message : '기록 동기화에 실패했습니다.')
    }
  }, [runId, trimmedHandle, settings.apiKey, settings.webhookOverride, timer, revealsUsed, notes, setResult, fetchHistory])

  const prevFinishedRef = useRef(false)
  useEffect(() => {
    if (hasFinished && !prevFinishedRef.current) {
      if (settings.sound.enabled) {
        void playAlarm(settings.sound.volume)
      }
      if (!lastNotificationAt || Date.now() - lastNotificationAt > 1000) {
        notifyTimerFinished()
        setLastNotificationAt(Date.now())
      }
    }
    prevFinishedRef.current = hasFinished
  }, [hasFinished, lastNotificationAt, settings.sound.enabled, settings.sound.volume])

  const handleNotesChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(event.target.value)
  }

  const timerExtendMinutes = useMemo(() => settings.extendStepMin, [settings.extendStepMin])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">타이머 제어</h2>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              시작 시간: {runStore.startedAt ? dayjs(runStore.startedAt).format('HH:mm:ss') : '-'}
            </div>
          </div>
          <TimerPanel
            seconds={timer.seconds}
            isRunning={timer.isRunning}
            hasFinished={hasFinished}
            onStart={() => {
              if (timer.isRunning) return
              if (timer.remainingMs < timer.durationMs) {
                timer.resume()
              } else {
                timer.start(timer.durationMs)
              }
            }}
            onPause={handlePause}
            onReset={handleReset}
            onExtend={handleExtend}
            onOpenPopup={handleOpenPopup}
            extendMinutes={timerExtendMinutes}
          />
          <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSyncRecords}
                disabled={!runId || !trimmedHandle}
                className="rounded-lg bg-brand-500 px-3 py-2 font-semibold text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                기록 가져오기
              </button>
              {!trimmedHandle && (
                <span className="text-[11px] text-slate-500 dark:text-slate-500">백준 핸들을 설정하면 solved.ac 기록을 자동으로 불러올 수 있어요.</span>
              )}
            </div>
            {syncStatus && (
              <p className="rounded-lg bg-slate-100/80 px-3 py-2 text-[13px] text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                {syncStatus}
              </p>
            )}
            <textarea
              value={notes}
              onChange={handleNotesChange}
              placeholder="메모를 남겨보세요"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <ProblemCard
          problem={problem}
          onOpenBaekjoon={handleOpenBaekjoon}
          onFetchNew={handleFetchProblem}
          loading={loading}
          statusMessages={statusMessages}
          error={error}
          querySummary={querySummary}
        />

        <RunHistory runs={history} loading={historyLoading} onRefresh={fetchHistory} />
      </div>
      <div className="space-y-6">
        <SettingsPanel />
      </div>
    </div>
  )
}
