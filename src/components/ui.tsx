import { useEffect, useState, type ReactNode } from 'react'
import { formatMonthTR } from '../domain/dates'
import { formatTRY } from '../domain/money'

/** Mobilde alttan açılan panel, geniş ekranda ortada pencere */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:max-w-lg md:rounded-3xl dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button aria-label="Kapat" onClick={onClose} className="grid size-11 place-items-center rounded-full text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Ay seçici: oklar sadece verisi olan aylar arasında gezer */
export function MonthStepper({ month, months, onChange }: { month: string; months: string[]; onChange: (m: string) => void }) {
  const prev = months.filter((m) => m < month).pop()
  const next = months.find((m) => m > month)
  const btn = 'grid size-11 place-items-center rounded-full text-xl hover:bg-zinc-200 disabled:opacity-25 dark:hover:bg-zinc-800'
  return (
    <div className="flex items-center justify-between">
      <button aria-label="Önceki ay" className={btn} disabled={!prev} onClick={() => prev && onChange(prev)}>
        ‹
      </button>
      <span className="text-lg font-semibold">{formatMonthTR(month)}</span>
      <button aria-label="Sonraki ay" className={btn} disabled={!next} onClick={() => next && onChange(next)}>
        ›
      </button>
    </div>
  )
}

/** Tutar gösterimi; sign: işaretli göster (+/−) ve renklendir */
export function Money({ value, sign, className = '' }: { value: number; sign?: 'income' | 'expense'; className?: string }) {
  if (sign) {
    const cls = sign === 'income' ? 'amount-income' : 'amount-expense'
    return <span className={`${cls} tabular-nums ${className}`}>{sign === 'income' ? '+' : '−'}{formatTRY(Math.abs(value))}</span>
  }
  return <span className={`tabular-nums ${value < 0 ? 'amount-expense' : ''} ${className}`}>{formatTRY(value)}</span>
}

/** İki dokunuşlu silme: önce "Sil", sonra "Emin misin?" */
export function ConfirmButton({ label = 'Sil', onConfirm }: { label?: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button type="button" className="btn-danger" onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? 'Emin misin? Dokun' : label}
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-zinc-500">{children}</p>
}

/**
 * Yazı kadar genişleyen filtre düğmesi. iOS'ta <select> en uzun seçenek kadar genişlediği için
 * görünür kısım bir etiket; dokununca üstündeki görünmez yerel <select> açılır.
 */
export function SelectChip({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: [string, string][]
  onChange: (v: string) => void
}) {
  const current = options.find(([v]) => v === value)?.[1] ?? options[0]?.[1] ?? ''
  const active = value !== ''
  return (
    <label
      className={`relative inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium ${active ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-200' : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`}
    >
      <span className="whitespace-nowrap">{current}</span>
      <span aria-hidden className="text-xs opacity-60">
        ▾
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Yüzdesi kadar dolu, tam yükseklikte satır (kategori / işyeri). Dokununca açılır;
 * açıkken `children` (ör. o satırın işlemleri) hemen altında görünür.
 */
export function BarRow({
  icon,
  title,
  sub,
  amount,
  pct,
  color,
  open,
  onToggle,
  children,
}: {
  icon?: ReactNode
  title: string
  sub: string
  amount: number
  /** 0–100 */
  pct: number
  color: string
  open: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`relative block min-h-12 w-full overflow-hidden rounded-xl bg-zinc-50 text-left dark:bg-zinc-800/60 ${open ? 'ring-2 ring-emerald-500' : ''}`}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 rounded-xl" style={{ width: `${Math.max(pct, 2)}%`, background: `${color}40` }} />
        <span className="relative flex items-center gap-2 px-3 py-2.5">
          {icon !== undefined && <span className="w-6 shrink-0 text-center text-lg">{icon}</span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{title}</span>
            <span className="block text-xs text-zinc-600 dark:text-zinc-400">{sub}</span>
          </span>
          <Money value={amount} className="font-semibold" />
          <span aria-hidden className={`text-zinc-400 transition-transform ${open ? 'rotate-90' : ''}`}>
            ›
          </span>
        </span>
      </button>
      {open && <div className="pt-1 pb-2">{children}</div>}
    </div>
  )
}

/** Grafikteki kesikli ortalama çizgisinin metin içi işareti */
export function AvgSwatch() {
  return <span aria-hidden className="mr-1 inline-block w-3.5 border-t-2 border-dashed border-zinc-400 align-middle" />
}
