import type { Request, Response } from 'express'
import { Router } from 'express'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { db } from '../db.js'
import { calculateRunPoints } from '../utils/scoring.js'
import { sendDiscord } from '../utils/discord.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const DEFAULT_TZ = process.env.TZ || 'Asia/Seoul'

dayjs.tz.setDefault(DEFAULT_TZ)

const router = Router()

interface LeaderboardRow {
  handle: string
  solvedCount: number
  points: number
  avgSolveSec: number | null
}

function getWeekStartDate(input?: string): dayjs.Dayjs {
  if (input) {
    const parsed = dayjs.tz(input, DEFAULT_TZ)
    if (parsed.isValid()) {
      return parsed.startOf('day')
    }
  }
  const now = dayjs().tz(DEFAULT_TZ)
  const monday = now.startOf('week').add(1, 'day')
  if (monday.day() !== 1) {
    return now.startOf('week')
  }
  return monday
}

function getRange(weekStart: dayjs.Dayjs) {
  const start = weekStart.startOf('day')
  const end = start.add(7, 'day')
  return { start, end }
}

function calculateLeaderboard(start: dayjs.Dayjs, end: dayjs.Dayjs): LeaderboardRow[] {
  const rows = db
    .prepare(
      `SELECT handle, result, durationSec, timeRemainingSec, revealsUsed
       FROM runs
       WHERE startedAt >= ? AND startedAt < ?`,
    )
    .all(start.valueOf(), end.valueOf()) as Array<{
    handle: string
    result: string
    durationSec: number
    timeRemainingSec: number | null
    revealsUsed: number | null
  }>

  const aggregates = new Map<string, { solvedCount: number; points: number; durations: number[] }>()
  for (const row of rows) {
    const remaining = row.timeRemainingSec ?? 0
    const reveals = row.revealsUsed ?? 0
    const points = calculateRunPoints({ result: row.result, timeRemainingSec: remaining, revealsUsed: reveals })
    const used = row.durationSec - Math.max(0, remaining)

    if (!aggregates.has(row.handle)) {
      aggregates.set(row.handle, { solvedCount: 0, points: 0, durations: [] })
    }
    const entry = aggregates.get(row.handle)!
    if (row.result === 'solved') {
      entry.solvedCount += 1
      entry.durations.push(Math.max(0, used))
    }
    entry.points += points
  }

  const result: LeaderboardRow[] = Array.from(aggregates.entries()).map(([handle, value]) => {
    const avgSolveSec = value.durations.length
      ? value.durations.reduce((acc, cur) => acc + cur, 0) / value.durations.length
      : null
    return {
      handle,
      solvedCount: value.solvedCount,
      points: value.points,
      avgSolveSec,
    }
  })

  result.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount
    if (a.avgSolveSec === null && b.avgSolveSec === null) return 0
    if (a.avgSolveSec === null) return 1
    if (b.avgSolveSec === null) return -1
    return a.avgSolveSec - b.avgSolveSec
  })

  return result
}

function storeCache(weekStart: string, rows: LeaderboardRow[]) {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO weekly_cache (weekStartDate, handle, solvedCount, points, avgSolveSec)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const tx = db.transaction((items: LeaderboardRow[]) => {
    items.forEach((row) => insert.run(weekStart, row.handle, row.solvedCount, row.points, row.avgSolveSec ?? null))
  })
  tx(rows)
}

function fetchCached(weekStart: string): LeaderboardRow[] {
  return db
    .prepare(
      `SELECT handle, solvedCount, points, avgSolveSec
       FROM weekly_cache
       WHERE weekStartDate = ?
       ORDER BY points DESC, solvedCount DESC, avgSolveSec ASC`,
    )
    .all(weekStart) as LeaderboardRow[]
}

router.get('/', (req: Request, res: Response) => {
  const weekStartParam = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined
  const weekStart = getWeekStartDate(weekStartParam)
  const { start, end } = getRange(weekStart)
  const key = weekStart.format('YYYY-MM-DD')

  let rows = fetchCached(key)
  if (!rows.length) {
    rows = calculateLeaderboard(start, end)
    storeCache(key, rows)
  }

  res.json({ weekStart: key, items: rows })
})

router.post('/rebuild', (req: Request, res: Response) => {
  const weekStartParam = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined
  const weekStart = getWeekStartDate(weekStartParam)
  const { start, end } = getRange(weekStart)
  const key = weekStart.format('YYYY-MM-DD')

  const rows = calculateLeaderboard(start, end)
  storeCache(key, rows)

  res.json({ ok: true, weekStart: key, items: rows })
})

export async function postWeeklyDiscordSummary(weekStart: dayjs.Dayjs) {
  const { start, end } = getRange(weekStart)
  const rows = calculateLeaderboard(start, end).slice(0, 10)
  if (!rows.length) {
    await sendDiscord(`📊 실랜디 주간 랭킹(${weekStart.format('YYYY-MM-DD')} 시작 주)\n_기록 없음_`)
    return
  }
  const lines = rows.map((row, index) => {
    const avg = row.avgSolveSec ? Math.round(row.avgSolveSec) : '-'
    return `**${index + 1}. ${row.handle}** — ${row.points}점, 해결 ${row.solvedCount}개, 평균 ${avg}초`
  })
  await sendDiscord(`📊 실랜디 주간 랭킹(${weekStart.format('YYYY-MM-DD')} 시작 주)\n${lines.join('\n')}`)
}

export default router
