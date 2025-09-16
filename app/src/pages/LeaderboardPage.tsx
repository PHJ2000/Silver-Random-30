import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { fetchLeaderboard, type LeaderboardItem } from '../utils/api'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Seoul')

function getRecentWeeks(count: number) {
  const weeks: string[] = []
  const today = dayjs().tz('Asia/Seoul')
  let monday = today.startOf('week').add(1, 'day')
  if (monday.day() !== 1) {
    monday = today.startOf('week')
  }
  for (let i = 0; i < count; i += 1) {
    weeks.push(monday.subtract(i, 'week').format('YYYY-MM-DD'))
  }
  return weeks
}

export function LeaderboardPage() {
  const [items, setItems] = useState<LeaderboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const weekOptions = useMemo(() => getRecentWeeks(6), [])
  const [selectedWeek, setSelectedWeek] = useState<string>(weekOptions[0] ?? dayjs().format('YYYY-MM-DD'))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchLeaderboard(selectedWeek)
      .then((response) => {
        if (!cancelled) {
          setItems(response.items)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '랭킹을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedWeek])

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">주간 랭킹</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          월요일 00:00 (KST) 기준으로 지난 주의 실랜디 기록을 집계합니다. 해결 수, 점수, 평균 해결 시간을 기준으로 정렬돼요.
        </p>
        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>주차 선택</span>
            <select
              value={selectedWeek}
              onChange={(event) => setSelectedWeek(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {weekOptions.map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        {loading && <p className="text-sm text-slate-500 dark:text-slate-400">불러오는 중...</p>}
        {error && <p className="text-sm text-rose-500">{error}</p>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">순위</th>
                  <th className="px-4 py-2">핸들</th>
                  <th className="px-4 py-2">해결</th>
                  <th className="px-4 py-2">점수</th>
                  <th className="px-4 py-2">평균 해결 시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-600 dark:divide-slate-800 dark:text-slate-300">
                {items.map((item, index) => (
                  <tr key={item.handle}>
                    <td className="px-4 py-2">{index + 1}</td>
                    <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-100">{item.handle}</td>
                    <td className="px-4 py-2">{item.solvedCount}</td>
                    <td className="px-4 py-2">{item.points}</td>
                    <td className="px-4 py-2">{item.avgSolveSec ? `${Math.round(item.avgSolveSec)}초` : '-'}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
