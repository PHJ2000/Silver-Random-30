import { useCountdown } from '../hooks/useCountdown'
import { useRunStore } from '../store/run'

function format(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.max(0, seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function MiniTimerPage() {
  const timer = useCountdown()
  const problem = useRunStore((state) => state.problem)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
      <div className="text-sm text-slate-300">{problem ? problem.titleKo : '실랜디 30'}</div>
      <div className="text-5xl font-bold">{format(timer.seconds)}</div>
      <div className="flex gap-3 text-xs">
        <button
          type="button"
          onClick={() => (timer.isRunning ? timer.pause() : timer.resume())}
          className="rounded bg-emerald-500 px-3 py-1 font-semibold"
        >
          {timer.isRunning ? '일시정지' : '재개'}
        </button>
        <button
          type="button"
          onClick={() => timer.reset()}
          className="rounded bg-rose-500 px-3 py-1 font-semibold"
        >
          리셋
        </button>
      </div>
    </div>
  )
}
