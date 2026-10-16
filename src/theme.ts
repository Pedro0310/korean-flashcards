import { useSyncExternalStore } from 'react'

// Dark mode is the `dark` class on <html>. The saved choice is applied before
// first paint by the inline script in index.html; with nothing saved, the
// system preference decides.

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'kf:theme'
const listeners = new Set<() => void>()

const getTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this visit.
  }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  return [useSyncExternalStore(subscribe, getTheme), setTheme]
}
