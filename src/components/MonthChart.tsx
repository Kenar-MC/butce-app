import { useSyncExternalStore } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMonthTR } from '../domain/dates'
import { formatTRY } from '../domain/money'

/** Karanlık mod (sistem ayarı) — grafik renkleri için */
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
function useDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      mq?.addEventListener('change', cb)
      return () => mq?.removeEventListener('change', cb)
    },
    () => mq?.matches ?? false,
  )
}

/** Tek seri sütunlar: seçili ay vurgulu, diğerleri aynı rengin açık tonu */
/** Çizim alanının kenar boşlukları: sol = Y ekseni genişliği */
const PLOT = { left: 44, right: 4 }

const BLUE = { light: { on: '#2a78d6', off: '#86b6ef' }, dark: { on: '#3987e5', off: '#184f95' } }

const shortMonth = new Intl.DateTimeFormat('tr-TR', { month: 'short' })
const compact = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 })
/** '2026-10' → 'Eki' (ocakta yıl da: 'Oca 27') */
function tick(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const s = shortMonth.format(new Date(y, mo - 1, 1))
  return mo === 1 ? `${s} ${String(y).slice(2)}` : s
}
/** kuruş → '12,5 B' */
const compactTRY = (kurus: number) => compact.format(kurus / 100)

export interface MonthPoint {
  month: string
  value: number
  /** İpucunda gösterilecek ek bilgi (ör. "12 işlem") */
  note?: string
}

/**
 * Aylık sütun grafiği. Bir sütuna (ya da o ayın hizasına) dokununca `onSelect`.
 * `color` verilirse (kategori rengi) seçili/diğer ayrımı opaklıkla yapılır.
 */
export default function MonthChart({
  data,
  selected,
  onSelect,
  color,
  height = 180,
  label,
}: {
  data: MonthPoint[]
  selected?: string
  onSelect?: (month: string) => void
  color?: string
  height?: number
  /** Ekran okuyucu için grafiğin adı */
  label: string
}) {
  const dark = useDark()
  const tone = dark ? BLUE.dark : BLUE.light
  const grid = dark ? '#27272a' : '#e4e4e7'
  const ink = dark ? '#a1a1aa' : '#52525b'
  const selIndex = data.findIndex((d) => d.month === selected)

  return (
    <div
      role="img"
      aria-label={label}
      style={{ height, cursor: onSelect ? 'pointer' : undefined }}
      className="-mx-1 select-none"
      onClick={(e) => {
        // Dokunulan ayın sütun bandını konumdan bul (dokunmatikte Recharts'ın etkin sütunu güvenilir değil)
        if (!onSelect || !data.length) return
        const r = e.currentTarget.getBoundingClientRect()
        const left = PLOT.left
        const width = r.width - PLOT.left - PLOT.right
        const i = Math.floor(((e.clientX - r.left - left) / width) * data.length)
        if (i >= 0 && i < data.length) onSelect(data[i].month)
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 18, right: PLOT.right, bottom: 0, left: 0 }}
          barCategoryGap="22%"
        >
          <CartesianGrid vertical={false} stroke={grid} strokeWidth={1} />
          <XAxis dataKey="month" tickFormatter={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: ink, fontSize: 12 }} />
          <YAxis
            tickFormatter={compactTRY}
            tickLine={false}
            axisLine={false}
            width={PLOT.left}
            tickCount={4}
            tick={{ fill: ink, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: dark ? '#ffffff10' : '#00000008' }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as MonthPoint | undefined
              if (!active || !p) return null
              return (
                <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="font-medium">{formatMonthTR(p.month)}</div>
                  <div className="tabular-nums">{formatTRY(p.value)}</div>
                  {p.note && <div className="text-xs text-zinc-500">{p.note}</div>}
                </div>
              )
            }}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          >
            {data.map((d) => {
              const on = selected === undefined || d.month === selected
              return <Cell key={d.month} fill={color ?? (on ? tone.on : tone.off)} fillOpacity={color && !on ? 0.4 : 1} />
            })}
            <LabelList
              dataKey="value"
              content={(p) => {
                if (p.index !== selIndex || selIndex < 0 || !data[selIndex].value) return null
                const x = Number(p.x) + Number(p.width) / 2
                return (
                  <text x={x} y={Number(p.y) - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill={dark ? '#fafafa' : '#18181b'}>
                    {compactTRY(data[selIndex].value)}
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
