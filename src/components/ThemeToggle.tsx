import { setTheme, useTheme } from '../lib/theme'

/** Sağ üstteki küçük ay/güneş düğmesi */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useTheme()
  const dark = theme === 'dark'
  const label = dark ? 'Açık moda geç' : 'Karanlık moda geç'
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={`grid size-11 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 ${className}`}
    >
      {dark ? (
        // Güneş
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Ay
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}
