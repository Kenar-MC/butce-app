import { useSyncExternalStore } from 'react'

/** Karanlık mod (sistem ayarı) — grafik renkleri için */
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function useDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      mq?.addEventListener('change', cb)
      return () => mq?.removeEventListener('change', cb)
    },
    () => mq?.matches ?? false,
  )
}
