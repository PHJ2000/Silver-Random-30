import type { Problem } from '../../../shared/types.js'

const SOLVED_ENDPOINT = 'https://solved.ac/api/v3/search/problem'
const PAGE_SIZE = 100

interface SearchResponse {
  count: number
  items: SolvedAcProblem[]
}

interface SolvedAcProblem {
  problemId: number
  titleKo: string
  titles?: Array<{ language: string; title: string }>
  tags?: Array<{
    key: string
    displayNames?: Array<{ language: string; name: string }>
  }>
  level: number
  isSolvable: boolean
  isPartial: boolean
  acceptedUserCount: number
  averageTries: number
}

const tierNames = [
  'Unrated',
  'Bronze V',
  'Bronze IV',
  'Bronze III',
  'Bronze II',
  'Bronze I',
  'Silver V',
  'Silver IV',
  'Silver III',
  'Silver II',
  'Silver I',
  'Gold V',
  'Gold IV',
  'Gold III',
  'Gold II',
  'Gold I',
  'Platinum V',
  'Platinum IV',
  'Platinum III',
  'Platinum II',
  'Platinum I',
  'Diamond V',
  'Diamond IV',
  'Diamond III',
  'Diamond II',
  'Diamond I',
  'Ruby V',
  'Ruby IV',
  'Ruby III',
  'Ruby II',
  'Ruby I',
]

function tierFromLevel(level: number | null | undefined): string | undefined {
  if (typeof level !== 'number' || level <= 0 || level >= tierNames.length) {
    return undefined
  }
  return tierNames[level]
}

function pickTitle(titles: SolvedAcProblem['titles']): string | undefined {
  if (!Array.isArray(titles)) {
    return undefined
  }
  return titles.find((title) => title.language === 'en')?.title ?? titles[0]?.title
}

function pickTags(tags: SolvedAcProblem['tags']): string[] {
  if (!Array.isArray(tags)) {
    return []
  }
  return tags.map((tag) => {
    const display = tag.displayNames?.find((entry) => entry.language === 'ko')
      ?? tag.displayNames?.find((entry) => entry.language === 'en')
    return display?.name ?? tag.key
  })
}

async function fetchSearch(query: string, page: number, size: number, signal?: AbortSignal): Promise<SearchResponse> {
  const params = new URLSearchParams({ query, page: String(page), size: String(size) })
  const response = await fetch(`${SOLVED_ENDPOINT}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`solved.ac 요청 실패: ${response.status} ${response.statusText} - ${body}`)
  }

  const data = (await response.json()) as SearchResponse
  return data
}

export interface SampleProblemOptions {
  query: string
  avoidProblemIds?: number[]
  signal?: AbortSignal
}

export interface SampleProblemResult {
  problem: Problem & {
    titleEn?: string
    acceptedUserCount?: number
    averageTries?: number
    isSolvable?: boolean
    isPartial?: boolean
  }
  index: number
  totalCount: number
  page: number
}

export async function sampleRandomProblem({
  query,
  avoidProblemIds = [],
  signal,
}: SampleProblemOptions): Promise<SampleProblemResult> {
  const countResponse = await fetchSearch(query, 1, 1, signal)
  const total = countResponse.count
  if (!total || total <= 0) {
    throw new Error('조건에 맞는 문제가 없습니다.')
  }

  const maxAttempts = 10
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const pick = 1 + Math.floor(Math.random() * total)
    const page = Math.ceil(pick / PAGE_SIZE)
    const pageItems =
      page === 1 && countResponse.items.length === 1
        ? countResponse.items
        : (await fetchSearch(query, page, PAGE_SIZE, signal)).items

    if (!Array.isArray(pageItems) || pageItems.length === 0) {
      continue
    }
    const index = (pick - 1) % PAGE_SIZE
    const candidate = pageItems[index]
    if (!candidate) {
      continue
    }
    if (avoidProblemIds.includes(candidate.problemId) && attempt < maxAttempts - 1) {
      continue
    }

    const problem: SampleProblemResult['problem'] = {
      problemId: candidate.problemId,
      titleKo: candidate.titleKo,
      titleEn: pickTitle(candidate.titles),
      tier: tierFromLevel(candidate.level),
      tags: pickTags(candidate.tags),
      solvedCount: candidate.acceptedUserCount,
      bojUrl: `https://www.acmicpc.net/problem/${candidate.problemId}`,
      acceptedUserCount: candidate.acceptedUserCount,
      averageTries: candidate.averageTries,
      isSolvable: candidate.isSolvable,
      isPartial: candidate.isPartial,
    }

    return { problem, index, totalCount: total, page }
  }

  throw new Error('조건에 맞는 문제를 찾지 못했습니다.')
}

export interface BuildQueryOptions {
  query?: string
  handle?: string
  excludeSolved?: boolean
  excludeTried?: boolean
  language?: string
  includeTags?: string[]
  excludeTags?: string[]
}

export function buildSolvedAcQuery(options: BuildQueryOptions): string {
  const tokens = options.query?.trim() ? [options.query.trim()] : ['*s']
  const handle = options.handle?.trim()
  if (handle) {
    if (options.excludeSolved) {
      tokens.push(`-@${handle}`)
    }
    if (options.excludeTried) {
      tokens.push(`-t@${handle}`)
    }
  }
  if (options.language === 'ko') {
    tokens.push('%ko')
  }
  if (options.includeTags?.length) {
    options.includeTags.forEach((tag) => tokens.push(`#${tag}`))
  }
  if (options.excludeTags?.length) {
    options.excludeTags.forEach((tag) => tokens.push(`-#${tag}`))
  }
  return tokens.join(' ')
}
