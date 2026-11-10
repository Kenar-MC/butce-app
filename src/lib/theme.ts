import { useSyncExternalStore } from 'react'

/** Görünüm: varsayılan karanlık; üstteki ay/güneş düğmesiyle değişir (K17). Seçim bu cihazda saklanır. */
export type Theme = 'dark' | 'light'

const KEY = 'butce-theme'
const listeners = new Set<() => void>()

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

let current: Theme = typeof window !== 'undefined' ? read() : 'dark'

export function applyTheme(t: Theme = current) {
  const root = document.documentElement
  root.classList.toggle('dark', t === 'dark')
  root.style.colorScheme = t
}

export function setTheme(t: Theme) {
  current = t
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* özel mod vb. — sadece bu oturumda geçerli */
  }
  applyTheme(t)
  listeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
