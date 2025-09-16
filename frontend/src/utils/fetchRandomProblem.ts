import { mapSolvedProblem, type ProblemSummary } from './problem'
import type { QuerySettings } from './query'
import { buildSearchQuery } from './query'
import type { SolvedProblem, SolvedSearchResponse } from '../types/solved'

const SOLVED_SEARCH_ENDPOINT = 'https://solved.ac/api/v3/search/problem'
const PAGE_SIZE = 100
const MAX_ATTEMPTS = 6
const RETRIABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const BASE_DELAY = 500

export interface FetchRandomOptions {
  settings: QuerySettings
  avoidProblemIds: number[]
  signal?: AbortSignal
}

export interface FetchRandomResult {
  problem: ProblemSummary
  query: string
  usedSettings: QuerySettings
  totalCount: number
}

export interface FetchWithRelaxationsOptions extends FetchRandomOptions {
  relaxationMessages?: string[]
}

export interface FetchWithRelaxationsResult extends FetchRandomResult {
  adjustments: string[]
}

export async function fetchRandomProblemWithRelaxations(
  options: FetchRandomOptions,
): Promise<FetchWithRelaxationsResult> {
  const adjustments: string[] = []
  let currentSettings = { ...options.settings }

  const steps: Array<{
    mutate: (settings: QuerySettings) => QuerySettings
    message?: string
  }> = [
    { mutate: (settings) => ({ ...settings }) },
    {
      mutate: (settings) => ({
        ...settings,
        includeTags: [],
        excludeTags: [],
      }),
      message: '태그 필터를 잠시 해제했어요.',
    },
    {
      mutate: (settings) => ({
        ...settings,
        excludeTried: false,
      }),
      message: '시도 문제 제외 옵션을 해제했어요.',
    },
    {
      mutate: (settings) => ({
        ...settings,
        language: 'any',
      }),
      message: '언어 제한을 해제했어요.',
    },
  ]

  for (let index = 0; index < steps.length; index += 1) {
    if (index > 0) {
      const { mutate, message } = steps[index]
      currentSettings = mutate(currentSettings)
      if (message) {
        adjustments.push(message)
      }
    }

    const result = await fetchRandomProblem({
      ...options,
      settings: currentSettings,
    })

    if (result) {
      return {
        ...result,
        adjustments,
      }
    }
  }

  throw new Error('필터를 완화했지만 검색 결과를 찾지 못했어요.')
}

async function fetchRandomProblem(options: FetchRandomOptions): Promise<FetchRandomResult | null> {
  const query = buildSearchQuery(options.settings)
  const avoidSet = new Set(options.avoidProblemIds)

  const countResponse = await fetchWithRetry(
    `${SOLVED_SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&size=1&page=1`,
    { signal: options.signal },
  )
  const countData = (await countResponse.json()) as SolvedSearchResponse

  if (!countData.count) {
    return null
  }

  const total = countData.count
  const attempts = Math.min(MAX_ATTEMPTS, total)

  let fallbackProblem: SolvedProblem | null = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const randomIndex = Math.floor(Math.random() * total)
    const page = Math.floor(randomIndex / PAGE_SIZE) + 1
    const index = randomIndex % PAGE_SIZE

    const pageResponse = await fetchWithRetry(
      `${SOLVED_SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&size=${PAGE_SIZE}&page=${page}`,
      { signal: options.signal },
    )
    const pageData = (await pageResponse.json()) as SolvedSearchResponse

    if (!pageData.items.length) {
      continue
    }

    const candidate = pickCandidate(pageData.items, index, avoidSet)

    if (candidate && !avoidSet.has(candidate.problemId)) {
      return {
        problem: mapSolvedProblem(candidate),
        query,
        usedSettings: options.settings,
        totalCount: total,
      }
    }

    fallbackProblem = fallbackProblem ?? candidate ?? pageData.items[0]
  }

  if (fallbackProblem) {
    return {
      problem: mapSolvedProblem(fallbackProblem),
      query,
      usedSettings: options.settings,
      totalCount: total,
    }
  }

  return null
}

function pickCandidate(items: SolvedProblem[], index: number, avoid: Set<number>): SolvedProblem | null {
  if (!items.length) {
    return null
  }

  const candidate = items[index] ?? items[items.length - 1]
  if (candidate && !avoid.has(candidate.problemId)) {
    return candidate
  }

  const filtered = items.filter((item) => !avoid.has(item.problemId))
  if (filtered.length) {
    const randomIndex = Math.floor(Math.random() * filtered.length)
    return filtered[randomIndex]
  }

  return candidate
}

async function fetchWithRetry(url: string, options: RequestInit & { signal?: AbortSignal }, attempt = 0): Promise<Response> {
  try {
    const response = await fetch(url, options)
    if (response.ok) {
      return response
    }

    if (RETRIABLE_STATUS.has(response.status) && attempt < 3) {
      const retryAfter = response.headers.get('Retry-After')
      const retryDelay = retryAfter ? Number(retryAfter) * 1000 : BASE_DELAY * 2 ** attempt
      await delay(retryDelay)
      return fetchWithRetry(url, options, attempt + 1)
    }

    const errorText = await safeReadText(response)
    throw new Error(`solved.ac API 오류(${response.status}): ${errorText}`)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    if (attempt < 3) {
      await delay(BASE_DELAY * 2 ** attempt)
      return fetchWithRetry(url, options, attempt + 1)
    }

    throw error
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch (error) {
    console.warn('Failed to read response body', error)
    return 'no details'
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
