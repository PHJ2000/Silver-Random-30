export type RunResult = 'solved' | 'failed' | 'partial'

export interface Problem {
  problemId: number
  titleKo: string
  titleEn?: string
  tier?: string
  tags?: string[]
  solvedCount?: number
  bojUrl: string
}

export interface Run {
  id: string
  handle: string
  problemId: number
  tier?: string
  startedAt: number
  endedAt?: number
  durationSec: number
  result?: RunResult
  timeRemainingSec?: number
  revealsUsed?: number
  notes?: string
}

export interface ServerConfig {
  discordWebhookUrl: string | null
  port: number
  timezone: string
  apiKey: string | null
}
