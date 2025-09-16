export interface SolvedProblemTagDisplayName {
  language: string
  name: string
  short: string
}

export interface SolvedProblemTag {
  key: string
  isMeta: boolean
  bojTagId: number
  displayNames: SolvedProblemTagDisplayName[]
}

export interface SolvedProblemTitle {
  title: string
  language: string
  isOriginal: boolean
  languageDisplayName: string
}

export interface SolvedProblem {
  problemId: number
  titleKo: string
  level: number
  acceptedUserCount: number
  averageTries: number
  isPartial: boolean
  isSolvable: boolean
  tags: SolvedProblemTag[]
  titles?: SolvedProblemTitle[]
  metadata?: Record<string, unknown>
  votedUserCount?: number
}

export interface SolvedSearchResponse {
  count: number
  items: SolvedProblem[]
}
