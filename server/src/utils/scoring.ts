export function calculateRunPoints(params: {
  result: string
  timeRemainingSec?: number
  revealsUsed?: number
}): number {
  if (params.result !== 'solved') {
    return 0
  }

  const remaining = Math.max(0, Math.round((params.timeRemainingSec ?? 0) / 60))
  const bonus = Math.min(5, remaining)
  let points = 10 + bonus
  if ((params.revealsUsed ?? 0) > 0) {
    points = Math.max(0, points - 2)
  }
  return points
}
