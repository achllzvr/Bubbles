import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import {
  PRIORITY_LABEL,
  bubbleColorFor,
  db,
  deleteTaskPermanently,
  toggleSubtaskDone,
  type Priority,
  type Task,
} from '../db/schema'
import { useSessionStore } from '../store/sessionStore'
import { BubbleCard } from './BubbleCard'
import { BubbleEditPanel } from './BubbleEditPanel'
import { Mascot } from './Mascot'

interface MapPoint {
  task: Task
  x: number
  y: number
  size: number
  collisionSize: number
}

const PRIORITY_RANK: Record<Priority, number> = { UI: 0, UNI: 1, NUI: 2, NUNI: 3 }
const EMPTY_TASKS: Task[] = []
const MIN_ZOOM = 0.45
const MAX_ZOOM = 2.25
const PAN_THRESHOLD = 8

function isRoot(task: Task) {
  return task.parentId == null
}

function seeded(id: number, salt: number) {
  const x = Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return (min + max) / 2
  return Math.max(min, Math.min(max, value))
}

function worldSize(rootCount: number, viewportW: number, viewportH: number) {
  const spread = Math.max(1, rootCount)
  return {
    width: Math.round(Math.max(viewportW * 1.9, 1100 + spread * 110)),
    height: Math.round(Math.max(viewportH * 1.9, 820 + spread * 90)),
  }
}

function layoutMap(
  roots: Task[],
  worldW: number,
  worldH: number,
  selectedId: number | null,
  childCounts: Map<number, number>,
) {
  if (!worldW || !worldH) return [] as MapPoint[]
  const cx = worldW / 2
  const cy = worldH / 2
  const padding = 90

  const points: MapPoint[] = roots.map((task, index) => {
    const id = task.id ?? index + 1
    const selected = id === selectedId
    const focused = task.status === 'focus'
    const popped = task.status === 'popped'
    const baseSize = focused ? 118 : popped ? 78 : 98 + Math.min(14, (childCounts.get(id) ?? 0) * 2)
    const size = selected ? Math.round(baseSize * 1.14) : baseSize
    const collisionSize = selected
      ? Math.min(280, Math.max(200, size + 130))
      : size + 18

    const angle = seeded(id, 1) * Math.PI * 2
    const ring = 70 + PRIORITY_RANK[task.priority] * 48 + (popped ? Math.min(worldW, worldH) * 0.12 : 0)
    const radius = ring + seeded(id, 2) * Math.max(90, Math.min(worldW, worldH) * 0.28)

    return {
      task,
      x: clamp(cx + Math.cos(angle) * radius, padding, worldW - padding),
      y: clamp(cy + Math.sin(angle) * radius * 0.78, padding, worldH - padding),
      size,
      collisionSize,
    }
  })

  for (let iteration = 0; iteration < 110; iteration++) {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i]
        const b = points[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let distance = Math.hypot(dx, dy)
        if (distance < 0.001) {
          dx = seeded((a.task.id ?? i) + j, 4) - 0.5
          dy = seeded((b.task.id ?? j) + i, 5) - 0.5
          distance = Math.hypot(dx, dy) || 1
        }
        const minimum = (a.collisionSize + b.collisionSize) / 2 + 12
        if (distance >= minimum) continue
        const push = (minimum - distance) / distance / 2
        a.x -= dx * push
        a.y -= dy * push
        b.x += dx * push
        b.y += dy * push
      }
    }

    for (const point of points) {
      const edge = point.size / 2 + 20
      point.x = clamp(point.x, edge, worldW - edge)
      point.y = clamp(point.y, edge, worldH - edge)
    }
  }

  return points
}

function childOrbit(parent: MapPoint, children: Task[], worldW: number, worldH: number) {
  const radius = Math.min(150, Math.max(104, parent.size * 1.15))
  return children.map((task, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(children.length, 1)
    return {
      task,
      x: clamp(parent.x + Math.cos(angle) * radius, 48, worldW - 48),
      y: clamp(parent.y + Math.sin(angle) * radius, 48, worldH - 48),
      size: 66,
    }
  })
}

