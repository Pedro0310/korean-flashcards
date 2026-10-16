import { useSyncExternalStore } from 'react'

// The sidebar's Options and the selected deck, kept in localStorage for now
// (a user_settings table later). Dark mode lives in theme.ts because it has to
// be applied before first paint.

export interface Options {
  hanja: boolean
  romanization: boolean
  wordInfo: boolean
  spanish: boolean
  english: boolean
  tilted: boolean
}

export interface Settings {
  options: Options
  /** null until the user picks one; the first deck is used then. */
  deckId: number | null
}

const STORAGE_KEY = 'kf:settings'

const DEFAULTS: Settings = {
  options: { hanja: true, romanization: true, wordInfo: true, spanish: true, english: true, tilted: true },
  deckId: null,
}

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!saved || typeof saved !== 'object') return DEFAULTS
    // Only keep known keys with the right type, so old or hand-edited data can't break the app.
    const options = { ...DEFAULTS.options }
    for (const key of Object.keys(options) as (keyof Options)[]) {
      if (typeof saved.options?.[key] === 'boolean') options[key] = saved.options[key]
    }
    return { options, deckId: Number.isInteger(saved.deckId) ? saved.deckId : null }
  } catch {
    return DEFAULTS
  }
}

let settings = load()
const listeners = new Set<() => void>()

export function updateSettings(changes: Partial<Settings>) {
  settings = { ...settings, ...changes }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable (private mode); the settings still apply for this visit.
  }
  listeners.forEach((notify) => notify())
}

export const setOption = (key: keyof Options, value: boolean) =>
  updateSettings({ options: { ...settings.options, [key]: value } })

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

export const useSettings = (): Settings => useSyncExternalStore(subscribe, () => settings)
