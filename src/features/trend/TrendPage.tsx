import { useState } from 'react'
import { useLocation } from 'react-router'
import { useApp } from '../../components/AppContext'
import MonthChart from '../../components/MonthChart'
import { TxList } from '../../components/TxList'
import { AvgSwatch, BarRow, Empty, Money, MonthStepper, SelectChip } from '../../components/ui'
import { byId, useCards, useCategories, useTransactions } from '../../db/hooks'
import { cardLabel } from '../../domain/cards'
import { formatMonthTR, shiftMonth } from '../../domain/dates'
import { formatTRY } from '../../domain/money'
import { merchantKey } from '../../domain/merchant'
import { categoryTotals, categoryTrend, change, chartMonths, merchantTotals, monthlyTotals } from '../../domain/stats'

const MERCHANT_LIMIT = 8

/**
 * Aylık + trend tek ekranda: üstte ay seçici; seçili ayın toplamı ve son 12 ayın grafiği;
 * altta bütün kategoriler (seçili ay tutarı, ortalamaya göre değişim, aylık küçük sütunlar).
 */
export default function TrendPage() {
  const { month, setMonth, cardId, setCardId, openTx } = useApp()
  const location = useLocation()
  const cards = useCards()
  const catById = byId(useCategories())
  const cardById = byId(cards)
  const all = useTransactions(cardId)
  const [open, setOpen] = useState<string | null>((location.state as { open?: string } | null)?.open ?? null)
  const [openMerchant, setOpenMerchant] = useState<string | null>(null)
  const [allMerchants, setAllMerchants] = useState(false)

  if (!all) return null
  const dataMonths = [...new Set(all.map((t) => t.month))].sort()

  const head = (
    <div>
      <h1 className="text-xl font-bold">Trend</h1>
      <p className="text-sm text-zinc-500">Ay seç; bütün kategoriler o ay ve önceki aylarla birlikte görünür.</p>
    </div>
  )
  if (!dataMonths.length) return <div className="space-y-4">{head}<Empty>Henüz ekstre yok — sağ alttaki düğmeyle yükle.</Empty></div>

  const sel = dataMonths.includes(month) ? month : dataMonths[dataMonths.length - 1]
  const axis = chartMonths(dataMonths, sel, 12)
  const inAxis = all.filter((t) => axis.includes(t.month))
  const series = monthlyTotals(all, axis)
  const cur = all.filter((t) => t.month === sel)
  const sum = monthlyTotals(cur, [sel])[0]
  const prev = monthlyTotals(all, [shiftMonth(sel, -1)])[0]
  const delta = prev.expense ? change(sum.expense, prev.expense) : null
  const withData = series.filter((m) => m.expense > 0)
  const avg = withData.length ? Math.round(withData.reduce((s, m) => s + m.expense, 0) / withData.length) : 0
  const vsAvg = change(sum.expense, avg)
  const selIndex = axis.indexOf(sel)

  // Bütün kategoriler: seçili ayın tutarına göre, sonra 12 ayın toplamına göre
  const windowCats = categoryTotals(inAxis)
  const trend = categoryTrend(inAxis, axis, windowCats.map((c) => c.categoryId))
  const rows = windowCats
    .map((c) => {
      const values = trend.map((r) => r.values[c.categoryId])
      const active = values.filter((v) => v > 0)
      const others = values.filter((_, i) => i !== selIndex && values[i] > 0)
      const average = others.length ? others.reduce((s, v) => s + v, 0) / others.length : 0
      return { ...c, values, now: values[selIndex], average: active.length ? c.amount / active.length : 0, delta: change(values[selIndex], average) }
    })
    .sort((a, b) => b.now - a.now || b.amount - a.amount)
  const merchants = merchantTotals(cur)
  const shownMerchants = allMerchants ? merchants : merchants.slice(0, MERCHANT_LIMIT)
  const multiCard = cards.length > 1
  const list = (txs: typeof cur) => <TxList txs={txs} catById={catById} cardById={multiCard ? cardById : undefined} onPick={openTx} />

  const pick = (m: string) => {
    setMonth(m)
    setOpenMerchant(null)
  }

  return (
    <div className="space-y-4">
      {head}

      {/* Ay seçici: kaydırınca da üstte kalır */}
      <div className="sticky top-0 z-[5] -mx-4 space-y-2 bg-zinc-50 px-4 pt-[env(safe-area-inset-top)] pb-2 backdrop-blur dark:bg-zinc-950/95">
        <MonthStepper month={sel} months={dataMonths} onChange={pick} />
        {multiCard && (
          <SelectChip
            label="Kart"
            value={cardId}
            onChange={setCardId}
            options={[['', 'Tüm kartlar'], ...cards.map((c): [string, string] => [c.id, cardLabel(c)])]}
          />
        )}
      </div>

      <section className="card space-y-2">
        <div className="text-sm text-zinc-500">{formatMonthTR(sel)} harcaması</div>
        <Money value={sum.expense} sign="expense" className="text-3xl font-bold" />
        <p className="flex flex-wrap gap-x-3 text-sm text-zinc-600 dark:text-zinc-400">
          <span>{sum.count} işlem</span>
          {delta !== null && Math.round(delta * 100) !== 0 && (
            <span className={delta > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}>
              {delta > 0 ? '▲' : '▼'} geçen aya göre %{Math.abs(Math.round(delta * 100))}
            </span>
          )}
          {vsAvg !== null && Math.round(vsAvg * 100) !== 0 && (
            <span>
              <AvgSwatch /> ortalamanın %{Math.abs(Math.round(vsAvg * 100))} {vsAvg > 0 ? 'üstünde' : 'altında'}
            </span>
          )}
          {sum.income > 0 && (
            <span>
              İade / gelen <Money value={sum.income} sign="income" />
            </span>
          )}
        </p>
        <MonthChart
          label="Aylara göre toplam harcama"
          data={series.map((m) => ({ month: m.month, value: m.expense, note: `${m.count} işlem` }))}
          selected={sel}
          onSelect={pick}
          average={avg}
        />
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-semibold">Kategoriler</h2>
          <span className="text-xs text-zinc-500">{formatMonthTR(sel)} · ortalamaya göre</span>
        </div>
        <ul className="space-y-2">
          {rows.map((c) => {
            const cat = catById[c.categoryId]
            const max = Math.max(...c.values, 1)
            const color = cat?.color ?? '#94a3b8'
            const isOpen = open === c.categoryId
            const pct = c.delta === null ? null : Math.round(c.delta * 100)
            return (
              <li key={c.categoryId} className="card p-0">
                <button className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.categoryId)}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full text-lg" style={{ background: `${color}22` }}>
                    {cat?.icon ?? '❔'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{cat?.name ?? 'Kategorisiz'}</span>
                    <span className="block text-xs text-zinc-500">
                      Ort. {formatTRY(Math.round(c.average))}/ay
                      {c.now === 0 && ' · bu ay yok'}
                      {pct !== null && pct !== 0 && c.now > 0 && (
                        <span className={pct > 0 ? ' text-rose-700 dark:text-rose-400' : ' text-emerald-700 dark:text-emerald-400'}>
                          {' '}
                          · {pct > 0 ? '▲' : '▼'} %{Math.abs(pct)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex h-9 items-end gap-0.5" aria-hidden>
                    {c.values.map((v, i) => (
                      <span
                        key={axis[i]}
                        className="w-1.5 rounded-t-sm"
                        style={{ height: `${Math.max((v / max) * 100, v ? 8 : 3)}%`, background: color, opacity: i === selIndex ? 1 : 0.35 }}
                      />
                    ))}
                  </span>
                  <span className="w-20 shrink-0 text-right">
                    <Money value={c.now} className="block text-sm font-semibold" />
                    <span className="block text-[11px] text-zinc-500">{formatMonthTR(sel).split(' ')[0]}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="space-y-2 border-t border-zinc-100 px-3 pt-2 pb-3 dark:border-zinc-800">
                    <MonthChart
                      label={`${cat?.name ?? 'Kategori'} harcaması aylara göre`}
                      data={axis.map((m, i) => ({ month: m, value: c.values[i] }))}
                      selected={sel}
                      onSelect={pick}
                      color={color}
                      height={150}
                    />
                    {list(cur.filter((t) => t.type === 'expense' && t.categoryId === c.categoryId))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {merchants.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">En çok harcanan yerler · {formatMonthTR(sel).split(' ')[0]}</h2>
          {shownMerchants.map((m) => {
            const txs = cur.filter((t) => t.type === 'expense' && merchantKey(t.merchant) === m.key)
            const cat = catById[txs[0]?.categoryId ?? '']
            return (
              <BarRow
                key={m.key}
                icon={cat?.icon ?? '🏪'}
                title={m.name}
                sub={`${m.count} işlem`}
                amount={m.amount}
                pct={Math.round((m.amount / merchants[0].amount) * 100)}
                color="#2a78d6"
                open={openMerchant === m.key}
                onToggle={() => setOpenMerchant(openMerchant === m.key ? null : m.key)}
              >
                {list(txs)}
              </BarRow>
            )
          })}
          {merchants.length > MERCHANT_LIMIT && (
            <button className="btn-ghost w-full" onClick={() => setAllMerchants(!allMerchants)}>
              {allMerchants ? 'Daha az göster' : `Tümünü göster (${merchants.length})`}
            </button>
          )}
        </section>
      )}
    </div>
  )
}
