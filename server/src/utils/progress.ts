const SOLVED_AC_ENDPOINT = 'https://solved.ac/api/v3/search/problem'

async function fetchSolvedAcCount(query: string, init?: Parameters<typeof fetch>[1]): Promise<number> {
  const params = new URLSearchParams({ query, page: '1', size: '1' })
  const response = await fetch(`${SOLVED_AC_ENDPOINT}?${params.toString()}`, init)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`solved.ac 요청 실패: ${response.status} ${response.statusText} - ${detail}`)
  }
  const data = (await response.json()) as { count?: number }
  return typeof data.count === 'number' ? data.count : 0
}

export interface UserProblemProgressOptions {
  handle?: string | null
  problemId: number
}

export interface UserProblemProgress {
  solved: boolean
  tried: boolean
}

export async function fetchUserProblemProgress({
  handle,
  problemId,
}: UserProblemProgressOptions): Promise<UserProblemProgress> {
  const trimmedHandle = handle?.trim()
  if (!trimmedHandle) {
    return { solved: false, tried: false }
  }

  const baseQuery = `id:${problemId}`
  const headers: Parameters<typeof fetch>[1] = { headers: { Accept: 'application/json' } }

  try {
    const solvedCount = await fetchSolvedAcCount(`${baseQuery} @${trimmedHandle}`, headers)
    if (solvedCount > 0) {
      return { solved: true, tried: true }
    }
    const triedCount = await fetchSolvedAcCount(`${baseQuery} t@${trimmedHandle}`, headers)
    return { solved: false, tried: triedCount > 0 }
  } catch (error) {
    console.warn('solved.ac progress lookup failed', error)
    throw new Error('solved.ac 기록 조회에 실패했습니다.')
  }
}
