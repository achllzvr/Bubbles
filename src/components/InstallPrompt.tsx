import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  getDeferredInstallPrompt,
  promptInstall,
  subscribeInstallPrompt,
} from '../lib/installPrompt'
import { ChunkyButton } from './ui'
import { slideUp } from './ui/motionPresets'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isChromium(): boolean {
  return /chrome|edg|chromium/i.test(navigator.userAgent) && !/opr\//i.test(navigator.userAgent)
}

type Mode = 'prompt' | 'howto'

export function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<Mode>('prompt')
  const [hasNativePrompt, setHasNativePrompt] = useState(false)

  useEffect(() => {
    if (isStandalone()) return

    const dismissedAt = Number(localStorage.getItem('bubbles-install-dismissed') || 0)
    if (dismissedAt && Date.now() - dismissedAt < 1000 * 60 * 60 * 24 * 7) return

    const sync = () => setHasNativePrompt(Boolean(getDeferredInstallPrompt()))
    sync()
    const unsub = subscribeInstallPrompt(sync)

    const t = window.setTimeout(() => {
      if (isStandalone()) return
      sync()
      setVisible(true)
      if (isIos()) setMode('howto')
    }, 1800)

    return () => {
      unsub()
      window.clearTimeout(t)
    }
  }, [])

  async function onInstallClick() {
    if (getDeferredInstallPrompt()) {
      const outcome = await promptInstall()
      if (outcome === 'accepted') {
        setVisible(false)
        return
      }
      if (outcome === 'dismissed') return
    }
    // No native prompt available (common in some browsers / until criteria met)
    setMode('howto')
  }

  function dismiss() {
    localStorage.setItem('bubbles-install-dismissed', String(Date.now()))
    setVisible(false)
  }

  const howtoBody = isIos()
    ? 'Tap the Share button, then choose “Add to Home Screen”.'
    : isChromium()
      ? 'Open the browser menu (⋮) and pick “Install Bubbles”, or tap the install icon in the address bar.'
      : 'Look for “Add to Home Screen” or “Install app” in your browser menu.'

  return (
    <AnimatePresence>
      {visible && !isStandalone() && (
        <motion.div
          key="install-prompt"
          variants={slideUp}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="playful-card pointer-events-auto absolute bottom-3 left-1/2 z-40 w-[min(540px,92vw)] -translate-x-1/2 rounded-[var(--radius-panel)] px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <span
                className="bubble-wobble mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border-2 border-ink-stroke bg-bubble-peach text-lg text-bubble-ink soft-shadow"
                aria-hidden
              >
                ✦
              </span>
              <div>
                <p className="text-sm font-bold text-ink">
                  {mode === 'howto' ? 'Keep Bubbles one tap away' : 'Give Bubbles its own home'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-dim">
                  {mode === 'howto'
                    ? howtoBody
                    : 'Add it to your home screen for a full-screen, distraction-free map.'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {mode === 'prompt' && (
                <ChunkyButton
                  variant="primary"
                  size="sm"
                  onClick={() => void onInstallClick()}
                >
                  {hasNativePrompt ? 'Add it' : 'Show me how'}
                </ChunkyButton>
              )}
              <ChunkyButton variant="ghost" size="sm" onClick={dismiss}>
                Maybe later
              </ChunkyButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
