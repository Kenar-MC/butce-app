import { useState } from 'react'
import { useApp } from '../../components/AppContext'
import MonthChart from '../../components/MonthChart'
import { Empty, Money, Segmented, SelectChip } from '../../components/ui'
import { byId, useCards, useCategories, useTransactions } from '../../db/hooks'
import { formatMonthTR } from '../../domain/dates'
import { formatTRY } from '../../domain/money'
import { categoryTotals, categoryTrend, change, chartMonths, monthlyTotals } from '../../domain/stats'

type Span = '6' | '12'

export default function TrendPage() {
  const { cardId, setCardId } = useApp()
  const cards = useCards()
  const catById = byId(useCategories())
  const all = useTransactions(cardId)
  const [span, setSpan] = useState<Span>('6')
  const [open, setOpen] = useState<string | null>(null)

  if (!all) return null
  const dataMonths = [...new Set(all.map((t) => t.month))].sort()
  const last = dataMonths[dataMonths.length - 1]

  const head = (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">Trend</h1>
        <p className="text-sm text-zinc-500">Kategorilerin aylara göre değişimi. Bir kategoriye dokununca grafiği açılır.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {cards.length > 1 && (
          <SelectChip
            label="Kart"
            value={cardId}
            onChange={setCardId}
            options={[['', 'Tüm kartlar'], ...cards.map((c): [string, string] => [c.id, c.name])]}
          />
        )}
        <div className="w-44">
          <Segmented value={span} options={[['6', 'Son 6 ay'], ['12', 'Son 12 ay']]} onChange={setSpan} />
        </div>
      </div>
    </div>
  )
  if (!last) return <div className="space-y-4">{head}<Empty>Henüz ekstre yok — sağ alttaki düğmeyle yükle.</Empty></div>

  const months = chartMonths(dataMonths, last, Number(span))
  const inWindow = all.filter((t) => months.includes(t.month))
  const totals = monthlyTotals(inWindow, months)
  const total = totals.reduce((s, m) => s + m.expense, 0)
  const cats = categoryTotals(inWindow)
  const trend = categoryTrend(inWindow, months, cats.map((c) => c.categoryId))

  return (
    <div className="space-y-4">
      {head}

      <section className="card grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-zinc-500">{months.length} ayda toplam</div>
          <Money value={total} sign="expense" className="text-lg font-bold" />
        </div>
        <div>
          <div className="text-xs text-zinc-500">Aylık ortalama</div>
          <Money value={Math.round(total / months.length)} sign="expense" className="text-lg font-bold" />
        </div>
        <p className="col-span-2 text-xs text-zinc-500">
          {formatMonthTR(months[0])} – {formatMonthTR(months[months.length - 1])}
        </p>
      </section>

      <ul className="space-y-2">
        {cats.map((c) => {
          const cat = catById[c.categoryId]
          const values = trend.map((r) => r.values[c.categoryId])
          const lastValue = values[values.length - 1]
          const before = values.slice(0, -1)
          const avgBefore = before.length ? before.reduce((s, v) => s + v, 0) / before.length : 0
          const delta = change(lastValue, avgBefore)
          const max = Math.max(...values, 1)
          const color = cat?.color ?? '#94a3b8'
          const isOpen = open === c.categoryId
          return (
            <li key={c.categoryId} className="card p-0">
              <button className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.categoryId)}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full text-lg" style={{ background: `${color}22` }}>
                  {cat?.icon ?? '❔'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{cat?.name ?? 'Kategorisiz'}</span>
                  <span className="block text-xs text-zinc-500">
                    Ort. {formatTRY(Math.round(c.amount / months.length))}/ay
                    {delta !== null && Math.round(delta * 100) === 0 && ' · aynı'}
                    {delta !== null && Math.round(delta * 100) !== 0 && (
                      <span className={delta > 0 ? ' text-rose-700 dark:text-rose-400' : ' text-emerald-700 dark:text-emerald-400'}>
                        {' '}
                        · {delta > 0 ? '▲' : '▼'} %{Math.abs(Math.round(delta * 100))}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex h-9 items-end gap-0.5" aria-hidden>
                  {values.map((v, i) => (
                    <span
                      key={months[i]}
                      className="w-1.5 rounded-t-sm"
                      style={{ height: `${Math.max((v / max) * 100, v ? 8 : 3)}%`, background: color, opacity: i === values.length - 1 ? 1 : 0.4 }}
                    />
                  ))}
                </span>
                <span className="w-20 shrink-0 text-right">
                  <Money value={lastValue} className="block text-sm font-semibold" />
                  <span className="block text-[11px] text-zinc-500">son ay</span>
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-zinc-100 px-3 pt-2 pb-3 dark:border-zinc-800">
                  <MonthChart
                    label={`${cat?.name ?? 'Kategori'} harcaması aylara göre`}
                    data={months.map((m, i) => ({ month: m, value: values[i] }))}
                    selected={months[months.length - 1]}
                    color={color}
                    height={160}
                  />
                  <p className="text-xs text-zinc-500">
                    Son ay ({formatMonthTR(months[months.length - 1])}) önceki ayların ortalamasıyla karşılaştırılır.
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
