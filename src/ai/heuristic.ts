import { organizeFromPrompt } from './organize'
import type { AiResponse } from './types'

export function heuristicParse(message: string): AiResponse {
  const tasks = organizeFromPrompt(message)

  const reply =
    tasks.length === 0
      ? "I'm here when you're ready to dump what's on your mind."
      : tasks.length === 1
        ? `Got it — “${tasks[0].title}” is queued for about ${tasks[0].estimatedMinutes} min.`
        : `Got it — I organized ${tasks.length} items from what you said.`

  return { reply, tasks, source: 'heuristic' }
}
