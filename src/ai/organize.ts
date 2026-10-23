import { POMODORO_WORK_MINUTES } from '../lib/focusEstimate'
import type { AiTaskSuggestion, Priority } from './types'

const STOP = new Set([
  'that', 'this', 'with', 'from', 'have', 'need', 'want', 'will', 'just', 'like',
  'maybe', 'about', 'around', 'right', 'now', 'then', 'than', 'them', 'they',
  'their', 'there', 'what', 'when', 'where', 'which', 'while', 'would', 'could',
  'should', 'into', 'onto', 'your', 'you', 'the', 'and', 'for', 'are', 'was',
  'were', 'been', 'being', 'also', 'very', 'really', 'specific', 'properly',
  'finish', 'finished', 'create', 'bubble', 'bubbles', 'let', 'lets', 'me',
  'my', 'to', 'a', 'an', 'of', 'all',
])

const WELLNESS =
  /\b(stretch|drink water|hydrate|take a break|1-?minute break|move to a different chair|breathe|meditat|stand up|eye.?rest|posture)\b/i

const URGENT =
  /\b(today|tonight|now|asap|urgent|immediately|deadline|due|right now|this morning|this afternoon|eod|cob)\b/i
const IMPORTANT =
  /\b(project|exam|assignment|client|deadline|bill|pay|submit|ship|release|interview|meeting|presentation|thesis|paper|capstone|test|testing|app|build|code|work)\b/i

const META_PREFIX =
  /^(?:ok(?:ay)?[,.]?\s*|please\s+|hey[,.]?\s*)?(?:let'?s\s+)?(?:create\s+(?:a\s+)?bubble\s+for\s+me(?:\s+to)?\s+|make\s+(?:a\s+)?bubble\s+(?:for\s+me\s+)?(?:to\s+)?|i\s+(?:need|have|want)\s+to\s+|i'?m\s+going\s+to\s+|can\s+you\s+(?:help\s+me\s+)?(?:to\s+)?)/i

export function inferPriority(text: string): Priority {
  const u = URGENT.test(text)
  const i = IMPORTANT.test(text)
  if (u && i) return 'UI'
  if (u && !i) return 'UNI'
  if (!u && i) return 'NUI'
  return 'NUNI'
}

export function extractStatedMinutes(message: string): number | null {
  const m =
    message.match(
      /\b(?:for|around|about|maybe(?:\s+around)?)\s+(\d{1,2})\s*(?:minutes?|mins?|m)\b/i,
    ) || message.match(/\b(\d{1,2})\s*(?:minutes?|mins?)\b/i)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 1) return null
  // Stated durations no longer change work length — always pomodoro.
  return POMODORO_WORK_MINUTES
}

function meaningfulTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
}

function titleCaseFirst(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function clampTitle(s: string, max = 42): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

/** Remove chat / “create a bubble” scaffolding so we keep the real intent. */
export function stripMetaPhrasing(message: string): string {
  let s = message.trim().replace(/\s+/g, ' ')
  // Repeat a few times for stacked fluff
  for (let i = 0; i < 3; i++) {
    const next = s.replace(META_PREFIX, '')
    if (next === s) break
    s = next
  }
  s = s.replace(/\bcreate\s+(?:a\s+)?bubble\s+for\s+me(?:\s+to)?\b/gi, '')
  s = s.replace(/\b(?:a\s+)?bubble\s+for\s+me(?:\s+to)?\b/gi, '')
  return s.trim().replace(/^[,.\s]+/, '')
}

/**
 * If the user listed concrete remaining items ("tasks are A, B, and C"),
 * return those items — this is the best low-load breakdown.
 */
export function extractListedItems(message: string): string[] {
  const s = message.trim().replace(/\s+/g, ' ')

  const listHost =
    s.match(
      /(?:remaining\s+tasks?\s+are|tasks?\s+are|steps?\s+are|including|which\s+are)\s*:?\s*(.+)$/i,
    ) || s.match(/:\s*([^.!?]+(?:,| and ).+)$/i)

  if (!listHost?.[1]) return []

  let body = listHost[1].trim()
  // Drop leading "to " once
  body = body.replace(/^to\s+/i, '')

  const parts = body
    .split(/\s*,\s*(?:and\s+)?/i)
    .map((p) => p.trim().replace(/^to\s+/i, '').replace(/[.]+$/, ''))
    .filter((p) => p.length > 2 && !/^and$/i.test(p))

  // Need at least 2 real items to treat as an explicit list
  if (parts.length < 2) return []
  return parts.slice(0, 6).map((p) => titleCaseFirst(clampTitle(p, 48)))
}

/** Short, scannable title — cognitive-load friendly. */
export function distillTitle(message: string): string {
  const raw = stripMetaPhrasing(message)

  // Intent shortcuts
  if (/\bcapstone\b/i.test(raw)) {
    if (/remaining|edge cases|improve ui|testing/i.test(raw)) return 'Capstone remaining work'
    return 'Capstone work'
  }

  if (/\bbinge\b/i.test(raw) && /spider-?man/i.test(raw)) {
    return 'Binge Tom Holland Spider-Man'
  }

  if (/\b(watch|binge)\b/i.test(raw) && /\bmovies?\b/i.test(raw)) {
    const who = raw.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/)
    if (/tom holland/i.test(raw)) return 'Binge Tom Holland movies'
    if (who) return clampTitle(`Watch ${who[1]} movies`, 42)
    return 'Movie binge'
  }

  if (/\btest(?:ing)?\b/i.test(raw) && /\bbubbles\b/i.test(raw)) return 'Test Bubbles'
  if (/\btest(?:ing)?\b/i.test(raw) && /\b(web|mobile)?\s*apps?\b/i.test(raw)) {
    return 'Test apps'
  }

  // Sentence before list / second sentence often has the goal
  let s = raw.split(/(?<=[.!?])\s+/)[0] || raw
  s = s.replace(
    /,?\s*(?:for\s+)?(?:maybe\s+)?(?:around\s+|about\s+)?\d{1,2}\s*(?:minutes?|mins?|m)\b.*$/i,
    '',
  )
  s = s.replace(/\bright now\.?$/i, '')
  s = s.replace(/\bto prepare for\b.+$/i, '')
  s = s.replace(/\bthe remaining tasks\b.+$/i, '')
  s = s.replace(/\bcomplete my remaining tasks for my\b/i, '')
  s = s.replace(/\bmy remaining tasks for\b/i, '')
  s = s.replace(/\bfor my\b/i, '')

  // Keep first ~6 content words when still long
  const words = s.split(/\s+/).filter(Boolean)
  if (words.length > 7) {
    s = words.slice(0, 6).join(' ')
  }

  s = s.replace(/\s+/g, ' ').trim().replace(/[,:]+$/, '')
  return titleCaseFirst(clampTitle(s, 42)) || 'Focus session'
}

