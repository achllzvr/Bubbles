type InstallListener = () => void

export interface InstallPromptEvent {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<InstallListener>()
let listening = false

export function getDeferredInstallPrompt() {
  return deferred
}

export function subscribeInstallPrompt(listener: InstallListener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function armInstallPromptCapture() {
  if (listening || typeof window === 'undefined') return
  listening = true

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as unknown as InstallPromptEvent
    listeners.forEach((l) => l())
  })

  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  const event = deferred
  await event.prompt()
  const { outcome } = await event.userChoice
  deferred = null
  listeners.forEach((l) => l())
  return outcome
}
