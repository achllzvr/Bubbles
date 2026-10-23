import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { motion } from 'framer-motion'
import { bubbleColorFor, PRIORITY_LABEL, type Task } from '../db/schema'
import { BubbleFace, type FaceExpression } from './BubbleFace'
import { pressTransition, springSoft } from './ui/motionPresets'

const LONG_PRESS_MS = 560
const MOVE_CANCEL_PX = 12

export interface BubbleCardProps {
  task: Task
  size: number
  selected?: boolean
  dimmed?: boolean
  childCount?: number
  doneCount?: number
  onTap?: () => void
  onLongPress?: () => void
}

export function BubbleCard({
  task,
  size,
  selected = false,
  dimmed = false,
  childCount = 0,
  doneCount = 0,
  onTap,
  onLongPress,
}: BubbleCardProps) {
  const color = bubbleColorFor(task.id)
  const [holdProgress, setHoldProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const timerRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const startedAt = useRef(0)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const longPressed = useRef(false)

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      if (intervalRef.current != null) window.clearInterval(intervalRef.current)
    },
    [],
  )

  function stopTimers() {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    if (intervalRef.current != null) window.clearInterval(intervalRef.current)
    timerRef.current = null
    intervalRef.current = null
    startPos.current = null
  }

  function clearHold(reset = true) {
    stopTimers()
    setHolding(false)
    if (reset) setHoldProgress(0)
  }

  function completeLongPress() {
    stopTimers()
    longPressed.current = true
    setHoldProgress(1)
    setHolding(false)
    try {
      navigator.vibrate?.([18, 30, 28])
    } catch {
      // Haptics are optional.
    }
    window.setTimeout(() => onLongPress?.(), 90)
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (!onLongPress || e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    longPressed.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    startedAt.current = performance.now()
    setHolding(true)
    setHoldProgress(0.02)
    intervalRef.current = window.setInterval(() => {
      setHoldProgress(Math.min(0.98, (performance.now() - startedAt.current) / LONG_PRESS_MS))
    }, 24)
    timerRef.current = window.setTimeout(completeLongPress, LONG_PRESS_MS)
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!startPos.current || !holding) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearHold()
  }

  function onPointerUp() {
    clearHold(!longPressed.current)
  }

  function onClick() {
    if (longPressed.current) {
      longPressed.current = false
      setHoldProgress(0)
      return
    }
    onTap?.()
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onTap?.()
    }
    if (e.key === ' ' && onLongPress) {
      e.preventDefault()
      setHoldProgress(1)
      window.setTimeout(() => {
        setHoldProgress(0)
        onLongPress()
      }, 90)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      const wasHolding = holding || holdProgress > 0
      clearHold()
      longPressed.current = false
      if (selected && !wasHolding) onTap?.()
    }
  }

  const popped = task.status === 'popped'
  const focused = task.status === 'focus'
  const compact = size < 88
  const faceScale = Math.min(1.2, Math.max(0.66, size / 100))
  const titleSize = Math.min(13, Math.max(9, Math.round(size * 0.115)))

  const expression: FaceExpression = popped ? 'happy' : holding || focused ? 'focused' : 'calm'

  const bubbleStyle = {
    background: `radial-gradient(circle at 34% 26%, color-mix(in srgb, ${color} 52%, white), ${color} 78%, color-mix(in srgb, ${color} 88%, #c9a0b8))`,
    boxShadow: selected
      ? `0 0 0 3px var(--accent), 0 6px 0 0 var(--accent-dark), inset 0 2px 8px rgba(255,255,255,.5)`
      : `0 5px 0 0 color-mix(in srgb, ${color} 55%, #4a4458), inset 0 2px 8px rgba(255,255,255,.48)`,
    border: '2px solid color-mix(in srgb, var(--ink-stroke) 55%, transparent)',
    animationDelay: `${((task.id ?? 1) % 9) * -0.7}s`,
  } as CSSProperties

  const statusLabel = popped ? 'Popped' : focused ? 'In focus' : 'Waiting'

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        width: size,
        height: size,
        scale: holding ? 1.07 : selected ? 1.03 : 1,
        opacity: dimmed ? 0.42 : popped ? 0.62 : 1,
      }}
      transition={springSoft}
      className={`relative select-none ${focused ? 'focus-halo rounded-full' : ''}`}
      data-task-id={task.id}
    >
      {holdProgress > 0 && (
        <span className="pointer-events-none absolute inset-1/2 z-20" aria-hidden>
          {Array.from({ length: 16 }, (_, index) => (
            <span
              key={index}
              className="absolute -ml-1 -mt-1 h-2 w-2 rounded-[2px] bg-accent"
              style={{
                opacity: (index + 1) / 16 <= holdProgress ? 1 : 0.14,
                transform: `rotate(${index * 22.5}deg) translateY(${-size / 2 - 8}px)`,
              }}
            />
          ))}
        </span>
      )}

      {holdProgress === 1 && (
        <motion.span
          initial={{ scale: 0.85, opacity: 0.5 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.34 }}
          className="pointer-events-none absolute inset-0 z-10 rounded-full border-4 border-accent"
        />
      )}

      <motion.button
        type="button"
        aria-label={`${task.title}. ${statusLabel}. Priority ${PRIORITY_LABEL[task.priority]}.${
          childCount > 0 ? ` ${doneCount} of ${childCount} steps done.` : ''
        }${onLongPress ? ' Press and hold to start focus.' : ''}`}
        aria-expanded={childCount > 0 ? selected : undefined}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => clearHold()}
        onPointerLeave={() => holding && clearHold()}
        onContextMenu={(event) => {
          if (onLongPress) event.preventDefault()
        }}
        whileTap={holding ? undefined : { scale: 0.94 }}
        transition={pressTransition}
        className={`bubble-idle relative flex h-full w-full touch-none flex-col items-center justify-center gap-1.5 overflow-hidden rounded-full px-3.5 text-center text-bubble-ink ${
          popped ? 'saturate-[.75]' : ''
        }`}
        style={bubbleStyle}
      >
        <span className="pointer-events-none absolute left-[16%] top-[11%] h-[22%] w-[17%] rounded-full bg-white/40 blur-[2px]" />
        <BubbleFace expression={expression} scale={faceScale} blush={popped} />
        <span
          className="line-clamp-3 font-bold leading-snug tracking-tight"
          style={{ fontSize: titleSize, maxWidth: '92%' }}
        >
          {task.title}
        </span>

        {holding && (
          <span className="pixel-label absolute bottom-[9%] text-bubble-ink-soft">hold on</span>
        )}
      </motion.button>

      {popped && (
        <span
          className="animate-sparkle pointer-events-none absolute -left-1 -top-1 text-base"
          aria-hidden
        >
          ✨
        </span>
      )}

      {(focused || popped) && (
        <span
          className={`bubble-badge pixel-label absolute -top-2 left-1/2 -translate-x-1/2 px-2 ${
            focused ? 'text-accent' : 'text-ink-dim'
          }`}
        >
          {focused ? 'focus' : 'done'}
        </span>
      )}

      <span
        className={`bubble-badge absolute -right-1 top-1 text-bubble-ink ${
          compact ? 'text-[8px]' : 'text-[9px]'
        }`}
        style={{ background: `color-mix(in srgb, ${color} 55%, white)` }}
      >
        {PRIORITY_LABEL[task.priority]}
      </span>

      {childCount > 0 && (
        <span className="bubble-badge absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-ink-dim">
          {doneCount === childCount ? '✓' : '•'} {doneCount}/{childCount}
        </span>
      )}
    </motion.div>
  )
}
