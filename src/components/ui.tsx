import { useEffect, useState, type ReactNode } from 'react'
import { formatMonthTR, shiftMonth } from '../domain/dates'
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

export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const btn = 'grid size-11 place-items-center rounded-full text-xl hover:bg-zinc-200 dark:hover:bg-zinc-800'
  return (
    <div className="flex items-center justify-between">
      <button aria-label="Önceki ay" className={btn} onClick={() => onChange(shiftMonth(month, -1))}>
        ‹
      </button>
      <span className="text-lg font-semibold">{formatMonthTR(month)}</span>
      <button aria-label="Sonraki ay" className={btn} onClick={() => onChange(shiftMonth(month, 1))}>
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

/** Tutar alanı: büyük yazı, sayısal klavye, Türkçe virgül */
export function AmountInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <input
        className="input min-h-16 pr-10 text-3xl font-semibold tabular-nums"
        inputMode="decimal"
        placeholder="0,00"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
      />
      <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-2xl text-zinc-400">₺</span>
    </div>
  )
}
