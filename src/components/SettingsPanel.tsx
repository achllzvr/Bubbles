import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  getSettings,
  updateSettings,
  type CloudProvider,
  type ThemePreference,
} from '../db/schema'
import { exportBubblesFile, importBubblesFile } from '../db/transfer'
import { applyTheme } from '../lib/theme'
import { ChunkyButton } from './ui'
import { enterUp, fade, pressTransition } from './ui/motionPresets'

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useLiveQuery(() => getSettings(), [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [showKey, setShowKey] = useState(false)

  const hasKey = Boolean(settings?.cloudApiKey?.trim())

  return (
    <AnimatePresence>
      {open && settings && (
        <motion.div
          key="settings-backdrop"
          variants={fade}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="absolute inset-0 z-50 flex items-center justify-center bg-bubble-ink/35 p-6"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            variants={enterUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            className="playful-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-panel)] p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="bubble-wobble h-9 w-9 shrink-0 border-2 border-ink-stroke bg-bubble-orchid soft-shadow"
                  aria-hidden
                />
                <div>
                  <h2 className="text-xl font-bold text-ink">Your little corner</h2>
                  <p className="chrome-label text-ink-faint">settings</p>
                </div>
              </div>
              <ChunkyButton variant="ghost" size="sm" onClick={onClose}>
                Done
              </ChunkyButton>
            </div>

            <section className="playful-panel mb-4">
              <p className="mb-1 text-sm font-bold text-ink">Pick your light</p>
              <p className="mb-3 text-xs text-ink-dim">Soft in the day, cosy at night.</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Color theme">
                {(
                  [
                    {
                      value: 'system',
                      label: 'Auto',
                      swatch: 'linear-gradient(120deg,#fff9f1,#171522)',
                    },
                    { value: 'light', label: 'Light', swatch: '#fff9f1' },
                    { value: 'dark', label: 'Dark', swatch: '#171522' },
                  ] as { value: ThemePreference; label: string; swatch: string }[]
                ).map((option) => {
                  const selected = settings.theme === option.value
                  return (
                    <motion.button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      layout
                      transition={pressTransition}
                      whileTap={{ y: 3 }}
                      onClick={() => {
                        applyTheme(option.value)
                        void updateSettings({ theme: option.value })
                      }}
                      className={`chrome-label flex flex-col items-center gap-1.5 rounded-[var(--radius-card)] border-2 px-3 py-2.5 ${
                        selected
                          ? 'border-accent-dark bg-accent text-on-accent [box-shadow:var(--shadow-btn-primary)]'
                          : 'border-ink-stroke bg-surface text-ink-dim soft-shadow hover:text-ink'
                      }`}
                    >
                      <span
                        className="h-4 w-8 rounded-full border-2 border-ink-stroke"
                        style={{ background: option.swatch }}
                        aria-hidden
                      />
                      {option.label}
                    </motion.button>
                  )
                })}
              </div>
            </section>

            <section className="mb-4 rounded-[var(--radius-panel)] border-2 border-accent-dark bg-surface p-4 soft-shadow">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">A smarter helper (optional)</p>
                <span
                  className={`chrome-label shrink-0 rounded-full border-2 px-2.5 py-1 ${
                    hasKey
                      ? 'border-accent-dark bg-accent/20 text-accent'
                      : 'border-ink-stroke bg-surface-3 text-ink-faint'
                  }`}
                >
                  {hasKey ? 'Key saved' : 'On-device'}
                </span>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-ink-dim">
                Add a key and your companion uses cloud AI while you&apos;re online for tidier
                sorting. Offline, or with no key, it quietly falls back to the on-device model.
              </p>

              <label className="mb-3 block text-sm text-ink-dim">
                Provider
                <select
                  value={settings.cloudProvider}
                  onChange={(e) =>
                    void updateSettings({ cloudProvider: e.target.value as CloudProvider })
                  }
                  className="chunky-input mt-1"
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
                    placeholder={
                      hasKey ? '•••••••• (saved — paste to replace)' : 'Paste your API key'
                    }
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    className="chunky-input"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <ChunkyButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </ChunkyButton>
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
                <ChunkyButton
                  variant="primary"
                  size="sm"
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
                </ChunkyButton>
                <ChunkyButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void updateSettings({ cloudApiKey: '' })
                    setKeyDraft('')
                    setStatus('Key cleared — your on-device companion takes over.')
                  }}
                >
                  Clear key
                </ChunkyButton>
              </div>
            </section>

            <section className="mb-4 rounded-[var(--radius-panel)] border-2 border-ink-stroke bg-accent-soft p-4 soft-shadow">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-ink">Your rhythm</p>
                <span className="flex items-center gap-1.5" aria-hidden>
                  {[0, 1, 2, 3].map((slot) => (
                    <span
                      key={slot}
                      className={`h-2.5 w-2.5 rounded-[2px] border-2 border-ink-stroke ${
                        slot < (settings.pomodoroCycleCount ?? 0) ? 'bg-accent' : 'bg-surface-3'
                      }`}
                    />
                  ))}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-ink-dim">
                Every bubble gets one 25 minute pomodoro, then a 5 minute breather. After four of
                them you earn a proper 15 minute rest. Checklist steps stay untimed — just tick them
                off.
              </p>
              <p className="mt-2 text-xs font-bold text-ink">
                {settings.pomodoroCycleCount ?? 0} of 4 done before your long rest
              </p>
            </section>

            <section className="playful-panel mb-4">
              <p className="mb-2 text-sm font-bold text-ink">Pack up your bubbles</p>
              <p className="mb-3 text-xs leading-relaxed text-ink-dim">
                No accounts, ever. Save a small file and open it on another device or browser. Your
                API key is never included.
              </p>
              <div className="flex flex-wrap gap-2">
                <ChunkyButton
                  variant="secondary"
                  size="sm"
                  className="!border-bubble-peach !bg-bubble-peach !text-bubble-ink"
                  onClick={() => {
                    void exportBubblesFile()
                      .then(() => setStatus('Saved! That file is your bubbles, ready to travel.'))
                      .catch((e) => setStatus(e instanceof Error ? e.message : String(e)))
                  }}
                >
                  Save a copy
                </ChunkyButton>
                <ChunkyButton
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  Bring bubbles in
                </ChunkyButton>
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
              <p
                className="rounded-[var(--radius-card)] border-2 border-ink-stroke bg-surface-3 px-4 py-2.5 text-xs text-ink-dim soft-shadow"
                aria-live="polite"
              >
                {status}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
