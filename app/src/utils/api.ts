import type { AppSettings } from '../store/settings'
import type { Problem, Run, RunResult } from 'shared/types'

interface RandomProblemResponse {
  problem: Problem & {
    titleEn?: string
    tier?: string
    tags?: string[]
    acceptedUserCount?: number
    averageTries?: number
    isSolvable?: boolean
    isPartial?: boolean
  }
  totalCount: number
  query: string
}

function buildHeaders(apiKey?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }
  return headers
}

export async function fetchRandomProblem(settings: AppSettings): Promise<RandomProblemResponse> {
  const params = new URLSearchParams()
  if (settings.bojHandle) {
    params.set('handle', settings.bojHandle)
  }
  params.set('excludeSolved', String(settings.excludeSolved))
  params.set('excludeTried', String(settings.excludeTried))
  if (settings.language === 'ko') {
    params.set('language', 'ko')
  }
  if (settings.queryBoostTags.length) {
    params.set('includeTags', settings.queryBoostTags.join(','))
  }
  if (settings.recentProblemIds.length) {
    params.set('recentIds', settings.recentProblemIds.join(','))
  }

  const response = await fetch(`/api/problems/random?${params.toString()}`)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`문제를 가져오지 못했습니다: ${response.status} ${detail}`)
  }
  return (await response.json()) as RandomProblemResponse
}

export async function createRun(args: {
  handle: string
  problem: Problem
  tier?: string
  durationSec: number
  startedAt: number
  apiKey?: string
  webhookUrl?: string
}): Promise<{ id: string }> {
  const response = await fetch('/api/runs', {
    method: 'POST',
    headers: buildHeaders(args.apiKey),
    body: JSON.stringify({
      handle: args.handle,
      problemId: args.problem.problemId,
      tier: args.tier,
      durationSec: args.durationSec,
      startedAt: args.startedAt,
      webhookOverride: args.webhookUrl,
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`기록 생성 실패: ${response.status} ${detail}`)
  }
  return (await response.json()) as { id: string }
}

export async function finishRun(args: {
  id: string
  result: RunResult
  endedAt: number
  timeRemainingSec: number
  revealsUsed: number
  notes?: string
  apiKey?: string
  webhookUrl?: string
}): Promise<{ ok: boolean; points?: number }> {
  const response = await fetch(`/api/runs/${args.id}/finish`, {
    method: 'POST',
    headers: buildHeaders(args.apiKey),
    body: JSON.stringify({
      result: args.result,
      endedAt: args.endedAt,
      timeRemainingSec: args.timeRemainingSec,
      revealsUsed: args.revealsUsed,
      notes: args.notes,
      webhookOverride: args.webhookUrl,
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`기록 종료 실패: ${response.status} ${detail}`)
  }
  return (await response.json()) as { ok: boolean; points?: number }
}

export async function postRunEvent(args: {
  id: string
  type: 'warning' | 'timeout' | 'note'
  payload?: string
  apiKey?: string
  webhookUrl?: string
}): Promise<void> {
  const response = await fetch(`/api/runs/${args.id}/events`, {
    method: 'POST',
    headers: buildHeaders(args.apiKey),
    body: JSON.stringify({ type: args.type, payload: args.payload, webhookOverride: args.webhookUrl }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`이벤트 전송 실패: ${response.status} ${detail}`)
  }
}

export async function fetchRuns(handle: string, limit = 50): Promise<Run[]> {
  const params = new URLSearchParams()
  if (handle) params.set('handle', handle)
  params.set('limit', String(limit))
  const response = await fetch(`/api/runs?${params.toString()}`)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`기록 조회 실패: ${response.status} ${detail}`)
  }
  const data = (await response.json()) as { runs: Run[] }
  return data.runs
}

export interface LeaderboardItem {
  handle: string
  solvedCount: number
  points: number
  avgSolveSec: number | null
}

export async function fetchLeaderboard(weekStart?: string): Promise<{ weekStart: string; items: LeaderboardItem[] }> {
  const params = new URLSearchParams()
  if (weekStart) params.set('weekStart', weekStart)
  const response = await fetch(`/api/leaderboard?${params.toString()}`)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`랭킹 조회 실패: ${response.status} ${detail}`)
  }
  return (await response.json()) as { weekStart: string; items: LeaderboardItem[] }
}

export interface SyncRunResponse {
  ok: boolean
  result: RunResult
  solved: boolean
  tried: boolean
  points?: number
  timeRemainingSec: number
}

export async function syncRunFromSolvedAc(args: {
  id: string
  endedAt: number
  revealsUsed: number
  notes?: string
  apiKey?: string
  webhookUrl?: string
}): Promise<SyncRunResponse> {
  const response = await fetch(`/api/runs/${args.id}/sync`, {
    method: 'POST',
    headers: buildHeaders(args.apiKey),
    body: JSON.stringify({
      endedAt: args.endedAt,
      revealsUsed: args.revealsUsed,
      notes: args.notes,
      webhookOverride: args.webhookUrl,
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`기록 동기화 실패: ${response.status} ${detail}`)
  }
  return (await response.json()) as SyncRunResponse
}
