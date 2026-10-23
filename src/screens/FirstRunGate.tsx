import { useEffect, useMemo, useState } from 'react'
import { initLocalModel } from '../ai/router'
import { DEFAULT_MODEL_ID, ensureSettings, getSettings, updateSettings } from '../db/schema'
import { friendlyDownloadError, friendlyDownloadMessage } from '../lib/downloadCopy'
import { useSessionStore } from '../store/sessionStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { Mascot } from '../components/Mascot'

export function FirstRunGate() {
  const setView = useSessionStore((s) => s.setView)
  const setDownload = useSessionStore((s) => s.setDownload)
  const downloadProgress = useSessionStore((s) => s.downloadProgress)
  const downloadText = useSessionStore((s) => s.downloadText)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const settings = useLiveQuery(() => getSettings(), [])

  useEffect(() => {
    void ensureSettings()
  }, [])

  useEffect(() => {
    if (settings?.modelReady) {
      setView('command')
    }
  }, [settings?.modelReady, setView])

  async function startDownload() {
    setStarting(true)
    setError(null)
    setDownload(0, 'Getting things ready…')
    try {
      await initLocalModel(settings?.modelId ?? DEFAULT_MODEL_ID, (text, progress) => {
        setDownload(progress, friendlyDownloadMessage(text, progress))
      })
      setDownload(1, 'Companion is ready')
      await updateSettings({ modelReady: true })
      setView('command')
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      setError(friendlyDownloadError(raw))
      setStarting(false)
    }
  }

  const pct = useMemo(() => Math.round((downloadProgress || 0) * 100), [downloadProgress])

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-surface px-8">
      <span className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-bubble-peach/22 blur-3xl" />
      <span className="absolute -bottom-28 right-10 h-80 w-80 rounded-full bg-bubble-orchid/20 blur-3xl" />
      <span className="absolute right-1/4 top-8 h-40 w-40 rounded-full bg-bubble-sky/16 blur-3xl" />
      <div className="playful-card relative flex max-h-[92vh] max-w-3xl items-center gap-7 overflow-y-auto rounded-[2.5rem] p-8">
        <Mascot mood={starting ? 'thinking' : 'idle'} size={96} />
        <div className="flex flex-col items-start gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-ink">Meet Bubbles</h1>
            <span className="pixel-label rounded-full bg-accent-soft px-3 py-1.5 text-ink-dim">
              offline friend
            </span>
          </div>
          <p className="type-body max-w-xl text-lg text-ink-dim">
            One quiet download and your companion lives on this device. After that you can sort your
            thoughts anywhere — even in Airplane Mode, with no account and no clutter.
          </p>
          <p className="type-caption text-ink-faint">
            About 1GB · best on Wi‑Fi · only needed once on this device
          </p>

          {starting ? (
            <div className="w-full max-w-md space-y-3">
              <div className="flex gap-1" aria-hidden>
                {Array.from({ length: 20 }, (_, index) => (
                  <span
                    key={index}
                    className={`h-3 flex-1 rounded-[3px] transition-colors duration-300 ${
                      index < Math.max(1, Math.round(pct / 5)) ? 'bg-accent' : 'bg-surface-3'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm font-bold text-ink" aria-live="polite">
                {downloadText || 'Getting things ready…'}
              </p>
              {pct > 0 && pct < 100 && (
                <p className="text-xs text-ink-faint">
                  {pct}% there — you can leave this tab open and come back
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void startDownload()}
              className="rounded-full bg-accent px-6 py-3 font-bold text-on-accent shadow-lg transition hover:-translate-y-0.5"
            >
              Bring my companion in
            </button>
          )}

          {error && (
            <p className="max-w-xl rounded-2xl bg-danger/12 px-4 py-3 text-sm leading-relaxed text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
