export type TagMode = 'any' | 'all'

export interface QuerySettings {
  handle: string
  excludeSolved: boolean
  excludeTried: boolean
  language: 'any' | 'ko'
  includeTags: string[]
  excludeTags: string[]
  includeTagMode: TagMode
}

const allowedLanguages = new Set<QuerySettings['language']>(['any', 'ko'])

function normalizeTag(tag: string): string {
  return tag.replace(/^#/, '').trim().toLowerCase()
}

export function parseTagsInput(raw: string): string[] {
  if (!raw) {
    return []
  }

  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map(normalizeTag)
        .filter(Boolean),
    ),
  )
}

export function normalizeQuerySettings(settings: QuerySettings): QuerySettings {
  const handle = settings.handle.trim()
  const includeTagMode: TagMode = settings.includeTagMode === 'all' ? 'all' : 'any'
  const language = allowedLanguages.has(settings.language) ? settings.language : 'any'

  return {
    handle,
    excludeSolved: Boolean(settings.excludeSolved) && !!handle,
    excludeTried: Boolean(settings.excludeTried) && !!handle,
    language,
    includeTagMode,
    includeTags: settings.includeTags.map(normalizeTag).filter(Boolean),
    excludeTags: settings.excludeTags.map(normalizeTag).filter(Boolean),
  }
}

export function buildSearchQuery(settings: QuerySettings): string {
  const tokens: string[] = ['*s']

  if (settings.language === 'ko') {
    tokens.push('%ko')
  }

  if (settings.handle) {
    if (settings.excludeSolved) {
      tokens.push(`-@${settings.handle}`)
    }
    if (settings.excludeTried) {
      tokens.push(`-t@${settings.handle}`)
    }
  }

  if (settings.includeTags.length > 0) {
    const tagTokens = settings.includeTags.map((tag) => `#${tag}`)
    if (settings.includeTagMode === 'all' || tagTokens.length === 1) {
      tokens.push(tagTokens.join(' '))
    } else {
      tokens.push(`(${tagTokens.join(' | ')})`)
    }
  }

  if (settings.excludeTags.length > 0) {
    settings.excludeTags.forEach((tag) => {
      tokens.push(`-#${tag}`)
    })
  }

  return tokens.join(' ')
}
