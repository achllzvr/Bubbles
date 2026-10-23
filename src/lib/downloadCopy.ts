/** Map WebLLM/engine progress strings into calm, non-technical copy. */
export function friendlyDownloadMessage(raw: string, progress: number): string {
  const pct = Math.max(0, Math.min(100, Math.round((progress || 0) * 100)))
  const text = (raw || '').toLowerCase()

  if (pct >= 100 || /finish|complete|done|ready/.test(text)) {
    return 'Companion is ready'
  }

  if (pct < 8 || /start|init|creat|open|connect/.test(text)) {
    return 'Getting things ready…'
  }

  if (
    /fetch|download|cache|load.*param|loading model|shard|huggingface|network/.test(text) ||
    pct < 80
  ) {
    return `Downloading your companion… ${pct}%`
  }

  if (/gpu|shader|compile|webgpu|warmup|load.*to.*gpu|instantiate/.test(text) || pct < 98) {
    return 'Almost there — waking your companion…'
  }

  return `Finishing up… ${pct}%`
}

export function friendlyDownloadError(raw: string): string {
  const text = (raw || '').toLowerCase()
  if (!navigator.onLine) {
    return 'You need an internet connection for this one-time download. Connect to Wi‑Fi and try again.'
  }
  if (/webgpu|gpu|adapter/.test(text)) {
    return 'This device or browser can’t run the companion (WebGPU needed). Try Chrome or Edge on a recent device.'
  }
  if (/quota|storage|space/.test(text)) {
    return 'Not enough storage to save the companion. Free up some space and try again.'
  }
  if (/network|fetch|failed to fetch|timeout/.test(text)) {
    return 'Download interrupted. Check your connection and try again.'
  }
  return 'Something went wrong while downloading the companion. Please try again.'
}
