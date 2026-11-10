import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

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

let animTimer = 0

/**
 * Temayı değiştirir; renkler ~0,5 sn'de yumuşakça geçer (hareket azaltma açıksa anında).
 * Destekleyen tarayıcıda (iOS 18+ Safari, Chrome) View Transition: eski ve yeni ekran tek parça çapraz
 * geçer, böylece yazı ve arka plan tam aynı anda değişir. Desteklemeyende CSS geçişi (.theme-anim).
 */
export function setTheme(t: Theme) {
  current = t
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* özel mod vb. — sadece bu oturumda geçerli */
  }
  const commit = () => {
    applyTheme(t)
    listeners.forEach((l) => l())
  }
  const root = document.documentElement
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduce) return commit()
  if ('startViewTransition' in document) {
    document.startViewTransition(() => flushSync(commit))
    return
  }
  root.classList.add('theme-anim')
  void root.offsetWidth // geçiş kuralı renk değişmeden önce uygulansın
  window.clearTimeout(animTimer)
  animTimer = window.setTimeout(() => root.classList.remove('theme-anim'), THEME_ANIM_MS + 100)
  commit()
}

/** index.css'teki .theme-anim süresiyle aynı */
export const THEME_ANIM_MS = 500

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
