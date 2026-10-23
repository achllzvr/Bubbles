import Dexie, { type EntityTable } from 'dexie'
import { POMODORO_WORK_MINUTES } from '../lib/focusEstimate'

export type Priority = 'UI' | 'UNI' | 'NUI' | 'NUNI'
export type TaskStatus = 'queue' | 'focus' | 'popped'
export type CloudProvider = 'gemini' | 'openai'
export type ThemePreference = 'system' | 'light' | 'dark'

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  UI: 0,
  UNI: 1,
  NUI: 2,
  NUNI: 3,
}

/** Short, non-color priority wording shown on bubbles. */
export const PRIORITY_LABEL: Record<Priority, string> = {
  UI: 'NOW',
  UNI: 'SOON',
  NUI: 'PLAN',
  NUNI: 'LATER',
}

export const PRIORITY_COLOR: Record<Priority, string> = {
  UI: 'var(--color-bubble-ui)',
  UNI: 'var(--color-bubble-uni)',
  NUI: 'var(--color-bubble-nui)',
  NUNI: 'var(--color-bubble-nuni)',
}

/** Soft rainbow pastels — stable per id so the map feels colorful, not only blue/green. */
export const PASTEL_RAINBOW = [
  '#f7a8b8', // rose
  '#f5b27a', // peach
  '#f3d36b', // butter
  '#b8e986', // lime
  '#7ed9b8', // mint
  '#7fd4e8', // sky
  '#8fb5f5', // periwinkle
  '#b39df0', // lilac
  '#e0a0e8', // orchid
  '#f0a0c8', // pink
  '#ffb3a0', // coral
  '#a8e6cf', // seafoam
] as const

/** Deterministic soft rainbow pick from a task id (or any seed). */
export function bubbleColorFor(seed?: number | null): string {
  const n = typeof seed === 'number' && Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0
  return PASTEL_RAINBOW[n % PASTEL_RAINBOW.length]
}

export interface Task {
  id?: number
  parentId?: number | null
  title: string
  priority: Priority
  status: TaskStatus
  /** Only meaningful on root bubbles — always 25 (pomodoro). */
  estimatedMinutes?: number
  /** Checklist completion for sub-bubbles (and optional root). */
  done?: boolean
  createdAt: number
  completedAt?: number | null
  proofUri?: string | null
  proofNote?: string | null
}

export interface Session {
  id?: number
  taskId: number
  startedAt: number
  endedAt?: number | null
  durationSec: number
  abandoned: boolean
}

export interface ChatMessage {
  id?: number
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  linkedTaskIds?: number[]
  source?: 'cloud' | 'local' | 'heuristic'
}

export interface AppSettings {
  id: number
  modelReady: boolean
  modelId: string
  pomodoroMinutes: number
  /** Completed 25m work sessions since last long break (0–3). */
  pomodoroCycleCount: number
  theme: ThemePreference
  companionName: string
  cloudProvider: CloudProvider
  cloudApiKey: string
  installPromptDismissedAt: number | null
}

export const DEFAULT_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'

export const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  modelReady: false,
  modelId: DEFAULT_MODEL_ID,
  pomodoroMinutes: 25,
  pomodoroCycleCount: 0,
  theme: 'system',
  companionName: 'Bubble',
  cloudProvider: 'gemini',
  cloudApiKey: '',
  installPromptDismissedAt: null,
}

class BubblesDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  sessions!: EntityTable<Session, 'id'>
  chatMessages!: EntityTable<ChatMessage, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('bubbles')
    this.version(1).stores({
      tasks: '++id, parentId, status, priority, createdAt',
      sessions: '++id, taskId, startedAt',
      chatMessages: '++id, createdAt, role',
      settings: 'id',
    })
  }
}

export const db = new BubblesDB()

export async function ensureSettings(): Promise<AppSettings> {
  const existing = await db.settings.get(1)
  if (existing) {
    const patch: Partial<AppSettings> = {}
    if (typeof existing.pomodoroCycleCount !== 'number') {
      patch.pomodoroCycleCount = 0
    }
    if (!existing.theme) {
      patch.theme = 'system'
    }
    if (Object.keys(patch).length > 0) {
      await db.settings.update(1, patch)
      return { ...existing, ...patch }
    }
    return existing
  }
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

/**
 * After a completed 25m work block: bump cycle and return the break length.
 * 1st–3rd → 5m short break; 4th → 15m long break and reset.
 */
export async function completePomodoroWorkBlock(): Promise<5 | 15> {
  const s = await ensureSettings()
  const next = (s.pomodoroCycleCount ?? 0) + 1
  if (next >= 4) {
    await updateSettings({ pomodoroCycleCount: 0 })
    return 15
  }
  await updateSettings({ pomodoroCycleCount: next })
  return 5
}

/** Read-only — safe inside Dexie liveQuery */
export async function getSettings(): Promise<AppSettings | undefined> {
  return db.settings.get(1)
}

export async function updateSettings(
  patch: Partial<Omit<AppSettings, 'id'>>,
): Promise<AppSettings> {
  await ensureSettings()
  await db.settings.update(1, patch)
  return (await db.settings.get(1))!
}

export function sortQueue(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
    if (pw !== 0) return pw
    return a.createdAt - b.createdAt
  })
}

