import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  addSubtask,
  bubbleColorFor,
  deleteTaskPermanently,
  removeSubtask,
  renameTask,
  type Task,
} from '../db/schema'

export function BubbleEditPanel({
  task,
  steps,
  onClose,
}: {
  task: Task
  steps: Task[]
  onClose: () => void
}) {
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [stepDrafts, setStepDrafts] = useState<Record<number, string>>({})
  const [newStep, setNewStep] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    setTitleDraft(task.title)
  }, [task.id, task.title])

  useEffect(() => {
    const next: Record<number, string> = {}
    for (const child of steps) {
      if (child.id != null) next[child.id] = child.title
    }
    setStepDrafts(next)
  }, [steps])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function saveTitle() {
    if (!task.id || busy) return
    const next = titleDraft.trim()
    if (!next || next === task.title) return
    setBusy(true)
    try {
      await renameTask(task.id, next)
      setStatus('Title updated')
    } finally {
      setBusy(false)
    }
  }

  async function saveStep(childId: number) {
    if (busy) return
    const next = (stepDrafts[childId] ?? '').trim()
    const current = steps.find((c) => c.id === childId)?.title
    if (!next || next === current) return
    setBusy(true)
    try {
      await renameTask(childId, next)
      setStatus('Step renamed')
    } finally {
      setBusy(false)
    }
  }

  async function onAddStep(event?: FormEvent) {
    event?.preventDefault()
    if (!task.id || busy) return
    const next = newStep.trim()
    if (!next) return
    setBusy(true)
    try {
      await addSubtask(task.id, next)
      setNewStep('')
      setStatus('Step added')
    } finally {
      setBusy(false)
    }
  }

  async function onRemoveStep(childId: number, title: string) {
    if (busy) return
    if (!confirm(`Remove step “${title}”?`)) return
    setBusy(true)
    try {
      await removeSubtask(childId)
      setStatus('Step removed')
    } finally {
      setBusy(false)
    }
  }

  async function onDeleteBubble() {
    if (!task.id || busy) return
    if (
      !confirm(
        `Remove “${task.title}” forever?\n\nIts smaller steps will be removed too.`,
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await deleteTaskPermanently(task.id)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  function onTitleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void saveTitle()
    }
  }

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center bg-bubble-ink/25 p-4 backdrop-blur-[2px] sm:items-center"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${task.title}`}
        className="playful-card flex max-h-[min(88vh,560px)] w-full max-w-md flex-col overflow-hidden rounded-[1.75rem]"
      >
        <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
          <span
            className="mt-0.5 h-8 w-8 shrink-0 rounded-full border border-white/50 soft-shadow"
            style={{ background: bubbleColorFor(task.id) }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="pixel-label text-ink-faint">edit bubble</p>
            <p className="type-caption text-ink-dim">Rename it, add steps, or tidy the list</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-surface-3 px-3 py-1.5 text-xs font-bold text-ink-dim hover:text-ink"
          >
            Done
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <label className="block">
            <span className="type-caption mb-1.5 block text-ink-dim">Bubble title</span>
            <div className="flex gap-2">
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={onTitleKey}
                disabled={busy}
                className="type-body min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-ink outline-none focus:border-accent"
                aria-label="Bubble title"
              />
              <button
                type="button"
                disabled={busy || !titleDraft.trim() || titleDraft.trim() === task.title}
                onClick={() => void saveTitle()}
                className="rounded-2xl bg-accent px-3.5 py-2 text-xs font-bold text-on-accent disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </label>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="type-caption text-ink-dim">Steps · {steps.length}</p>
            </div>

            <ul className="space-y-2">
              {steps.map((child) => {
                if (child.id == null) return null
                const draft = stepDrafts[child.id] ?? child.title
                const dirty = draft.trim() !== child.title
                return (
                  <li
                    key={child.id}
                    className="flex items-center gap-2 rounded-[1.2rem] border border-line bg-surface px-2.5 py-2 soft-shadow"
                  >
                    <input
                      value={draft}
                      onChange={(event) =>
                        setStepDrafts((current) => ({
                          ...current,
                          [child.id!]: event.target.value,
                        }))
                      }
                      onBlur={() => void saveStep(child.id!)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void saveStep(child.id!)
                        }
                      }}
                      disabled={busy}
                      className="type-body min-w-0 flex-1 rounded-xl border-0 bg-transparent px-1.5 py-1 text-ink outline-none focus:ring-0"
                      aria-label={`Rename step ${child.title}`}
                    />
                    <button
                      type="button"
                      disabled={busy || !dirty || !draft.trim()}
                      onClick={() => void saveStep(child.id!)}
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold text-accent disabled:opacity-30"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onRemoveStep(child.id!, child.title)}
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold text-danger hover:bg-danger/10"
                      aria-label={`Remove step ${child.title}`}
                    >
                      Remove
                    </button>
                  </li>
                )
              })}
              {steps.length === 0 && (
                <p className="rounded-[1.2rem] bg-surface-3/70 px-3 py-3 type-caption text-ink-faint">
                  No steps yet. Add a tiny next action below.
                </p>
              )}
            </ul>

            <form onSubmit={(event) => void onAddStep(event)} className="mt-3 flex gap-2">
              <input
                value={newStep}
                onChange={(event) => setNewStep(event.target.value)}
                placeholder="New step…"
                disabled={busy}
                className="type-body min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-ink outline-none placeholder:text-ink-faint focus:border-accent"
                aria-label="New step title"
              />
              <button
                type="submit"
                disabled={busy || !newStep.trim()}
                className="rounded-2xl bg-bubble-mint px-3.5 py-2 text-xs font-bold text-bubble-ink disabled:opacity-40"
              >
                Add
              </button>
            </form>
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDeleteBubble()}
            className="rounded-full px-3 py-2 text-xs font-bold text-danger hover:bg-danger/10"
          >
            Remove bubble
          </button>
          {status && (
            <p className="type-caption text-ink-dim" aria-live="polite">
              {status}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
