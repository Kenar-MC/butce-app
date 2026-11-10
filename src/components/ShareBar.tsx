import type { Category } from '../db/types'
import type { ShareSegment } from '../domain/stats'
import { useDark } from '../lib/useDark'
import { Money } from './ui'

/**
 * Bir bütünün parçaları (pasta grafiği yerine): tek renk tonları, büyükten küçüğe koyudan açığa,
 * "Diğer" gri. Renk sırayı/büyüklüğü taşır, kimliği değil; adlar altta aynı sırayla yazar.
 * Tonlar dataviz doğrulayıcısından geçti (ordinal, açık + koyu).
 */
const RAMP = {
  light: ['#104281', '#1c5cab', '#2a78d6', '#5598e7', '#86b6ef'],
  dark: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#1c5cab'],
}
const OTHER = { light: '#d4d4d8', dark: '#52525b' }
/** Blok üstündeki yazı: koyu blokta beyaz, açıkta neredeyse siyah */
const INK_ON = { light: [true, true, true, false, false], dark: [false, false, false, true, true] }

export default function ShareBar({
  segments,
  catById,
  onPick,
}: {
  segments: ShareSegment[]
  catById: Record<string, Category>
  onPick?: (key: string) => void
}) {
  const dark = useDark()
  const mode = dark ? 'dark' : 'light'
  const colorOf = (i: number, key: string) => (key === 'other' ? OTHER[mode] : RAMP[mode][Math.min(i, 4)])
  const whiteOn = (i: number, key: string) => (key === 'other' ? dark : INK_ON[mode][Math.min(i, 4)])
  const nameOf = (key: string) => (key === 'other' ? 'Diğer kategoriler' : (catById[key]?.name ?? 'Kategorisiz'))
  const iconOf = (key: string) => (key === 'other' ? '•••' : (catById[key]?.icon ?? '❔'))

  if (!segments.length) return <p className="py-4 text-center text-sm text-zinc-500">Bu dönemde harcama yok.</p>

  return (
    <div className="space-y-3">
      <div
        className="flex h-7 w-full gap-0.5 overflow-hidden"
        role="img"
        aria-label={segments.map((s) => `${nameOf(s.key)} %${Math.round(s.share * 100)}`).join(', ')}
      >
        {segments.map((s, i) => {
          const pct = Math.round(s.share * 100)
          return (
            <div
              key={s.key}
              title={`${nameOf(s.key)}: %${pct}`}
              className="flex h-full min-w-0 items-center rounded px-1.5 text-xs font-semibold"
              style={{ width: `${s.share * 100}%`, background: colorOf(i, s.key), color: whiteOn(i, s.key) ? '#fff' : '#18181b' }}
            >
              {s.share >= 0.1 && <span className="truncate">%{pct}</span>}
            </div>
          )
        })}
      </div>
      <ul className="space-y-1">
        {segments.map((s, i) => (
          <li key={s.key}>
            <button
              className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-1 text-left hover:bg-zinc-50 disabled:hover:bg-transparent dark:hover:bg-zinc-800/60"
              onClick={() => onPick?.(s.key)}
              disabled={!onPick || s.key === 'other'}
            >
              <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: colorOf(i, s.key) }} />
              <span className="w-6 shrink-0 text-center">{iconOf(s.key)}</span>
              <span className="min-w-0 flex-1 truncate">{nameOf(s.key)}</span>
              <span className="text-xs text-zinc-500">%{Math.round(s.share * 100)}</span>
              <Money value={s.amount} className="w-24 shrink-0 text-right font-semibold" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Sıralı liste: ad, tutar ve tek renk ince çubuk (en büyüğe göre) */
export function RankList({
  rows,
  onPick,
}: {
  rows: { key: string; icon?: string; name: string; sub?: string; amount: number }[]
  onPick?: (key: string) => void
}) {
  const max = Math.max(...rows.map((r) => r.amount), 1)
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.key}>
          <button
            className="block w-full rounded-xl px-1 py-1.5 text-left hover:bg-zinc-50 disabled:hover:bg-transparent dark:hover:bg-zinc-800/60"
            onClick={() => onPick?.(r.key)}
            disabled={!onPick}
          >
            <span className="flex items-center gap-2.5">
              {r.icon !== undefined && <span className="w-6 shrink-0 text-center">{r.icon}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                {r.sub && <span className="block text-xs text-zinc-500">{r.sub}</span>}
              </span>
              <Money value={r.amount} className="shrink-0 font-semibold" />
            </span>
            <span className="mt-1.5 block h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
              <span className="block h-2 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${Math.max((r.amount / max) * 100, 2)}%` }} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
