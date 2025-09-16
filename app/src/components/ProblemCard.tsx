import { useRunStore } from '../store/run'
import { useSettingsStore } from '../store/settings'
import type { Problem } from 'shared/types'

interface ProblemCardProps {
  problem: (Problem & {
    titleEn?: string
    tier?: string
    tags?: string[]
    acceptedUserCount?: number
    averageTries?: number
    isSolvable?: boolean
    isPartial?: boolean
  }) | null
  onOpenBaekjoon: () => void
  onFetchNew: () => void
  loading: boolean
  statusMessages: string[]
  error?: string | null
  querySummary?: string
}

const numberFormat = new Intl.NumberFormat('ko-KR')

export function ProblemCard({
  problem,
  onOpenBaekjoon,
  onFetchNew,
  loading,
  statusMessages,
  error,
  querySummary,
}: ProblemCardProps) {
  const { spoiler, setSpoilerVisibility, incrementReveals, autoRevealedAt } = useRunStore((state) => ({
    spoiler: state.spoiler,
    setSpoilerVisibility: state.setSpoilerVisibility,
    incrementReveals: state.incrementReveals,
    autoRevealedAt: state.autoRevealedAt,
  }))
  const hideMeta = useSettingsStore((state) => state.settings.hideMeta)

  const tierVisible = !hideMeta.tier || spoiler.tier
  const tagsVisible = !hideMeta.tags || spoiler.tags
  const algorithmsVisible = !hideMeta.algorithms || spoiler.algorithms

  const reveal = (key: 'tier' | 'tags' | 'algorithms') => {
    if (spoiler[key]) return
    setSpoilerVisibility(key, true)
    incrementReveals()
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">추천 문제</h2>
        {querySummary && <span className="text-xs text-slate-500 dark:text-slate-400">{querySummary}</span>}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/40 dark:text-rose-100">
          {error}
        </div>
      )}

      {statusMessages.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 rounded-lg bg-slate-100/80 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          {statusMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {problem ? (
        <div className="mt-5 space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{problem.titleKo}</h3>
            {problem.titleEn && <p className="text-sm text-slate-500 dark:text-slate-400">{problem.titleEn}</p>}
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
            {tierVisible ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                {problem.tier ?? '등급 정보 없음'}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => reveal('tier')}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-400 px-3 py-1 text-xs font-medium text-slate-500 hover:border-slate-500 hover:text-slate-600 dark:border-slate-600 dark:text-slate-400"
              >
                티어 보기
              </button>
            )}
            {typeof problem.acceptedUserCount === 'number' && (
              <span>푼 사람 수: {numberFormat.format(problem.acceptedUserCount)}명</span>
            )}
            {typeof problem.averageTries === 'number' && <span>평균 제출: {problem.averageTries.toFixed(2)}회</span>}
            {problem.isPartial && <span className="text-amber-600 dark:text-amber-300">부분 점수</span>}
            {problem.isSolvable === false && <span className="text-amber-600 dark:text-amber-300">채점 불가</span>}
          </div>

          <div className="space-y-3">
            <SpoilerSection
              visible={tagsVisible}
              label="태그"
              onReveal={() => reveal('tags')}
              tags={problem.tags ?? []}
            />
            <SpoilerSection
              visible={algorithmsVisible}
              label="알고리즘"
              onReveal={() => reveal('algorithms')}
              tags={problem.tags ?? []}
            />
            {autoRevealedAt && (
              <p className="text-xs text-emerald-600 dark:text-emerald-300">
                15분 경과로 태그 힌트가 자동으로 공개되었습니다.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onOpenBaekjoon}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              백준에서 풀기
            </button>
            <button
              type="button"
              onClick={onFetchNew}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-400 px-4 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-500/60 dark:text-brand-200 dark:hover:bg-brand-500/10"
            >
              {loading ? '불러오는 중...' : '다시 뽑기'}
            </button>
            <a
              href={problem.bojUrl.replace('acmicpc.net', 'solved.ac/problems')}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              solved.ac 상세 보기
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white/40 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          아직 추천된 문제가 없어요. “문제 뽑기” 버튼을 눌러 시작해 보세요!
        </div>
      )}
    </div>
  )
}

interface SpoilerProps {
  visible: boolean
  label: string
  onReveal: () => void
  tags: string[]
}

function SpoilerSection({ visible, label, onReveal, tags }: SpoilerProps) {
  if (!tags.length) {
    return null
  }

  if (visible) {
    return (
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={`${label}-${tag}`}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onReveal}
      className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-400 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-500 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-slate-600 dark:text-slate-400"
    >
      {label} 힌트 보기
    </button>
  )
}