export function BubbleBoard() {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? EMPTY_TASKS
  const enterLockIn = useSessionStore((state) => state.enterLockIn)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [cameraReady, setCameraReady] = useState(false)

  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const pinchRef = useRef<{
    distance: number
    zoom: number
  } | null>(null)

  useEffect(() => {
    panRef.current = pan
  }, [pan])
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const resize = new ResizeObserver(([entry]) => {
      setViewport({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      })
    })
    resize.observe(element)
    return () => resize.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (editing) {
        setEditing(false)
        return
      }
      setSelectedId(null)
      setConfirmingDelete(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  const roots = useMemo(
    () =>
      tasks
        .filter(isRoot)
        .sort((a, b) => {
          if (a.status === 'focus') return -1
          if (b.status === 'focus') return 1
          return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt - b.createdAt
        }),
    [tasks],
  )
  const childrenByParent = useMemo(() => {
    const map = new Map<number, Task[]>()
    for (const task of tasks) {
      if (task.parentId == null) continue
      const group = map.get(task.parentId) ?? []
      group.push(task)
      map.set(task.parentId, group)
    }
    return map
  }, [tasks])
  const childCounts = useMemo(
    () => new Map([...childrenByParent].map(([id, children]) => [id, children.length])),
    [childrenByParent],
  )

  const world = useMemo(
    () => worldSize(roots.length, viewport.width || 800, viewport.height || 600),
    [roots.length, viewport.width, viewport.height],
  )

  const points = useMemo(
    () => layoutMap(roots, world.width, world.height, selectedId, childCounts),
    [roots, world, selectedId, childCounts],
  )
  const selectedPoint = points.find((point) => point.task.id === selectedId)
  const selectedChildren =
    selectedPoint?.task.id != null ? (childrenByParent.get(selectedPoint.task.id) ?? []) : []
  const orbit = selectedPoint
    ? childOrbit(selectedPoint, selectedChildren, world.width, world.height)
    : []

  const activeCount = roots.filter((task) => task.status === 'queue').length
  const focusCount = roots.filter((task) => task.status === 'focus').length
  const poppedCount = roots.filter((task) => task.status === 'popped').length

  function centerOn(worldX: number, worldY: number, nextZoom = zoomRef.current) {
    if (!viewport.width || !viewport.height) return
    setPan({
      x: viewport.width / 2 - worldX * nextZoom,
      y: viewport.height / 2 - worldY * nextZoom,
    })
  }

  function resetCamera() {
    if (!viewport.width || !viewport.height) return
    setZoom(1)
    setPan({
      x: (viewport.width - world.width) / 2,
      y: (viewport.height - world.height) / 2,
    })
  }

  // Initial framing once viewport + world are known
  useEffect(() => {
    if (!viewport.width || !viewport.height || cameraReady) return
    setZoom(1)
    setPan({
      x: (viewport.width - world.width) / 2,
      y: (viewport.height - world.height) / 2,
    })
    setCameraReady(true)
  }, [viewport, world, cameraReady])

  // Keep map roughly framed when the sidebar collapses/expands
  useEffect(() => {
    if (!cameraReady || !viewport.width || !viewport.height) return
    const focus = selectedPoint ?? {
      x: world.width / 2,
      y: world.height / 2,
    }
    centerOn(focus.x, focus.y)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.width, viewport.height])

  function select(id: number | null) {
    setConfirmingDelete(false)
    setEditing(false)
    setSelectedId(id)
    if (id == null) return
    const point = points.find((entry) => entry.task.id === id)
    if (point) {
      // Slight delay so layout size update settles, then glide camera to the bubble
      window.requestAnimationFrame(() => centerOn(point.x, point.y))
    }
  }

  async function startLockIn(task: Task) {
    if (!task.id || task.status === 'popped') return
    const existingFocus = await db.tasks.where('status').equals('focus').toArray()
    await db.transaction('rw', db.tasks, async () => {
      for (const focused of existingFocus) {
        if (focused.id && focused.id !== task.id && isRoot(focused)) {
          await db.tasks.update(focused.id, { status: 'queue' })
        }
      }
      await db.tasks.update(task.id!, { status: 'focus' })
    })
    enterLockIn(task.id)
  }

  async function permanentlyDelete(task: Task) {
    if (!task.id) return
    await deleteTaskPermanently(task.id)
    select(null)
  }

  function onViewportPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('[data-bubble], [data-map-ui], button, input, a')) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: panRef.current.x,
      originY: panRef.current.y,
      moved: false,
    }
  }

  function onViewportPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && dx * dx + dy * dy > PAN_THRESHOLD * PAN_THRESHOLD) {
      drag.moved = true
    }
    if (!drag.moved) return
    setPan({
      x: drag.originX + dx,
      y: drag.originY + dy,
    })
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const moved = drag.moved
    dragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    if (!moved) {
      // Empty-space tap clears selection
      if (!(event.target as HTMLElement).closest('[data-bubble], [data-map-ui]')) {
        select(null)
      }
    }
  }

  function applyZoomAt(clientX: number, clientY: number, nextZoom: number) {
    const element = viewportRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const localX = clientX - rect.left
    const localY = clientY - rect.top
    const worldX = (localX - panRef.current.x) / zoomRef.current
    const worldY = (localY - panRef.current.y) / zoomRef.current
    const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    setZoom(clamped)
    setPan({
      x: localX - worldX * clamped,
      y: localY - worldY * clamped,
    })
  }

  function onWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const factor = event.deltaY > 0 ? 0.92 : 1.08
    applyZoomAt(event.clientX, event.clientY, zoomRef.current * factor)
  }

  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2) {
      pinchRef.current = null
      return
    }
    const [a, b] = [event.touches[0], event.touches[1]]
    pinchRef.current = {
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      zoom: zoomRef.current,
    }
  }

  function onTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2 || !pinchRef.current) return
    event.preventDefault()
    const [a, b] = [event.touches[0], event.touches[1]]
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const midX = (a.clientX + b.clientX) / 2
    const midY = (a.clientY + b.clientY) / 2
    const nextZoom = pinchRef.current.zoom * (distance / Math.max(1, pinchRef.current.distance))
    applyZoomAt(midX, midY, nextZoom)
  }

  function onTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2) pinchRef.current = null
  }

  return (
    <section className="relative flex h-full min-h-0 w-full flex-col p-3" aria-label="Task bubble map">
      <div
        data-map-ui
        className="pointer-events-none absolute inset-x-4 top-4 z-30 flex items-start justify-between gap-3"
      >
        <div className="playful-card pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2.5 text-[11px] font-semibold text-ink-dim">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-bubble-sky" aria-hidden />
            <b className="text-ink">{activeCount}</b> floating
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-bubble-orchid" aria-hidden />
            <b className="text-ink">{focusCount}</b> in focus
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-bubble-butter" aria-hidden />
            <b className="text-ink">{poppedCount}</b> popped
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <p className="playful-card hidden rounded-full px-4 py-2.5 text-[11px] font-semibold text-ink-dim lg:block">
            Drag to explore · scroll to zoom · hold to focus
          </p>
          <div className="playful-card flex items-center gap-1 rounded-full p-1">
            <button
              type="button"
              data-map-ui
              aria-label="Zoom out"
              onClick={() => {
                const element = viewportRef.current?.getBoundingClientRect()
                if (!element) return
                applyZoomAt(element.left + element.width / 2, element.top + element.height / 2, zoom * 0.85)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-ink-dim hover:bg-surface-3 hover:text-ink"
            >
              −
            </button>
            <button
              type="button"
              data-map-ui
              aria-label="Reset map view"
              onClick={resetCamera}
              className="rounded-full px-2.5 py-1.5 text-[10px] font-bold text-ink-dim hover:bg-surface-3 hover:text-ink"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              data-map-ui
              aria-label="Zoom in"
              onClick={() => {
                const element = viewportRef.current?.getBoundingClientRect()
                if (!element) return
                applyZoomAt(element.left + element.width / 2, element.top + element.height / 2, zoom * 1.15)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-ink-dim hover:bg-surface-3 hover:text-ink"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden rounded-[2rem] bg-surface-2/55 active:cursor-grabbing touch-none"
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{
            width: world.width,
            height: world.height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background: [
                'radial-gradient(circle at 18% 18%, color-mix(in srgb, var(--bubble-peach) 28%, transparent), transparent 32%)',
                'radial-gradient(circle at 78% 22%, color-mix(in srgb, var(--bubble-sky) 24%, transparent), transparent 34%)',
                'radial-gradient(circle at 62% 78%, color-mix(in srgb, var(--bubble-orchid) 22%, transparent), transparent 36%)',
                'radial-gradient(circle at 28% 72%, color-mix(in srgb, var(--bubble-butter) 20%, transparent), transparent 30%)',
                'radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--bubble-mint) 14%, transparent), transparent 40%)',
              ].join(', '),
            }}
          />

          {selectedPoint && (
            <span
              className="pointer-events-none absolute z-[2] rounded-full"
              aria-hidden
              style={{
                left: selectedPoint.x - selectedPoint.collisionSize / 2,
                top: selectedPoint.y - selectedPoint.collisionSize / 2,
                width: selectedPoint.collisionSize,
                height: selectedPoint.collisionSize,
                background:
                  'radial-gradient(circle, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)',
              }}
            />
          )}

          {selectedPoint && orbit.length > 0 && (
            <svg className="pointer-events-none absolute inset-0 z-[3] h-full w-full" aria-hidden>
              {orbit.map((child, index) => {
                const bend = index % 2 === 0 ? 18 : -18
                const mx = (selectedPoint.x + child.x) / 2 + bend
                const my = (selectedPoint.y + child.y) / 2 - bend
                return (
                  <path
                    key={child.task.id}
                    d={`M ${selectedPoint.x} ${selectedPoint.y} Q ${mx} ${my} ${child.x} ${child.y}`}
                    fill="none"
                    stroke="var(--line)"
                    strokeWidth="2"
                    strokeDasharray={child.task.done ? '3 5' : undefined}
                  />
                )
              })}
            </svg>
          )}

          <AnimatePresence>
            {orbit.map((child) => {
              const color = bubbleColorFor(child.task.id)
              const style = {
                left: child.x - child.size / 2,
                top: child.y - child.size / 2,
                width: child.size,
                height: child.size,
                background: `radial-gradient(circle at 34% 28%, color-mix(in srgb, ${color} 55%, white), ${color})`,
                boxShadow: `0 8px 18px color-mix(in srgb, ${color} 30%, transparent)`,
              } as CSSProperties
              return (
                <motion.button
                  key={child.task.id}
                  type="button"
                  data-bubble
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{
                    opacity: child.task.done ? 0.58 : 1,
                    scale: 1,
                    left: style.left,
                    top: style.top,
                  }}
                  exit={{ opacity: 0, scale: 0.3 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                  onClick={() => child.task.id && void toggleSubtaskDone(child.task.id)}
                  className="absolute z-[12] flex flex-col items-center justify-center rounded-full border border-white/50 px-2.5 text-center text-bubble-ink transition-transform hover:scale-105"
                  style={style}
                  aria-pressed={Boolean(child.task.done)}
                  aria-label={`Step: ${child.task.title}. ${
                    child.task.done ? 'Done' : 'Not done yet'
                  }. Tap to toggle.`}
                >
                  <span
                    className={`mb-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] leading-none ${
                      child.task.done
                        ? 'border-bubble-ink bg-bubble-ink text-white'
                        : 'border-bubble-ink-soft text-transparent'
                    }`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span
                    className={`line-clamp-3 text-[9px] font-bold leading-tight ${
                      child.task.done ? 'text-bubble-ink-soft line-through' : ''
                    }`}
                  >
                    {child.task.title}
                  </span>
                </motion.button>
              )
            })}
          </AnimatePresence>

          {points.map((point) => {
            const id = point.task.id
            const children = id != null ? (childrenByParent.get(id) ?? []) : []
            const doneCount = children.filter((child) => child.done).length
            const selected = id === selectedId
            return (
              <motion.div
                key={id}
                data-bubble
                className={`absolute z-10 ${selected ? 'z-[15]' : ''}`}
                initial={false}
                animate={{
                  left: point.x - point.size / 2,
                  top: point.y - point.size / 2,
                }}
                transition={{ type: 'spring', stiffness: 145, damping: 24, mass: 0.9 }}
              >
                <BubbleCard
                  task={point.task}
                  size={point.size}
                  selected={selected}
                  dimmed={selectedId != null && !selected}
                  childCount={children.length}
                  doneCount={doneCount}
                  onTap={() => select(selectedId === id ? null : (id ?? null))}
                  onLongPress={
                    point.task.status === 'popped' ? undefined : () => void startLockIn(point.task)
                  }
                />
              </motion.div>
            )
          })}
        </div>

        <AnimatePresence>
          {selectedPoint && (
            <motion.div
              key="dock"
              data-map-ui
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="playful-card absolute bottom-4 left-1/2 z-30 flex max-w-[92%] -translate-x-1/2 items-center gap-2.5 rounded-full px-3.5 py-2.5"
            >
              <span
                className="h-7 w-7 shrink-0 rounded-full border border-white/50 soft-shadow"
                style={{ background: bubbleColorFor(selectedPoint.task.id) }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 pr-1">
                <span className="block truncate text-xs font-bold tracking-tight text-ink">
                  {selectedPoint.task.title}
                </span>
                <span className="pixel-label block text-ink-faint">
                  {PRIORITY_LABEL[selectedPoint.task.priority]}
                  {selectedChildren.length > 0 &&
                    ` · ${selectedChildren.filter((child) => child.done).length}/${selectedChildren.length} steps`}
                </span>
              </span>

              {confirmingDelete ? (
                <>
                  <span className="px-1 text-[11px] font-bold text-ink-dim">Let it go?</span>
                  <button
                    type="button"
                    onClick={() => void permanentlyDelete(selectedPoint.task)}
                    className="rounded-full bg-danger px-4 py-1.5 text-[11px] font-bold text-white"
                  >
                    Yes, pop it
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-bold text-ink-dim hover:text-ink"
                  >
                    Keep
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false)
                      setEditing(true)
                    }}
                    className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[11px] font-bold text-ink-dim transition hover:-translate-y-0.5 hover:text-ink"
                  >
                    Edit
                  </button>
                  {selectedPoint.task.status !== 'popped' && (
                    <button
                      type="button"
                      onClick={() => void startLockIn(selectedPoint.task)}
                      className="rounded-full bg-accent px-4 py-1.5 text-[11px] font-bold text-on-accent shadow-sm transition hover:-translate-y-0.5"
                    >
                      Let&apos;s focus
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-bold text-ink-dim hover:text-danger"
                  >
                    Remove
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {editing && selectedPoint?.task.id != null && (
          <div data-map-ui className="absolute inset-0 z-40">
            <BubbleEditPanel
              task={selectedPoint.task}
              steps={selectedChildren}
              onClose={() => {
                setEditing(false)
                void db.tasks.get(selectedPoint.task.id!).then((stillThere) => {
                  if (!stillThere) select(null)
                })
              }}
            />
          </div>
        )}

        {roots.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex items-end gap-3" aria-hidden>
              <span
                className="bubble-idle h-11 w-11 bg-bubble-peach/85"
                style={{ animationDelay: '-1.5s' }}
              />
              <Mascot mood="idle" size={72} />
              <span
                className="bubble-idle h-8 w-8 bg-bubble-orchid/85"
                style={{ animationDelay: '-3.5s' }}
              />
              <span
                className="bubble-idle h-9 w-9 bg-bubble-butter/85"
                style={{ animationDelay: '-2.2s' }}
              />
            </div>
            <p className="type-title text-ink">No bubbles yet — and that&apos;s okay</p>
            <p className="type-caption max-w-xs text-ink-dim">
              Tell your companion what&apos;s on your mind. It&apos;ll float your words over here as
              gentle little bubbles.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
