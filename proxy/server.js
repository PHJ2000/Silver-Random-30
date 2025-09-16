const express = require('express')
const cors = require('cors')
const morgan = require('morgan')

const SOLVED_ENDPOINT = 'https://solved.ac/api/v3/search/problem'
const PAGE_SIZE = 100
const MAX_ATTEMPTS = 6
const CACHE_TTL = 60 * 1000
const RETRIABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

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

const cache = new Map()

const app = express()
app.use(cors())
app.use(morgan('dev'))

function parseTags(raw) {
  if (!raw) {
    return []
  }
  return Array.from(
    new Set(
      String(raw)
        .split(/[\s,]+/)
        .map((tag) => String(tag).replace(/^#/, '').trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

function parseRecentIds(raw) {
  if (!raw) {
    return []
  }
  return Array.from(
    new Set(
      String(raw)
        .split(/[\s,]+/)
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  )
}

function levelToTier(level) {
  if (!level || level < 0 || level >= tierNames.length) {
    return 'Unrated'
  }
  return tierNames[level]
}

function getPreferredTagName(tag) {
  if (Array.isArray(tag.displayNames)) {
    const korean = tag.displayNames.find((display) => display.language === 'ko')
    if (korean) {
      return korean.name
    }
    const english = tag.displayNames.find((display) => display.language === 'en')
    if (english) {
      return english.name
    }
  }
  return tag.key
}

function mapProblem(raw) {
  return {
    problemId: raw.problemId,
    titleKo: raw.titleKo,
    titleEn: Array.isArray(raw.titles)
      ? raw.titles.find((title) => title.language === 'en')?.title
      : undefined,
    level: raw.level,
    tier: levelToTier(raw.level),
    tags: Array.isArray(raw.tags) ? raw.tags.map(getPreferredTagName) : [],
    acceptedUserCount: raw.acceptedUserCount,
    averageTries: raw.averageTries,
    isPartial: raw.isPartial,
    isSolvable: raw.isSolvable,
    bojUrl: `https://www.acmicpc.net/problem/${raw.problemId}`,
    solvedAcUrl: `https://solved.ac/problems/${raw.problemId}`,
  }
}

function normalizeSettings(settings) {
  const handle = settings.handle.trim()
  return {
    handle,
    excludeSolved: Boolean(settings.excludeSolved) && handle.length > 0,
    excludeTried: Boolean(settings.excludeTried) && handle.length > 0,
    language: settings.language === 'ko' ? 'ko' : 'any',
    includeTags: settings.includeTags || [],
    excludeTags: settings.excludeTags || [],
    includeTagMode: settings.includeTagMode === 'all' ? 'all' : 'any',
  }
}

function buildQuery(settings) {
  const tokens = ['*s']
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
  if (settings.includeTags.length) {
    const tags = settings.includeTags.map((tag) => `#${tag}`)
    if (settings.includeTagMode === 'all' || tags.length === 1) {
      tokens.push(tags.join(' '))
    } else {
      tokens.push(`(${tags.join(' | ')})`)
    }
  }
  if (settings.excludeTags.length) {
    settings.excludeTags.forEach((tag) => tokens.push(`-#${tag}`))
  }
  return tokens.join(' ')
}

function getCacheEntry(query) {
  const existing = cache.get(query)
  if (!existing) {
    const entry = { timestamp: 0, count: null, pages: new Map() }
    cache.set(query, entry)
    return entry
  }
  if (Date.now() - existing.timestamp > CACHE_TTL) {
    existing.count = null
    existing.pages.clear()
  }
  return existing
}

async function getCount(query) {
  const entry = getCacheEntry(query)
  if (typeof entry.count === 'number') {
    entry.timestamp = Date.now()
    return entry.count
  }
  const data = await fetchSearch(query, 1, 1)
  entry.count = data.count
  entry.timestamp = Date.now()
  if (Array.isArray(data.items)) {
    entry.pages.set(1, { timestamp: Date.now(), items: data.items })
  }
  return data.count
}

async function getPage(query, page) {
  const entry = getCacheEntry(query)
  const cached = entry.pages.get(page)
  if (cached && Date.now() - cached.timestamp <= CACHE_TTL) {
    entry.timestamp = Date.now()
    return cached.items
  }
  const data = await fetchSearch(query, page, PAGE_SIZE)
  entry.pages.set(page, { timestamp: Date.now(), items: data.items })
  entry.timestamp = Date.now()
  if (typeof data.count === 'number') {
    entry.count = data.count
  }
  return data.items
}

async function fetchSearch(query, page, size) {
  const url = `${SOLVED_ENDPOINT}?query=${encodeURIComponent(query)}&size=${size}&page=${page}`
  const response = await fetchWithRetry(url)
  return response.json()
}

async function fetchWithRetry(url, attempt = 0) {
  try {
    const response = await fetch(url)
    if (response.ok) {
      return response
    }
    if (RETRIABLE_STATUS.has(response.status) && attempt < 3) {
      const retryAfter = response.headers.get('Retry-After')
      const delayMs = retryAfter ? Number(retryAfter) * 1000 : 500 * 2 ** attempt
      await delay(delayMs)
      return fetchWithRetry(url, attempt + 1)
    }
    const detail = await response.text()
    throw new Error(`solved.ac 응답 오류(${response.status}): ${detail}`)
  } catch (error) {
    if (attempt < 3) {
      await delay(500 * 2 ** attempt)
      return fetchWithRetry(url, attempt + 1)
    }
    throw error
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pickCandidate(items, index, avoidSet) {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }
  const candidate = items[index] || items[items.length - 1]
  if (candidate && !avoidSet.has(candidate.problemId)) {
    return candidate
  }
  const filtered = items.filter((item) => !avoidSet.has(item.problemId))
  if (filtered.length) {
    return filtered[Math.floor(Math.random() * filtered.length)]
  }
  return candidate
}

async function fetchRandomProblem(settings, avoidIds) {
  const query = buildQuery(settings)
  const totalCount = await getCount(query)
  if (!totalCount) {
    return null
  }

  const avoidSet = new Set(avoidIds)
  let fallback = null

  const attempts = Math.min(MAX_ATTEMPTS, totalCount)
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const randomIndex = Math.floor(Math.random() * totalCount)
    const page = Math.floor(randomIndex / PAGE_SIZE) + 1
    const index = randomIndex % PAGE_SIZE
    const items = await getPage(query, page)
    if (!items || !items.length) {
      continue
    }
    const candidate = pickCandidate(items, index, avoidSet)
    if (candidate && !avoidSet.has(candidate.problemId)) {
      return { problem: mapProblem(candidate), query, settings, totalCount }
    }
    if (!fallback) {
      fallback = candidate || items[0]
    }
  }

  if (fallback) {
    return { problem: mapProblem(fallback), query, settings, totalCount }
  }

  return null
}

const relaxations = [
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

app.get('/api/problems/random', async (req, res) => {
  try {
    const baseSettings = normalizeSettings({
      handle: String(req.query.handle || ''),
      excludeSolved: req.query.excludeSolved === 'true',
      excludeTried: req.query.excludeTried === 'true',
      language: req.query.language === 'ko' ? 'ko' : 'any',
      includeTags: parseTags(req.query.includeTags),
      excludeTags: parseTags(req.query.excludeTags),
      includeTagMode: req.query.includeTagMode === 'all' ? 'all' : 'any',
    })

    const avoidIds = parseRecentIds(req.query.recentIds)
    const messages = []
    let currentSettings = baseSettings

    for (let index = 0; index < relaxations.length; index += 1) {
      if (index > 0) {
        const { mutate, message } = relaxations[index]
        currentSettings = normalizeSettings(mutate(currentSettings))
        if (message) {
          messages.push(message)
        }
      }

      const result = await fetchRandomProblem(currentSettings, avoidIds)
      if (result) {
        return res.json({
          problem: result.problem,
          query: result.query,
          adjustments: messages,
          usedSettings: currentSettings,
          totalCount: result.totalCount,
        })
      }
    }

    res.status(404).json({ message: '조건에 맞는 문제를 찾지 못했습니다.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message || '서버 오류가 발생했습니다.' })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`)
})
