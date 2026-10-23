import { useEffect, useState } from 'react'
import {
  getDeferredInstallPrompt,
  promptInstall,
  subscribeInstallPrompt,
} from '../lib/installPrompt'

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

  if (!visible || isStandalone()) return null

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
    <div className="playful-card pointer-events-auto absolute bottom-3 left-1/2 z-40 w-[min(540px,92vw)] -translate-x-1/2 rounded-[1.7rem] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span
            className="bubble-wobble mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center bg-bubble-peach text-lg text-bubble-ink soft-shadow"
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
            <button
              type="button"
              onClick={() => void onInstallClick()}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-on-accent shadow-sm transition hover:-translate-y-0.5"
            >
              {hasNativePrompt ? 'Add it' : 'Show me how'}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full px-3 text-xs font-bold text-ink-faint hover:text-ink-dim"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
