import { setTheme, useTheme } from '../lib/theme'

const Sun = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
)
const Moon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)

/** Sağ üstteki kaydırmalı ay/güneş anahtarı: düğme sağa kayınca karanlık, sola kayınca açık */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const dark = useTheme() === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Karanlık mod"
      title={dark ? 'Açık moda geç' : 'Karanlık moda geç'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={`theme-toggle group grid h-11 w-14 place-items-center ${className}`}
    >
      <span className="relative block h-7 w-14 rounded-full border border-zinc-300 bg-zinc-200 shadow-inner transition-colors duration-500 dark:border-zinc-700 dark:bg-zinc-800">
        {/* Raydaki soluk simgeler */}
        <Sun className="absolute top-1/2 left-[7px] -translate-y-1/2 text-amber-500/60" />
        <Moon className="absolute top-1/2 right-[7px] -translate-y-1/2 text-zinc-500" />
        {/* Kayan düğme */}
        <span
          className={`absolute top-1/2 left-0.5 grid size-6 -translate-y-1/2 place-items-center rounded-full shadow-md transition-[translate,background-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] group-active:scale-95 ${
            dark ? 'translate-x-7 bg-zinc-950 text-sky-200' : 'translate-x-0 bg-white text-amber-500'
          }`}
        >
          <Sun className={`absolute transition-opacity duration-300 ${dark ? 'opacity-0' : 'opacity-100'}`} />
          <Moon className={`absolute transition-opacity duration-300 ${dark ? 'opacity-100' : 'opacity-0'}`} />
        </span>
      </span>
    </button>
  )
}
