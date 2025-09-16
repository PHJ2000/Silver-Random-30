import type { Request, Response } from 'express'
import { Router } from 'express'
import crypto from 'node:crypto'
import { db } from '../db.js'
import { sendDiscord } from '../utils/discord.js'
import { calculateRunPoints } from '../utils/scoring.js'
import { fetchUserProblemProgress } from '../utils/progress.js'

const router = Router()

type RunResult = 'solved' | 'failed' | 'partial'

function assertHandle(handle: unknown): string {
  if (typeof handle !== 'string' || handle.trim().length === 0) {
    throw new Error('handle은 비어 있을 수 없습니다.')
  }
  return handle.trim()
}

router.post('/', (req: Request, res: Response) => {
  try {
    const handle = assertHandle(req.body?.handle)
    const problemId = Number.parseInt(String(req.body?.problemId), 10)
    const tier = typeof req.body?.tier === 'string' ? req.body.tier : null
    const durationSec = Number.parseInt(String(req.body?.durationSec ?? 1800), 10)
    const startedAt = Number.parseInt(String(req.body?.startedAt ?? Date.now()), 10)
    const webhookOverride = typeof req.body?.webhookOverride === 'string' ? req.body.webhookOverride : null

    if (!Number.isInteger(problemId) || problemId <= 0) {
      throw new Error('problemId가 유효하지 않습니다.')
    }
    if (!Number.isInteger(durationSec) || durationSec <= 0) {
      throw new Error('durationSec이 유효하지 않습니다.')
    }
    if (!Number.isInteger(startedAt) || startedAt <= 0) {
      throw new Error('startedAt이 유효하지 않습니다.')
    }

    const id = crypto.randomUUID()
    const stmt = db.prepare(
      `INSERT INTO runs (id, handle, problemId, tier, startedAt, durationSec, webhookOverride) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    stmt.run(id, handle, problemId, tier, startedAt, durationSec, webhookOverride)

    void sendDiscord(
      `⏱️ 실랜디 시작: **${handle}** — #${problemId}${tier ? ` (${tier})` : ''}`,
      undefined,
      webhookOverride || undefined,
    )

    res.status(201).json({ id })
  } catch (error) {
    const message = error instanceof Error ? error.message : '기록 생성에 실패했습니다.'
    res.status(400).json({ error: message })
  }
})

router.post('/:id/finish', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const result = typeof req.body?.result === 'string' ? (req.body.result as RunResult) : 'failed'
    const endedAt = Number.parseInt(String(req.body?.endedAt ?? Date.now()), 10)
    const timeRemainingSec = Number.parseInt(String(req.body?.timeRemainingSec ?? 0), 10)
    const revealsUsed = Number.parseInt(String(req.body?.revealsUsed ?? 0), 10)
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : null
    const webhookOverride = typeof req.body?.webhookOverride === 'string' ? req.body.webhookOverride : null

    if (!Number.isInteger(endedAt) || endedAt <= 0) {
      throw new Error('endedAt이 유효하지 않습니다.')
    }

    const info = db
      .prepare('SELECT handle, problemId, tier, durationSec, startedAt, webhookOverride FROM runs WHERE id = ?')
      .get(id) as {
        handle: string
        problemId: number
        tier?: string | null
        durationSec: number
        startedAt: number
        webhookOverride?: string | null
      } | undefined

    if (!info) {
      return res.status(404).json({ error: '존재하지 않는 기록입니다.' })
    }

    db.prepare(
      `UPDATE runs
       SET endedAt = ?, result = ?, timeRemainingSec = ?, revealsUsed = ?, notes = ?, webhookOverride = COALESCE(?, webhookOverride)
       WHERE id = ?`,
    ).run(endedAt, result, Math.max(0, timeRemainingSec), Math.max(0, revealsUsed), notes, webhookOverride, id)

    const points = calculateRunPoints({ result, timeRemainingSec, revealsUsed })
    const durationUsed = info.durationSec - Math.max(0, timeRemainingSec)

    const description =
      result === 'solved'
        ? `✅ 해결! 남은 시간 ${Math.max(0, timeRemainingSec)}초, 점수 ${points}점`
        : result === 'partial'
        ? `🟡 부분 성공. 남은 시간 ${Math.max(0, timeRemainingSec)}초`
        : '❌ 실패'

    void sendDiscord(
      `🏁 실랜디 종료: **${info.handle}** — #${info.problemId} (${result})\n소요 ${durationUsed}초, 남은 ${Math.max(
        0,
        timeRemainingSec,
      )}초, 힌트 ${Math.max(0, revealsUsed)}회\n${description}`,
      undefined,
      webhookOverride || info.webhookOverride || undefined,
    )

    return res.json({ ok: true, points })
  } catch (error) {
    const message = error instanceof Error ? error.message : '기록 업데이트에 실패했습니다.'
    return res.status(400).json({ error: message })
  }
})

