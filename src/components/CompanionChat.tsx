import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { routeAi } from '../ai/router'
import { createTaskTree, db, getSettings, PASTEL_RAINBOW } from '../db/schema'
import { useSessionStore } from '../store/sessionStore'
import { Mascot } from './Mascot'

export function CompanionChat() {
  const messages = useLiveQuery(() => db.chatMessages.orderBy('createdAt').toArray(), []) ?? []
  const settings = useLiveQuery(() => getSettings(), [])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const lastAiSource = useSessionStore((s) => s.lastAiSource)
  const setLastAiSource = useSessionStore((s) => s.setLastAiSource)
  const feedEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, busy])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy || !settings) return

    setBusy(true)
    setInput('')
    await db.chatMessages.add({
      role: 'user',
      content: text,
      createdAt: Date.now(),
    })

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    try {
      const result = await routeAi(
        { message: text, history },
        {
          cloudProvider: settings.cloudProvider,
          cloudApiKey: settings.cloudApiKey,
          preferCloud: true,
        },
      )

      setLastAiSource(result.source)
      const linked: number[] = []
      for (const task of result.tasks) {
        const ids = await createTaskTree(
          task.title,
          task.priority,
          task.subtasks,
          task.estimatedMinutes,
        )
        linked.push(...ids)
      }

      await db.chatMessages.add({
        role: 'assistant',
        content: result.reply,
        createdAt: Date.now(),
        linkedTaskIds: linked,
        source: result.source,
      })
    } catch (err) {
      await db.chatMessages.add({
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Something went wrong.',
        createdAt: Date.now(),
        source: 'heuristic',
      })
    } finally {
      setBusy(false)
    }
  }

  const sourceLabel = settings?.cloudApiKey?.trim()
    ? lastAiSource === 'cloud'
      ? 'Cloud'
      : lastAiSource === 'local'
        ? 'On-device'
        : lastAiSource === 'heuristic'
          ? 'Simple mode'
          : 'Cloud ready'
    : lastAiSource === 'heuristic'
      ? 'Simple mode'
      : 'On-device'

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] bg-surface-2/72 soft-shadow">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Mascot mood={busy ? 'thinking' : 'idle'} size={44} showLabel={false} />
        <div className="min-w-0">
          <p className="type-title truncate text-ink">{settings?.companionName ?? 'Bubble'}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-[10px] font-bold text-ink-dim">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                lastAiSource === 'heuristic' ? 'bg-bubble-butter' : 'bg-bubble-orchid'
              }`}
              aria-hidden
            />
            {sourceLabel}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-3" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="rounded-[1.6rem] bg-accent-soft p-4 soft-shadow">
            <p className="type-title mb-1.5 text-ink">What&apos;s floating around?</p>
            <p className="type-body text-ink-dim">
              Drop it all here — messy is fine. I&apos;ll gently sort your own words into bubbles,
              and I won&apos;t invent extra chores for you.
            </p>
          </div>
        )}
        {messages.map((m, index) => {
          const pastel = PASTEL_RAINBOW[(m.id ?? index) % PASTEL_RAINBOW.length]
          return (
            <div
              key={m.id}
              className={`type-body w-fit max-w-[93%] rounded-[1.4rem] px-3.5 py-2.5 text-bubble-ink soft-shadow ${
                m.role === 'user' ? 'ml-auto rounded-br-lg' : 'mr-auto rounded-bl-lg'
              }`}
              style={{
                // Pastel fills stay light in both themes — always use bubble ink, not theme ink.
                background:
                  m.role === 'user'
                    ? `color-mix(in srgb, ${pastel} 42%, white)`
                    : `color-mix(in srgb, ${pastel} 28%, white)`,
              }}
            >
              {m.content}
            </div>
          )
        })}
        {busy && (
          <div
            className="mr-auto flex w-fit items-center gap-1.5 rounded-[1.4rem] rounded-bl-lg px-4 py-3.5 soft-shadow"
            style={{ background: 'color-mix(in srgb, var(--bubble-orchid) 30%, white)' }}
          >
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="typing-dot h-1.5 w-1.5 rounded-full bg-bubble-ink"
                style={{ animationDelay: `${dot * 0.16}s` }}
                aria-hidden
              />
            ))}
            <span className="sr-only">Sorting your words</span>
          </div>
        )}
        <div ref={feedEndRef} />
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="flex items-center gap-2.5 p-3.5 pt-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say it however it comes out…"
          aria-label="Tell your companion what is on your mind"
          disabled={busy}
          className="type-body min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-3 text-ink soft-shadow outline-none placeholder:text-ink-faint focus:border-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-on-accent soft-shadow transition hover:-translate-y-0.5 disabled:opacity-35"
          aria-label="Send to your companion"
        >
          <span aria-hidden>➜</span>
        </button>
      </form>
    </div>
  )
}
