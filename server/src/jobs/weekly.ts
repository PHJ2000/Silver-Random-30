import cron from 'node-cron'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { postWeeklyDiscordSummary } from '../routes/leaderboard.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const DEFAULT_TZ = process.env.TZ || 'Asia/Seoul'
dayjs.tz.setDefault(DEFAULT_TZ)

function lastWeekStart(): dayjs.Dayjs {
  const now = dayjs().tz(DEFAULT_TZ)
  const thisWeekMonday = now.startOf('week').add(1, 'day')
  const monday = thisWeekMonday.subtract(7, 'day').startOf('day')
  return monday
}

export function startWeeklyJob() {
  cron.schedule(
    '1 0 * * 1',
    async () => {
      const weekStart = lastWeekStart()
      await postWeeklyDiscordSummary(weekStart)
    },
    { timezone: DEFAULT_TZ },
  )
}
