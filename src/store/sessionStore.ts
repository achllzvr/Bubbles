import { create } from 'zustand'

export type AppView = 'gate' | 'command' | 'lockin'

interface SessionState {
  view: AppView
  activeTaskId: number | null
  timerRunning: boolean
  timerEndsAt: number | null
  secondsLeft: number
  canPop: boolean
  downloadProgress: number
  downloadText: string
  lastAiSource: 'cloud' | 'local' | 'heuristic' | null
  setView: (view: AppView) => void
  enterLockIn: (taskId: number) => void
  leaveLockIn: () => void
  startTimer: (durationSec: number) => void
  tick: () => void
  stopTimer: () => void
  setCanPop: (value: boolean) => void
  setDownload: (progress: number, text: string) => void
  setLastAiSource: (source: 'cloud' | 'local' | 'heuristic' | null) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  view: 'gate',
  activeTaskId: null,
  timerRunning: false,
  timerEndsAt: null,
  secondsLeft: 0,
  canPop: false,
  downloadProgress: 0,
  downloadText: '',
  lastAiSource: null,

  setView: (view) => set({ view }),

  enterLockIn: (taskId) =>
    set({
      view: 'lockin',
      activeTaskId: taskId,
      timerRunning: false,
      timerEndsAt: null,
      secondsLeft: 0,
      canPop: false,
    }),

  leaveLockIn: () =>
    set({
      view: 'command',
      activeTaskId: null,
      timerRunning: false,
      timerEndsAt: null,
      secondsLeft: 0,
      canPop: false,
    }),

  startTimer: (durationSec) => {
    const endsAt = Date.now() + durationSec * 1000
    set({
      timerRunning: true,
      timerEndsAt: endsAt,
      secondsLeft: durationSec,
      canPop: false,
    })
  },

  tick: () => {
    const { timerEndsAt, timerRunning } = get()
    if (!timerRunning || !timerEndsAt) return
    const left = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000))
    if (left <= 0) {
      set({ secondsLeft: 0, timerRunning: false, canPop: true })
      return
    }
    set({ secondsLeft: left })
  },

  stopTimer: () =>
    set({
      timerRunning: false,
      timerEndsAt: null,
      secondsLeft: 0,
    }),

  setCanPop: (value) => set({ canPop: value }),
  setDownload: (progress, text) => set({ downloadProgress: progress, downloadText: text }),
  setLastAiSource: (source) => set({ lastAiSource: source }),
}))
