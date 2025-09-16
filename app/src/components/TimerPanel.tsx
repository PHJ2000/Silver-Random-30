import { useEffect } from 'react'

interface TimerPanelProps {
  seconds: number
  isRunning: boolean
  hasFinished: boolean
  onStart: () => void
  onPause: () => void
  onReset: () => void
  onExtend: () => void
  onOpenPopup: () => void
  extendMinutes: number
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60)
  const seconds = Math.max(0, total % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function TimerPanel({
  seconds,
  isRunning,
  hasFinished,
  onStart,
  onPause,
  onReset,
  onExtend,
  onOpenPopup,
  extendMinutes,
}: TimerPanelProps) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target && event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        if (isRunning) {
          onPause()
        } else {
          onStart()
        }
      }
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        onReset()
      }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault()
        onExtend()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isRunning, onPause, onStart, onReset, onExtend])

  const statusLabel = isRunning ? '진행 중' : hasFinished ? '완료됨' : '대기 중'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">30분 타이머</h2>
        <button
          type="button"
          onClick={onOpenPopup}
          className="text-xs font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-300"
        >
          미니 창 열기
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Space: 시작/일시정지 · R: 리셋 · E: +{extendMinutes}분</p>
      <div className="mt-6 flex flex-col items-center gap-4">
        <div
          className={`flex h-32 w-full flex-col items-center justify-center rounded-2xl border text-4xl font-bold transition ${
            hasFinished
              ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200'
              : 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
          }`}
        >
          <span>{formatSeconds(seconds)}</span>
          <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {statusLabel}
          </span>
        </div>
        <div className="flex w-full flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onStart}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            {isRunning ? '진행 중' : hasFinished ? '다시 시작' : '시작/재개'}
          </button>
          <button
            type="button"
            onClick={onPause}
            disabled={!isRunning}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            일시정지
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            리셋
          </button>
          <button
            type="button"
            onClick={onExtend}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            +{extendMinutes}분 연장
          </button>
        </div>
      </div>
    </div>
  )
}
