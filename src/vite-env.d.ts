/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface WakeLockSentinel extends EventTarget {
  released: boolean
  type: 'screen'
  release(): Promise<void>
}

interface WakeLock {
  request(type: 'screen'): Promise<WakeLockSentinel>
}

interface Navigator {
  wakeLock?: WakeLock
  standalone?: boolean
  vibrate?: (pattern: number | number[]) => boolean
}
