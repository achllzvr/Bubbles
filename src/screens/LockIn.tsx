import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import {
  completePomodoroWorkBlock,
  db,
  getSettings,
  markTaskPopped,
  toggleSubtaskDone,
  bubbleColorFor,
  PASTEL_RAINBOW,
} from '../db/schema'
import {
  breakLabel,
  LONG_BREAK_MINUTES,
  POMODORO_WORK_MINUTES,
  SHORT_BREAK_MINUTES,
} from '../lib/focusEstimate'
import { useSessionStore } from '../store/sessionStore'
import { Mascot } from '../components/Mascot'
import { BubbleFace } from '../components/BubbleFace'
import { ChunkyButton } from '../components/ui'
import {
  enterUp,
  pressHover,
  pressTap,
  pressTransition,
  springBouncy,
} from '../components/ui/motionPresets'

function formatTime(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

type Phase = 'ready' | 'working' | 'choose' | 'breaking'

export function LockIn() {
  const activeTaskId = useSessionStore((s) => s.activeTaskId)
  const timerRunning = useSessionStore((s) => s.timerRunning)
  const secondsLeft = useSessionStore((s) => s.secondsLeft)
  const canPop = useSessionStore((s) => s.canPop)
  const startTimer = useSessionStore((s) => s.startTimer)
  const tick = useSessionStore((s) => s.tick)
  const stopTimer = useSessionStore((s) => s.stopTimer)
  const leaveLockIn = useSessionStore((s) => s.leaveLockIn)
  const setCanPop = useSessionStore((s) => s.setCanPop)

  const [phase, setPhase] = useState<Phase>('ready')
  const [wantProof, setWantProof] = useState(false)
  const [proofNote, setProofNote] = useState('')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [pendingBreakMin, setPendingBreakMin] = useState<5 | 15 | null>(null)
  const handledTimerEnd = useRef(false)

  const task = useLiveQuery(
    () => (activeTaskId ? db.tasks.get(activeTaskId) : undefined),
    [activeTaskId],
  )
  const subtasks =
    useLiveQuery(
      () => (activeTaskId ? db.tasks.where('parentId').equals(activeTaskId).toArray() : []),
      [activeTaskId],
    ) ?? []
  const settings = useLiveQuery(() => getSettings(), [])

  useEffect(() => {
    if (!timerRunning) return
    const id = window.setInterval(() => tick(), 250)
    return () => window.clearInterval(id)
  }, [timerRunning, tick])

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null
    async function requestLock() {
      try {
        if (timerRunning && 'wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch {
        // ignore
      }
    }
    void requestLock()
    return () => {
      void wakeLock?.release()
    }
  }, [timerRunning])

  useEffect(() => {
    if (!canPop) {
      handledTimerEnd.current = false
      return
    }
    if (handledTimerEnd.current) return
    handledTimerEnd.current = true

    if (phase === 'working') {
      void (async () => {
        const breakMin = await completePomodoroWorkBlock()
        setPendingBreakMin(breakMin)
        setPhase('choose')
      })()
      return
    }

    if (phase === 'breaking') {
      void startWorkBlock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPop, phase])

  const durationSec = POMODORO_WORK_MINUTES * 60
  const cycleCount = settings?.pomodoroCycleCount ?? 0
  const doneCount = subtasks.filter((s) => s.done).length
  const allStepsDone = subtasks.length > 0 && doneCount === subtasks.length

  async function startWorkBlock() {
    if (!activeTaskId) return
    const id = await db.sessions.add({
      taskId: activeTaskId,
      startedAt: Date.now(),
      durationSec,
      abandoned: false,
    })
    setSessionId(id as number)
    setPendingBreakMin(null)
    setCanPop(false)
    setPhase('working')
    startTimer(durationSec)
  }

  async function onStart() {
    await startWorkBlock()
  }

  async function onAbandon() {
    if (sessionId) {
      await db.sessions.update(sessionId, {
        endedAt: Date.now(),
        abandoned: true,
      })
    }
    if (activeTaskId) {
      await db.tasks.update(activeTaskId, { status: 'queue' })
    }
    stopTimer()
    leaveLockIn()
  }

  function celebrate() {
    confetti({
      particleCount: 100,
      spread: 82,
      scalar: 0.9,
      origin: { y: 0.55 },
      colors: [...PASTEL_RAINBOW],
    })
    try {
      navigator.vibrate?.(40)
    } catch {
      // ignore
    }
  }

  async function popNow() {
    if (!activeTaskId || !task || finishing) return
    setFinishing(true)
    try {
      const fresh = (await db.tasks.get(activeTaskId)) ?? task
      const note = wantProof && proofNote.trim() ? proofNote.trim() : null
      await markTaskPopped(fresh, note, { popChildren: true })
      if (sessionId) {
        await db.sessions.update(sessionId, {
          endedAt: Date.now(),
          abandoned: false,
        })
      }
      celebrate()
      leaveLockIn()
    } catch (err) {
      console.error(err)
      setFinishing(false)
    }
  }

  async function continueWorking() {
    if (finishing) return
    if (sessionId) {
      await db.sessions.update(sessionId, {
        endedAt: Date.now(),
        abandoned: false,
      })
    }
    const breakMin = pendingBreakMin ?? SHORT_BREAK_MINUTES
    setCanPop(false)
    setPhase('breaking')
    startTimer(breakMin * 60)
  }

  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface px-8 text-center">
        <Mascot mood="idle" size={72} />
        <p className="text-base font-bold text-ink">This bubble drifted away</p>
        <p className="max-w-xs text-xs leading-relaxed text-ink-dim">
          Nothing is loaded for this focus session — head back and pick another bubble.
        </p>
        <ChunkyButton variant="primary" onClick={leaveLockIn}>
          Back to the map
        </ChunkyButton>
      </div>
    )
  }

  const showChoose = phase === 'choose'
  const isBreaking = phase === 'breaking'
  const displaySeconds =
    timerRunning || showChoose || isBreaking
      ? isBreaking || timerRunning
        ? secondsLeft
        : 0
      : durationSec

  const breakMinutes = pendingBreakMin ?? SHORT_BREAK_MINUTES
  const statusLine = isBreaking
    ? `${breakLabel(breakMinutes)} — breathe for ${breakMinutes} minutes`
    : showChoose
      ? `That's a full pomodoro. A ${breakMinutes}m ${
          breakMinutes === LONG_BREAK_MINUTES ? 'long' : 'short'
        } break is waiting.`
      : `One gentle pomodoro · ${POMODORO_WORK_MINUTES} minutes`

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-surface">
      <span className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-bubble-peach/20 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-bubble-orchid/18 blur-3xl" />
      <span className="pointer-events-none absolute left-1/3 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-bubble-sky/12 blur-3xl" />
      <ChunkyButton
        variant="ghost"
        size="sm"
        onClick={() => void onAbandon()}
        className="absolute right-4 top-4 z-20"
      >
        Back to the map
      </ChunkyButton>

      <div className="absolute left-5 top-5 z-20 flex items-center gap-2">
        <span className="chrome-label text-ink-faint">rest meter</span>
        <span className="flex gap-1" aria-label={`${cycleCount} of 4 pomodoros before a long break`}>
          {[0, 1, 2, 3].map((slot) => (
            <span
              key={slot}
              className={`h-2.5 w-2.5 rounded-[2px] border-2 border-ink-stroke ${
                slot < cycleCount ? 'bg-accent' : 'bg-surface-3'
              }`}
            />
          ))}
        </span>
      </div>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-4 py-14">
        <div className="flex w-full max-w-4xl shrink-0 flex-row items-center justify-center gap-8 px-2">
          <div className="flex flex-col items-center">
            <div
              className={`bubble-wobble relative mb-5 flex flex-col items-center justify-center gap-2 overflow-hidden border-2 border-ink-stroke px-5 text-center text-bubble-ink lift-shadow ${
                isBreaking ? 'animate-breathe' : showChoose ? '' : 'animate-breathe'
              }`}
              style={{
                width: 'clamp(112px, 26vh, 176px)',
                height: 'clamp(112px, 26vh, 176px)',
                background: isBreaking
                  ? 'radial-gradient(circle at 34% 28%, color-mix(in srgb, var(--bubble-butter) 45%, white), var(--bubble-butter))'
                  : showChoose
                    ? 'radial-gradient(circle at 34% 28%, color-mix(in srgb, var(--bubble-lime) 45%, white), var(--bubble-lime))'
                    : `radial-gradient(circle at 34% 28%, color-mix(in srgb, ${bubbleColorFor(task.id)} 50%, white), ${bubbleColorFor(task.id)})`,
              }}
            >
              <span className="absolute left-[18%] top-[12%] h-[20%] w-[16%] rounded-full bg-white/35 blur-[2px]" />
              <BubbleFace
                expression={isBreaking ? 'resting' : showChoose ? 'happy' : 'focused'}
                scale={1.15}
                blush={showChoose || isBreaking}
              />
              <p className="line-clamp-3 text-[13px] font-bold leading-snug">
                {isBreaking ? 'Resting' : task.title}
              </p>
            </div>

            <p
              className="font-pixel tabular-nums tracking-tight text-ink"
              style={{ fontSize: 'clamp(24px, 6.4vh, 42px)' }}
              role="timer"
              aria-live="off"
            >
              {formatTime(displaySeconds)}
            </p>
            <p className="mt-3 max-w-xs text-center text-xs font-bold leading-relaxed text-ink-dim">
              {statusLine}
            </p>
          </div>

          {!isBreaking && subtasks.length > 0 && (
            <div className="playful-card max-h-[58vh] w-full max-w-xs overflow-y-auto rounded-[var(--radius-panel)] p-4">
              <p className="chrome-label mb-3 text-ink-faint">
                steps · {doneCount}/{subtasks.length}
              </p>
              <ul className="space-y-2">
                {subtasks.map((step) => (
                  <li key={step.id}>
                    <motion.button
                      type="button"
                      aria-pressed={Boolean(step.done)}
                      onClick={() => step.id && void toggleSubtaskDone(step.id)}
                      whileHover={pressHover}
                      whileTap={pressTap}
                      transition={pressTransition}
                      className={`flex w-full items-start gap-3 rounded-[var(--radius-card)] border-2 border-ink-stroke px-3.5 py-3 text-left soft-shadow ${
                        step.done ? '' : 'bg-surface'
                      }`}
                      style={
                        step.done
                          ? {
                              background: `color-mix(in srgb, ${bubbleColorFor(step.id)} 28%, white)`,
                            }
                          : undefined
                      }
                    >
                      <motion.span
                        animate={{ scale: step.done ? 1.08 : 1 }}
                        transition={springBouncy}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] ${
                          step.done
                            ? 'border-accent-dark bg-accent text-on-accent'
                            : 'border-ink-faint text-transparent'
                        }`}
                        aria-hidden
                      >
                        ✓
                      </motion.span>
                      <span
                        className={`text-sm leading-snug ${
                          step.done ? 'text-ink-faint line-through' : 'text-ink'
                        }`}
                      >
                        {step.title}
                      </span>
                    </motion.button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                Tick these off as you go — no timers here. Pop the big bubble once the whole thing
                feels done.
              </p>
            </div>
          )}
        </div>

        <div className="flex w-full max-w-2xl shrink-0 flex-col items-center gap-4 px-2">
          {phase === 'ready' && !timerRunning && (
            <ChunkyButton variant="primary" size="lg" onClick={() => void onStart()}>
              Start the 25 minutes
            </ChunkyButton>
          )}

          {isBreaking && timerRunning && (
            <p className="playful-card rounded-full px-5 py-2.5 text-center text-sm text-ink-dim">
              Stretch, sip, stare out a window. Your next {POMODORO_WORK_MINUTES}m starts on its own.
            </p>
          )}

          {showChoose && (
            <motion.div
              variants={enterUp}
              initial="hidden"
              animate="visible"
              className="playful-card w-full rounded-[var(--radius-panel)] p-4"
            >
              {allStepsDone && (
                <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                  <span aria-hidden>✨</span> Every step is ticked — this one looks ready to pop.
                </p>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[140px] flex-1">
                  <p className="chrome-label mb-2 text-ink-faint">keepsake note</p>
                  <div className="flex rounded-full border-2 border-ink-stroke bg-surface p-1 soft-shadow">
                    <button
                      type="button"
                      onClick={() => {
                        setWantProof(false)
                        setProofNote('')
                      }}
                      className={`chrome-label flex-1 rounded-full px-3 py-2 transition ${
                        !wantProof
                          ? 'bg-accent text-on-accent soft-shadow'
                          : 'text-ink-dim hover:text-ink'
                      }`}
                    >
                      Skip it
                    </button>
                    <button
                      type="button"
                      aria-pressed={wantProof}
                      onClick={() => setWantProof(true)}
                      className={`chrome-label flex-1 rounded-full px-3 py-2 transition ${
                        wantProof
                          ? 'bg-accent text-on-accent soft-shadow'
                          : 'text-ink-dim hover:text-ink'
                      }`}
                    >
                      Add note
                    </button>
                  </div>
                </div>

                <ChunkyButton
                  variant="success"
                  disabled={finishing}
                  onClick={() => void popNow()}
                  className="!tracking-[0.06em]"
                >
                  {finishing ? 'Popping…' : 'Pop it — all done'}
                </ChunkyButton>

                <ChunkyButton
                  variant="secondary"
                  disabled={finishing}
                  onClick={() => void continueWorking()}
                >
                  Not yet — keep going
                </ChunkyButton>
              </div>

              {wantProof && (
                <input
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  placeholder="A word about what you finished (optional)…"
                  aria-label="Optional note about what you finished"
                  className="chunky-input mt-3"
                />
              )}

              <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                Keep going takes a {breakMinutes === LONG_BREAK_MINUTES ? '15m long' : '5m short'}{' '}
                break first, then eases you into another {POMODORO_WORK_MINUTES}m on this bubble.
              </p>
            </motion.div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 z-[1]">
        <Mascot
          mood={
            isBreaking
              ? 'break'
              : phase === 'working'
                ? 'working'
                : showChoose
                  ? 'celebrate'
                  : 'idle'
          }
          size={52}
        />
      </div>
    </div>
  )
}