function fallbackMicroSteps(title: string, minutes: number): string[] {
  if (minutes <= 5) return []
  if (/\bbinge|watch|movie/i.test(title)) {
    return ['Start the next film', 'Stay with it — no extra tabs']
  }
  return [`Start: ${title}`]
}

/**
 * Organize the user's message into one clear parent + their real next steps.
 */
export function organizeFromPrompt(message: string): AiTaskSuggestion[] {
  const text = message.trim()
  if (!text) return []

  // Newline lists → each line is its own top-level bubble (rare, still simple)
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean)

  if (lines.length > 1 && lines.every((l) => l.length < 80)) {
    return lines.slice(0, 6).map((line) => ({
      title: distillTitle(line),
      priority: inferPriority(line),
      estimatedMinutes: POMODORO_WORK_MINUTES,
      subtasks: [],
    }))
  }

  const listed = extractListedItems(text)
  const title = distillTitle(text)

  return [
    {
      title,
      priority: inferPriority(text),
      estimatedMinutes: POMODORO_WORK_MINUTES,
      subtasks: listed.length > 0 ? listed : fallbackMicroSteps(title, POMODORO_WORK_MINUTES),
    },
  ]
}

/** Polish model output: short titles, prefer user's listed items, drop fluff. */
export function polishTasks(message: string, tasks: AiTaskSuggestion[]): AiTaskSuggestion[] {
  const listed = extractListedItems(message)

  if (tasks.length === 0) return organizeFromPrompt(message)

  if (tasks.length === 1 || listed.length > 0) {
    const primary = tasks[0]
    const title = distillTitle(message)
    const subtasks =
      listed.length > 0
        ? listed
        : (primary.subtasks ?? [])
            .map((s) => titleCaseFirst(clampTitle(stripMetaPhrasing(s), 48)))
            .filter(
              (s) =>
                s.length > 2 &&
                !WELLNESS.test(s) &&
                !/^start:/i.test(s) &&
                !/^open the flow/i.test(s) &&
                !/^run through it once/i.test(s) &&
                !/^confirm the main path/i.test(s),
            )

    const cleanedSubs =
      subtasks.length > 0
        ? subtasks.slice(0, 6)
        : fallbackMicroSteps(title, POMODORO_WORK_MINUTES)

    return [
      {
        title,
        priority: primary.priority ?? inferPriority(message),
        estimatedMinutes: POMODORO_WORK_MINUTES,
        subtasks: cleanedSubs,
      },
    ]
  }

  return tasks.map((t) => ({
    ...t,
    title: distillTitle(t.title),
    estimatedMinutes: POMODORO_WORK_MINUTES,
    subtasks: (t.subtasks ?? [])
      .map((s) => titleCaseFirst(clampTitle(stripMetaPhrasing(s), 48)))
      .filter((s) => !WELLNESS.test(s))
      .slice(0, 5),
  }))
}

export function isUngrounded(message: string, tasks: AiTaskSuggestion[]): boolean {
  if (tasks.length === 0) return false

  const msg = message.toLowerCase()
  const userAskedWellness = WELLNESS.test(msg)

  const wellnessHeavy = tasks.filter(
    (t) => WELLNESS.test(t.title) || t.subtasks.some((s) => WELLNESS.test(s)),
  )
  if (!userAskedWellness && wellnessHeavy.length >= Math.ceil(tasks.length * 0.5)) {
    return true
  }

  // Titles still full of chat scaffolding → treat as bad
  if (tasks.some((t) => /let'?s create a bubble|create a bubble for me/i.test(t.title))) {
    return true
  }

  // Generic template subtasks when user gave a real list
  const listed = extractListedItems(message)
  if (listed.length >= 2) {
    const joined = tasks.flatMap((t) => t.subtasks).join(' ').toLowerCase()
    const hits = listed.filter((item) =>
      meaningfulTokens(item).some((tok) => joined.includes(tok)),
    )
    if (hits.length === 0) return true
  }

  const tokens = meaningfulTokens(message)
  if (tokens.length === 0) return false

  const groundedCount = tasks.filter((t) => {
    const blob = `${t.title} ${t.subtasks.join(' ')}`.toLowerCase()
    return tokens.some((tok) => blob.includes(tok))
  }).length

  return groundedCount === 0
}

export function coerceGroundedTasks(
  message: string,
  tasks: AiTaskSuggestion[],
): AiTaskSuggestion[] {
  if (isUngrounded(message, tasks)) {
    return organizeFromPrompt(message)
  }
  return polishTasks(message, tasks)
}