router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const endedAt = Number.parseInt(String(req.body?.endedAt ?? Date.now()), 10)
    if (!Number.isInteger(endedAt) || endedAt <= 0) {
      throw new Error('endedAt이 유효하지 않습니다.')
    }
    const revealsUsed = Number.parseInt(String(req.body?.revealsUsed ?? 0), 10)
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : null
    const webhookOverride = typeof req.body?.webhookOverride === 'string' ? req.body.webhookOverride : null

    const info = db
      .prepare('SELECT handle, problemId, tier, durationSec, startedAt, webhookOverride FROM runs WHERE id = ?')
      .get(id) as {
        handle: string
        problemId: number
        tier?: string | null
        durationSec: number
        startedAt: number
        webhookOverride?: string | null
      } | undefined

    if (!info) {
      return res.status(404).json({ error: '존재하지 않는 기록입니다.' })
    }

    const progress = await fetchUserProblemProgress({ handle: info.handle, problemId: info.problemId })

    const result: RunResult = progress.solved ? 'solved' : progress.tried ? 'partial' : 'failed'
    const safeReveals = Math.max(0, revealsUsed)
    const elapsedSec = Math.max(0, Math.floor((endedAt - info.startedAt) / 1000))
    const timeRemainingSec = Math.max(0, info.durationSec - elapsedSec)
    const durationUsed = info.durationSec - timeRemainingSec

    db.prepare(
      `UPDATE runs
       SET endedAt = ?, result = ?, timeRemainingSec = ?, revealsUsed = ?, notes = ?, webhookOverride = COALESCE(?, webhookOverride)
       WHERE id = ?`,
    ).run(endedAt, result, timeRemainingSec, safeReveals, notes, webhookOverride, id)

    const points = calculateRunPoints({ result, timeRemainingSec, revealsUsed: safeReveals })

    const progressSummary = progress.solved
      ? 'solved.ac에서 해결 기록을 확인했습니다.'
      : progress.tried
      ? 'solved.ac에서 시도 기록을 확인했습니다.'
      : 'solved.ac 제출 기록이 없습니다.'

    const description =
      result === 'solved'
        ? `✅ 해결! 남은 시간 ${timeRemainingSec}초, 점수 ${points}점`
        : result === 'partial'
        ? `부분 성공. 남은 시간 ${timeRemainingSec}초`
        : '❌ 실패'

    void sendDiscord(
      `🏁 실랜디 자동 기록: **${info.handle}** — #${info.problemId} (${result})\n소요 ${durationUsed}초, 남은 ${timeRemainingSec}초, 힌트 ${safeReveals}회\n${progressSummary}\n${description}`,
      undefined,
      webhookOverride || info.webhookOverride || undefined,
    )

    return res.json({ ok: true, result, solved: progress.solved, tried: progress.tried, points, timeRemainingSec })
  } catch (error) {
    const message = error instanceof Error ? error.message : '기록 동기화에 실패했습니다.'
    return res.status(400).json({ error: message })
  }
})

router.post('/:id/events', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const type = typeof req.body?.type === 'string' ? req.body.type : 'info'
    const payload = typeof req.body?.payload === 'string' ? req.body.payload : null
    const webhookOverride = typeof req.body?.webhookOverride === 'string' ? req.body.webhookOverride : null

    const info = db
      .prepare('SELECT handle, problemId, webhookOverride FROM runs WHERE id = ?')
      .get(id) as { handle: string; problemId: number; webhookOverride?: string | null } | undefined
    if (!info) {
      return res.status(404).json({ error: '존재하지 않는 기록입니다.' })
    }

    const override = webhookOverride || info.webhookOverride || undefined
    if (type === 'warning') {
      void sendDiscord(`⚠️ 5분 남았습니다: **${info.handle}** — #${info.problemId}`, undefined, override)
    } else if (type === 'timeout') {
      void sendDiscord(`⏰ 타임업! **${info.handle}** — #${info.problemId}`, undefined, override)
    } else if (type === 'note' && payload) {
      void sendDiscord(`📝 ${info.handle} 기록 메모 — #${info.problemId}: ${payload}`, undefined, override)
    }

    return res.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : '이벤트 처리에 실패했습니다.'
    return res.status(400).json({ error: message })
  }
})

router.get('/', (req: Request, res: Response) => {
  const handle = typeof req.query.handle === 'string' ? req.query.handle.trim() : ''
  const limitRaw = Number.parseInt(String(req.query.limit ?? '50'), 10)
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50

  try {
    const rows = db
      .prepare(
        `SELECT id, handle, problemId, tier, startedAt, endedAt, durationSec, result, timeRemainingSec, revealsUsed, notes
         FROM runs
         WHERE (? = '' OR handle = ?)
         ORDER BY startedAt DESC
         LIMIT ?`,
      )
      .all(handle, handle, limit)

    res.json({ runs: rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : '기록 조회에 실패했습니다.'
    res.status(500).json({ error: message })
  }
})

export default router
