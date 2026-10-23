import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BubbleBoard } from '../components/BubbleBoard'
import { CompanionChat } from '../components/CompanionChat'
import { InstallPrompt } from '../components/InstallPrompt'
import { SettingsPanel } from '../components/SettingsPanel'
import { ChunkyButton, ChunkySurface } from '../components/ui'
import { pressTransition } from '../components/ui/motionPresets'

const CHAT_OPEN_KEY = 'bubbles-chat-open'

export function CommandCenter() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(() => {
    try {
      return localStorage.getItem(CHAT_OPEN_KEY) !== '0'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_OPEN_KEY, chatOpen ? '1' : '0')
    } catch {
      // ignore
    }
  }, [chatOpen])

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-surface">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,color-mix(in_srgb,var(--bubble-peach)_16%,transparent),transparent_32%),radial-gradient(circle_at_12%_78%,color-mix(in_srgb,var(--bubble-sky)_14%,transparent),transparent_30%),radial-gradient(circle_at_58%_42%,color-mix(in_srgb,var(--bubble-orchid)_10%,transparent),transparent_34%),radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--bubble-butter)_12%,transparent),transparent_28%)]" />
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="animate-float-soft relative block h-8 w-11 shrink-0" aria-hidden>
            <span className="bubble-wobble absolute left-0 top-0 h-8 w-8 border-2 border-ink-stroke bg-bubble-sky soft-shadow" />
            <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-ink-stroke bg-bubble-peach soft-shadow" />
            <span className="absolute right-2 top-0 h-3 w-3 rounded-full border-2 border-ink-stroke bg-bubble-butter" />
          </span>
          <div className="min-w-0">
            <h1 className="type-title tracking-tight text-ink">Bubbles</h1>
            <span className="chrome-label block text-ink-faint">one bubble at a time</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ChunkyButton
            variant="secondary"
            size="sm"
            aria-pressed={chatOpen}
            aria-controls="companion-chat-panel"
            onClick={() => setChatOpen((open) => !open)}
          >
            <span aria-hidden>{chatOpen ? '◀' : '▶'}</span>
            {chatOpen ? 'Hide chat' : 'Show chat'}
          </ChunkyButton>
          <ChunkyButton
            variant="secondary"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <span aria-hidden>⚙</span> Settings
          </ChunkyButton>
        </div>
      </header>

      <div className="relative z-[1] flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <aside
          id="companion-chat-panel"
          aria-hidden={!chatOpen}
          className={`h-full overflow-hidden transition-[width,opacity,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            chatOpen
              ? 'mr-0 w-[30%] min-w-[240px] max-w-[380px] opacity-100'
              : 'pointer-events-none mr-0 w-0 min-w-0 max-w-0 opacity-0'
          }`}
        >
          <div className="h-full w-full min-w-[240px]">
            <CompanionChat />
          </div>
        </aside>

        <div className="relative min-w-0 flex-1 overflow-hidden rounded-[var(--radius-panel)]">
          <BubbleBoard />

          <AnimatePresence>
            {!chatOpen && (
              <motion.div
                key="chat-tab"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={pressTransition}
                className="absolute left-4 top-1/2 z-40 -translate-y-1/2"
              >
                <ChunkySurface
                  asButton
                  interactive
                  onClick={() => setChatOpen(true)}
                  className="flex flex-col items-center gap-1 rounded-full px-3 py-4"
                  aria-label="Show companion chat"
                >
                  <span aria-hidden>💬</span>
                  <span className="chrome-label text-ink-dim">Chat</span>
                </ChunkySurface>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <InstallPrompt />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
