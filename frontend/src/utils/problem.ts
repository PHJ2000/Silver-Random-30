import type { SolvedProblem, SolvedProblemTag } from '../types/solved'
import { levelToTier } from './solvedTier'

export interface ProblemSummary {
  problemId: number
  titleKo: string
  titleEn?: string
  level: number
  tier: string
  tags: string[]
  acceptedUserCount: number
  averageTries: number
  isPartial: boolean
  isSolvable: boolean
  bojUrl: string
  solvedAcUrl: string
}

function getPreferredTagName(tag: SolvedProblemTag): string {
  const korean = tag.displayNames.find((display) => display.language === 'ko')
  if (korean) {
    return korean.name
  }

  const english = tag.displayNames.find((display) => display.language === 'en')
  if (english) {
    return english.name
  }

  return tag.key
}

function getEnglishTitle(problem: SolvedProblem): string | undefined {
  if (!problem.titles) {
    return undefined
  }

  const english = problem.titles.find((title) => title.language === 'en')
  return english?.title
}

export function mapSolvedProblem(problem: SolvedProblem): ProblemSummary {
  return {
    problemId: problem.problemId,
    titleKo: problem.titleKo,
    titleEn: getEnglishTitle(problem),
    level: problem.level,
    tier: levelToTier(problem.level),
    tags: problem.tags.map(getPreferredTagName),
    acceptedUserCount: problem.acceptedUserCount,
    averageTries: problem.averageTries,
    isPartial: problem.isPartial,
    isSolvable: problem.isSolvable,
    bojUrl: `https://www.acmicpc.net/problem/${problem.problemId}`,
    solvedAcUrl: `https://solved.ac/problems/${problem.problemId}`,
  }
}
