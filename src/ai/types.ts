import { POMODORO_WORK_MINUTES } from '../lib/focusEstimate'
import { coerceGroundedTasks, organizeFromPrompt } from './organize'

export type Priority = 'UI' | 'UNI' | 'NUI' | 'NUNI'

export interface AiTaskSuggestion {
  title: string
  priority: Priority
  subtasks: string[]
  estimatedMinutes: number
}

export interface AiResponse {
  reply: string
  tasks: AiTaskSuggestion[]
  source: 'cloud' | 'local' | 'heuristic'
}

export interface AiRequest {
  message: string
  history?: { role: 'user' | 'assistant'; content: string }[]
}

export const AI_SYSTEM_PROMPT = `You are Bubble. Reduce cognitive load. Organize the user's words into simple bubbles.

Return ONLY valid JSON:
{
  "reply": "Got it — short ack.",
  "tasks": [
    {
      "title": "Short title (max ~6 words)",
      "priority": "UI" | "UNI" | "NUI" | "NUNI",
      "estimatedMinutes": 25,
      "subtasks": ["Step from their list", "Another step they named"]
    }
  ]
}

EXAMPLES:
User: "Let's create a bubble for me binge watching all tom holland spider-man movies to prepare for spider-man brand new day."
→ title: "Binge Tom Holland Spider-Man", subtasks: ["Watch the next film", "Stay off other tabs"], estimatedMinutes: 25

User: "complete my remaining tasks for my capstone. The remaining tasks are to test all edge cases for web and mobile apps, improve UI, prepare for local and enclosed testing."
→ title: "Capstone remaining work", subtasks: ["Test edge cases (web + mobile)", "Improve UI", "Prepare local & enclosed testing"], estimatedMinutes: 25

HARD RULES:
1. Titles must be SHORT and scannable. Never keep "Let's create a bubble…" or other chat fluff.
2. If they list remaining tasks (commas / "and" / "tasks are"), those EXACT items become subtasks. Do not replace with generic QA steps.
3. Never invent wellness/breaks (stretch, water, 1-minute break) unless asked.
4. One parent bubble per brain-dump unless they clearly asked for separate goals.
5. Prefer their wording, compressed — not coaching essays.
6. Reply under 20 words.
7. If no actionable ask, tasks: [].
8. estimatedMinutes is always 25 for the parent bubble. Subtasks are checklist steps only — they do not get their own timers.`

function clampMinutes(_n: unknown): number {
  return POMODORO_WORK_MINUTES
}

export function parseAiJson(
  raw: string,
  userMessage?: string,
): Omit<AiResponse, 'source'> | null {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1].trim() : trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end < 0) return null
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
      reply?: string
      tasks?: Array<{
        title?: string
        priority?: string
        subtasks?: string[]
        estimatedMinutes?: number
      }>
    }
    if (typeof parsed.reply !== 'string') return null
    const priorities = new Set(['UI', 'UNI', 'NUI', 'NUNI'])
    let tasks: AiTaskSuggestion[] = (parsed.tasks ?? [])
      .filter((t) => t && typeof t.title === 'string' && t.title.trim())
      .map((t) => {
        const title = t.title!.trim()
        const subtasks = Array.isArray(t.subtasks)
          ? t.subtasks
              .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
              .map((s) => s.trim())
          : []
        const estimatedMinutes = clampMinutes(
          t.estimatedMinutes ?? POMODORO_WORK_MINUTES,
        )
        return {
          title,
          priority: (priorities.has(t.priority ?? '') ? t.priority : 'NUI') as Priority,
          subtasks,
          estimatedMinutes,
        }
      })

    if (userMessage) {
      tasks = coerceGroundedTasks(userMessage, tasks)
      if (
        tasks.length === 0 &&
        /need to|have to|want to|finish|test|work|do |make |create |binge|watch|complete|capstone/i.test(
          userMessage,
        )
      ) {
        tasks = organizeFromPrompt(userMessage)
      }
    }

    const reply =
      userMessage && tasks.length > 0
        ? `Got it — “${tasks[0].title}”${
            tasks[0].subtasks.length
              ? ` with ${tasks[0].subtasks.length} steps`
              : ''
          } (~${tasks[0].estimatedMinutes}m).`
        : parsed.reply.trim()

    return { reply, tasks }
  } catch {
    return null
  }
}
