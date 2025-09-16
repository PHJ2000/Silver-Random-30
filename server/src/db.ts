import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.resolve(__dirname, '..', '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'solandi.db')

export const db = new Database(dbPath)

db.pragma('journal_mode = WAL')

const createRunsTable = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  problemId INTEGER NOT NULL,
  tier TEXT,
  startedAt INTEGER NOT NULL,
  endedAt INTEGER,
  durationSec INTEGER NOT NULL,
  result TEXT CHECK(result IN ('solved','failed','partial')) DEFAULT 'failed',
  timeRemainingSec INTEGER DEFAULT 0,
  revealsUsed INTEGER DEFAULT 0,
  notes TEXT,
  webhookOverride TEXT
)
`

const createWeeklyCacheTable = `
CREATE TABLE IF NOT EXISTS weekly_cache (
  weekStartDate TEXT NOT NULL,
  handle TEXT NOT NULL,
  solvedCount INTEGER NOT NULL,
  points INTEGER NOT NULL,
  avgSolveSec INTEGER,
  PRIMARY KEY (weekStartDate, handle)
)
`

db.exec(createRunsTable)

const runColumns = db.prepare("PRAGMA table_info('runs')").all() as Array<{ name: string }>
const hasWebhookOverrideColumn = runColumns.some((column) => column.name === 'webhookOverride')
if (!hasWebhookOverrideColumn) {
  db.exec("ALTER TABLE runs ADD COLUMN webhookOverride TEXT")
}
db.exec(createWeeklyCacheTable)