export async function createTaskTree(
  title: string,
  priority: Priority,
  subtasks: string[] = [],
  _estimatedMinutes?: number,
): Promise<number[]> {
  const now = Date.now()
  const parentId = await db.tasks.add({
    title,
    priority,
    status: 'queue',
    parentId: null,
    estimatedMinutes: POMODORO_WORK_MINUTES,
    done: false,
    createdAt: now,
  })

  const ids: number[] = [parentId as number]
  for (const sub of subtasks) {
    const childId = await db.tasks.add({
      title: sub,
      priority,
      status: 'queue',
      parentId: parentId as number,
      // Sub-bubbles are checklist steps under the parent pomodoro — no own timer
      estimatedMinutes: undefined,
      done: false,
      createdAt: Date.now(),
    })
    ids.push(childId as number)
  }
  return ids
}

export async function toggleSubtaskDone(taskId: number): Promise<void> {
  const task = await db.tasks.get(taskId)
  if (!task?.id) return
  await db.tasks.update(task.id, { done: !task.done })
}

export async function renameTask(taskId: number, title: string): Promise<void> {
  const next = title.trim()
  if (!next) return
  const task = await db.tasks.get(taskId)
  if (!task?.id) return
  await db.tasks.update(task.id, { title: next })
}

/** Add a checklist step under a root bubble. */
export async function addSubtask(parentId: number, title: string): Promise<number | null> {
  const next = title.trim()
  if (!next) return null
  const parent = await db.tasks.get(parentId)
  if (!parent?.id || parent.parentId != null) return null

  const childId = await db.tasks.add({
    title: next,
    priority: parent.priority,
    status: parent.status === 'popped' ? 'popped' : 'queue',
    parentId: parent.id,
    estimatedMinutes: undefined,
    done: parent.status === 'popped',
    createdAt: Date.now(),
  })
  return childId as number
}

/** Remove one checklist step (not the parent bubble). */
export async function removeSubtask(taskId: number): Promise<void> {
  const task = await db.tasks.get(taskId)
  if (!task?.id || task.parentId == null) return
  await db.tasks.delete(task.id)
}

/** Leave a session bubble in Popped and keep working via a fresh Queue copy. */
export async function popSessionAndContinue(task: Task, proofNote?: string | null): Promise<number> {
  if (!task.id) throw new Error('Task missing id')

  return db.transaction('rw', db.tasks, async () => {
    // Use put so status change is reliable even if the live object is stale
    await db.tasks.put({
      ...task,
      id: task.id,
      status: 'popped',
      completedAt: Date.now(),
      proofNote: proofNote ?? null,
    })

    // Continuation is always a visible Queue root if the original was a root;
    // if it was a micro-step, keep the same parent so it nests under that project.
    const continuationId = await db.tasks.add({
      title: task.title,
      priority: task.priority,
      status: 'queue',
      parentId: task.parentId ?? null,
      estimatedMinutes: task.estimatedMinutes,
      createdAt: Date.now(),
    })

    return continuationId as number
  })
}

export async function markTaskPopped(
  task: Task,
  proofNote?: string | null,
  options?: { popChildren?: boolean },
): Promise<void> {
  if (!task.id) throw new Error('Task missing id')

  await db.transaction('rw', db.tasks, async () => {
    await db.tasks.put({
      ...task,
      id: task.id,
      status: 'popped',
      done: true,
      completedAt: Date.now(),
      proofNote: proofNote ?? null,
    })

    if (options?.popChildren) {
      const children = await db.tasks.where('parentId').equals(task.id!).toArray()
      for (const child of children) {
        if (!child.id || child.status === 'popped') continue
        await db.tasks.put({
          ...child,
          status: 'popped',
          done: true,
          completedAt: Date.now(),
        })
      }
    }
  })
}

/** Permanently remove a bubble (and its micro-steps). Not the same as Popped. */
export async function deleteTaskPermanently(taskId: number): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    const children = await db.tasks.where('parentId').equals(taskId).toArray()
    const ids = [taskId, ...children.map((c) => c.id!).filter(Boolean)]
    await db.tasks.bulkDelete(ids)
  })
}
