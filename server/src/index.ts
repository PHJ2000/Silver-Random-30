import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import problemsRouter from './routes/problems.js'
import runsRouter from './routes/runs.js'
import leaderboardRouter from './routes/leaderboard.js'
import webhookRouter from './routes/webhook.js'
import { startWeeklyJob } from './jobs/weekly.js'

const app = express()

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean)

app.use(
  cors({
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : undefined,
    credentials: false,
  }),
)
app.use(express.json())
app.use(morgan('dev'))

const apiKey = process.env.API_KEY
if (apiKey) {
  app.use((req, res, next) => {
    if (req.method === 'GET') {
      return next()
    }
    const provided = req.headers['x-api-key']
    if (provided === apiKey) {
      return next()
    }
    return res.status(401).json({ error: '유효한 API 키가 필요합니다.' })
  })
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/problems', problemsRouter)
app.use('/api/runs', runsRouter)
app.use('/api/leaderboard', leaderboardRouter)
app.use('/api/webhook', webhookRouter)

const port = Number.parseInt(process.env.PORT ?? '8080', 10)

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})

startWeeklyJob()
