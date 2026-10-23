import type { ThemePreference } from '../db/schema'

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function resolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') return media().matches ? 'dark' : 'light'
  return preference
}

export function applyTheme(preference: ThemePreference) {
  const root = document.documentElement
  const resolved = resolvedTheme(preference)
  root.dataset.theme = resolved
  root.dataset.themePreference = preference
  root.style.colorScheme = resolved
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#1a1624' : '#fff8f2')
}

export function watchSystemTheme(preference: ThemePreference) {
  const query = media()
  const update = () => {
    if (preference === 'system') applyTheme('system')
  }
  query.addEventListener('change', update)
  return () => query.removeEventListener('change', update)
}
