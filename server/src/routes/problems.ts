import type { Request, Response } from 'express'
import { Router } from 'express'
import { buildSolvedAcQuery, sampleRandomProblem } from '../utils/solvedAc.js'

const router = Router()

function parseBool(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return defaultValue
}

function parseTags(raw: unknown): string[] {
  if (typeof raw !== 'string') {
    return []
  }
  return Array.from(
    new Set(
      raw
        .split(/[,\s]+/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
  )
}

function parseRecentIds(raw: unknown): number[] {
  if (typeof raw !== 'string') {
    return []
  }
  return Array.from(
    new Set(
      raw
        .split(/[,\s]+/)
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  )
}

router.get('/random', async (req: Request, res: Response) => {
  const queryParam = typeof req.query.query === 'string' ? req.query.query : undefined
  const handle = typeof req.query.handle === 'string' ? req.query.handle : undefined
  const language = req.query.language === 'ko' ? 'ko' : undefined
  const includeTags = parseTags(req.query.includeTags)
  const excludeTags = parseTags(req.query.excludeTags)
  const excludeSolved = parseBool(req.query.excludeSolved, true)
  const excludeTried = parseBool(req.query.excludeTried, true)
  const avoidIds = parseRecentIds(req.query.recentIds)

  try {
    const query = buildSolvedAcQuery({
      query: queryParam,
      handle,
      excludeSolved,
      excludeTried,
      language,
      includeTags,
      excludeTags,
    })

    const result = await sampleRandomProblem({ query, avoidProblemIds: avoidIds })

    return res.json({
      problem: result.problem,
      totalCount: result.totalCount,
      query,
      page: result.page,
      index: result.index,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '문제를 불러오는 중 오류가 발생했습니다.'
    return res.status(500).json({ error: message })
  }
})

export default router
