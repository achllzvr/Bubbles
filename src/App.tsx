import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MotionConfig } from 'framer-motion'
import { isLocalModelReady, initLocalModel } from './ai/router'
import { DEFAULT_MODEL_ID, ensureSettings, getSettings } from './db/schema'
import { useSessionStore } from './store/sessionStore'
import { FirstRunGate } from './screens/FirstRunGate'
import { CommandCenter } from './screens/CommandCenter'
import { LockIn } from './screens/LockIn'
import { applyTheme, watchSystemTheme } from './lib/theme'

function PortraitHint() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-surface p-8 text-center landscape:hidden">
      <div className="mb-2 flex items-end gap-3" aria-hidden>
        <span className="bubble-idle h-14 w-14 bg-bubble-peach" />
        <span className="bubble-idle h-9 w-9 bg-bubble-sky" style={{ animationDelay: '-2.5s' }} />
        <span className="bubble-idle h-11 w-11 bg-bubble-orchid" style={{ animationDelay: '-1.2s' }} />
      </div>
      <p className="text-2xl font-bold tracking-tight text-ink">Give your bubbles more room</p>
      <p className="type-body max-w-sm text-ink-dim">
        Turn your device sideways — the map likes a wide, calm sky.
      </p>
    </div>
  )
}

export default function App() {
  const view = useSessionStore((s) => s.view)
  const setView = useSessionStore((s) => s.setView)
  const [booting, setBooting] = useState(true)
  const settings = useLiveQuery(() => getSettings(), [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      const s = await ensureSettings()
      if (cancelled) return
      if (s.modelReady) {
        if (!isLocalModelReady()) {
          try {
            await initLocalModel(s.modelId || DEFAULT_MODEL_ID)
          } catch {
            // cache may be missing — send back to gate
            setView('gate')
            setBooting(false)
            return
          }
        }
        setView('command')
      } else {
        setView('gate')
      }
      setBooting(false)
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [setView])

  useEffect(() => {
    if (settings && !settings.modelReady && view !== 'gate' && view !== 'lockin') {
      setView('gate')
    }
  }, [settings, view, setView])

  useEffect(() => {
    const preference = settings?.theme ?? 'system'
    applyTheme(preference)
    return watchSystemTheme(preference)
  }, [settings?.theme])

  if (booting) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-surface">
        <div className="flex items-end gap-2" aria-hidden>
          {['--bubble-peach', '--bubble-sky', '--bubble-orchid', '--bubble-butter'].map(
            (token, index) => (
              <span
                key={token}
                className="animate-float-soft h-6 w-6 rounded-full"
                style={{
                  background: `var(${token})`,
                  animationDelay: `${index * -0.45}s`,
                }}
              />
            ),
          )}
        </div>
        <p className="pixel-label-lg text-ink-dim">waking up…</p>
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <PortraitHint />
      <div className="hidden h-full w-full landscape:block">
        {view === 'gate' && <FirstRunGate />}
        {view === 'command' && <CommandCenter />}
        {view === 'lockin' && <LockIn />}
      </div>
    </MotionConfig>
  )
}
