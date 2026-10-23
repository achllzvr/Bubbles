import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import {
  getSettings,
  updateSettings,
  type CloudProvider,
  type ThemePreference,
} from '../db/schema'
import { exportBubblesFile, importBubblesFile } from '../db/transfer'
import { applyTheme } from '../lib/theme'

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useLiveQuery(() => getSettings(), [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [showKey, setShowKey] = useState(false)

  if (!open || !settings) return null

  const hasKey = Boolean(settings.cloudApiKey?.trim())

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-bubble-ink/35 p-6 backdrop-blur-sm">
      <div className="playful-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="bubble-wobble h-9 w-9 shrink-0 bg-bubble-orchid soft-shadow" aria-hidden />
            <div>
              <h2 className="text-xl font-bold text-ink">Your little corner</h2>
              <p className="pixel-label text-ink-faint">settings</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-surface-3 px-5 py-2 text-xs font-bold text-ink-dim transition hover:text-ink"
          >
            Done
          </button>
        </div>

        <section className="playful-panel mb-4">
          <p className="mb-1 text-sm font-bold text-ink">Pick your light</p>
          <p className="mb-3 text-xs text-ink-dim">Soft in the day, cosy at night.</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Color theme">
            {(
              [
                { value: 'system', label: 'Auto', swatch: 'linear-gradient(120deg,#fff9f1,#171522)' },
                { value: 'light', label: 'Light', swatch: '#fff9f1' },
                { value: 'dark', label: 'Dark', swatch: '#171522' },
              ] as { value: ThemePreference; label: string; swatch: string }[]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={settings.theme === option.value}
                onClick={() => {
                  applyTheme(option.value)
                  void updateSettings({ theme: option.value })
                }}
                className={`flex flex-col items-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-bold transition ${
                  settings.theme === option.value
                    ? 'bg-accent text-on-accent shadow-sm'
                    : 'bg-surface text-ink-dim hover:text-ink'
                }`}
              >
                <span
                  className="h-4 w-8 rounded-full border border-white/40"
                  style={{ background: option.swatch }}
                  aria-hidden
                />
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-4 rounded-[1.75rem] border border-accent/30 bg-surface p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">A smarter helper (optional)</p>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                hasKey ? 'bg-accent/20 text-accent' : 'bg-surface-3 text-ink-faint'
              }`}
            >
              {hasKey ? 'Key saved' : 'On-device'}
            </span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-ink-dim">
            Add a key and your companion uses cloud AI while you&apos;re online for tidier sorting.
            Offline, or with no key, it quietly falls back to the on-device model.
          </p>

          <label className="mb-3 block text-sm text-ink-dim">
            Provider
            <select
              value={settings.cloudProvider}
              onChange={(e) =>
                void updateSettings({ cloudProvider: e.target.value as CloudProvider })
              }
            className="mt-1 w-full rounded-2xl border border-line bg-surface-2 px-3 py-2 text-ink outline-none focus:border-accent"
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>

          <label className="mb-2 block text-sm text-ink-dim">
            API key — stays on this device and never leaves in exports
            <div className="mt-1 flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={hasKey ? '•••••••• (saved — paste to replace)' : 'Paste your API key'}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                className="w-full rounded-2xl border border-line bg-surface-2 px-3 py-2 text-ink outline-none focus:border-accent"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="shrink-0 rounded-2xl border border-line px-3 text-xs font-bold text-ink-dim hover:text-ink"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <p className="mb-3 text-[11px] text-ink-faint">
            {settings.cloudProvider === 'gemini' ? (
              <>
                Get a free key at{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline"
                >
                  Google AI Studio
                </a>
                , then paste it here and hit Save.
              </>
            ) : (
              <>
                Create a key at{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline"
                >
                  OpenAI API keys
                </a>
                , paste it here, then Save.
              </>
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-on-accent shadow-sm transition hover:-translate-y-0.5 disabled:opacity-40"
              disabled={!keyDraft.trim()}
              onClick={() => {
                void updateSettings({ cloudApiKey: keyDraft.trim() }).then(() => {
                  setKeyDraft('')
                  setStatus(
                    settings.cloudProvider === 'gemini'
                      ? 'Gemini key saved. New chat messages will use cloud when online.'
                      : 'OpenAI key saved. New chat messages will use cloud when online.',
                  )
                })
              }}
            >
              Save key
            </button>
            <button
              type="button"
              className="rounded-full px-4 py-2 text-sm font-bold text-ink-dim hover:text-ink"
              onClick={() => {
                void updateSettings({ cloudApiKey: '' })
                setKeyDraft('')
                setStatus('Key cleared — your on-device companion takes over.')
              }}
            >
              Clear key
            </button>
          </div>
        </section>

        <section className="mb-4 rounded-[1.75rem] bg-accent-soft p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-ink">Your rhythm</p>
            <span className="flex items-center gap-1.5" aria-hidden>
              {[0, 1, 2, 3].map((slot) => (
                <span
                  key={slot}
                  className={`h-2.5 w-2.5 rounded-[2px] ${
                    slot < (settings.pomodoroCycleCount ?? 0) ? 'bg-accent' : 'bg-surface-3'
                  }`}
                />
              ))}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-ink-dim">
            Every bubble gets one 25 minute pomodoro, then a 5 minute breather. After four of them
            you earn a proper 15 minute rest. Checklist steps stay untimed — just tick them off.
          </p>
          <p className="mt-2 text-xs font-bold text-ink">
            {settings.pomodoroCycleCount ?? 0} of 4 done before your long rest
          </p>
        </section>

        <section className="playful-panel mb-4">
          <p className="mb-2 text-sm font-bold text-ink">Pack up your bubbles</p>
          <p className="mb-3 text-xs leading-relaxed text-ink-dim">
            No accounts, ever. Save a small file and open it on another device or browser. Your API
            key is never included.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-bubble-peach px-5 py-2 text-sm font-bold text-bubble-ink soft-shadow transition hover:-translate-y-0.5"
              onClick={() => {
                void exportBubblesFile()
                  .then(() => setStatus('Saved! That file is your bubbles, ready to travel.'))
                  .catch((e) => setStatus(e instanceof Error ? e.message : String(e)))
              }}
            >
              Save a copy
            </button>
            <button
              type="button"
              className="rounded-full border border-line bg-surface px-5 py-2 text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5"
              onClick={() => fileRef.current?.click()}
            >
              Bring bubbles in
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".gz,.json,.bubbles.gz,application/gzip,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (!confirm('This replaces the bubbles on this device. Go ahead?')) return
                void importBubblesFile(file)
                  .then(() => setStatus('All set — your bubbles are here.'))
                  .catch((err) => setStatus(err instanceof Error ? err.message : String(err)))
                e.target.value = ''
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            Bringing bubbles in replaces what&apos;s on this device.
          </p>
        </section>

        {status && (
          <p className="rounded-2xl bg-surface-3/70 px-4 py-2.5 text-xs text-ink-dim" aria-live="polite">
            {status}
          </p>
        )}
      </div>
    </div>
  )
}
