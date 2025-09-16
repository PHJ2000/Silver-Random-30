import type { Run } from 'shared/types'
import dayjs from 'dayjs'

interface RunHistoryProps {
  runs: Run[]
  loading: boolean
  onRefresh: () => void
}

function formatDuration(seconds: number | undefined) {
  if (typeof seconds !== 'number') return '-'
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs}s`
}

export function RunHistory({ runs, loading, onRefresh }: RunHistoryProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">최근 기록</h2>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-300"
        >
          {loading ? '불러오는 중...' : '새로고침'}
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
          <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">시작</th>
              <th className="px-3 py-2">문제</th>
              <th className="px-3 py-2">결과</th>
              <th className="px-3 py-2">남은 시간</th>
              <th className="px-3 py-2">힌트</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-600 dark:divide-slate-800 dark:text-slate-300">
            {runs.map((run) => (
              <tr key={run.id}>
                <td className="px-3 py-2 text-xs">{dayjs(run.startedAt).format('MM/DD HH:mm')}</td>
                <td className="px-3 py-2">
                  <a
                    href={`https://www.acmicpc.net/problem/${run.problemId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline dark:text-brand-300"
                  >
                    #{run.problemId}
                  </a>
                </td>
                <td className="px-3 py-2 capitalize">{run.result ?? '-'}</td>
                <td className="px-3 py-2 text-xs">{formatDuration(run.timeRemainingSec)}</td>
                <td className="px-3 py-2 text-xs">{run.revealsUsed ?? 0}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
