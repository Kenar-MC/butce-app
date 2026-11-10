import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import mascot from '../../assets/mascot.webp'
import { useApp } from '../../components/AppContext'
import MonthChart from '../../components/MonthChart'
import ShareBar, { RankList } from '../../components/ShareBar'
import { AvgSwatch, Money, Segmented, SelectChip } from '../../components/ui'
import { db } from '../../db/db'
import { byId, EKSTRE_OKUYUCU_URL, kindIcon, useCards, useCategories, useTransactions } from '../../db/hooks'
import { cardLabel } from '../../domain/cards'
import { daysBetween, formatDateTR, formatMonthTR, shiftMonth, todayISO } from '../../domain/dates'
import { formatTRY } from '../../domain/money'
import { categoryTotals, change, chartMonths, merchantTotals, monthlyTotals, periodMonths, periodSummary, topShares } from '../../domain/stats'

type Span = '1' | '3' | '6' | '12'
const SPANS: [Span, string][] = [
  ['1', 'Bu ay'],
  ['3', '3 ay'],
  ['6', '6 ay'],
  ['12', '12 ay'],
]

/** Genel bakış: seçilen dönemin toplamı, dağılımı, aylık seyri, en çok harcanan yerler ve yaklaşan ödemeler */
export default function DashboardPage() {
  const { setMonth, cardId, setCardId } = useApp()
  const navigate = useNavigate()
  const cards = useCards()
  const catById = byId(useCategories())
  const cardById = byId(cards)
  const all = useTransactions(cardId)
  const statements = useLiveQuery(() => db.statements.toArray())
  const [span, setSpan] = useState<Span>('3')

  if (!all) return null
  if (!all.length && !cardId) return <Welcome />

  const dataMonths = [...new Set(all.map((t) => t.month))].sort()
  const last = dataMonths[dataMonths.length - 1] ?? todayISO().slice(0, 7)
  const n = Number(span)
  const months = periodMonths(last, n, dataMonths[0])
  const prevMonths = periodMonths(shiftMonth(months[0], -1), months.length)
  const inPeriod = all.filter((t) => months.includes(t.month))
  const sum = periodSummary(all, months)
  const prev = periodSummary(all, prevMonths)
  const delta = prev.count ? change(sum.total, prev.total) : null
  const year = periodSummary(all, periodMonths(last, 12, dataMonths[0]))
  const shares = topShares(categoryTotals(inPeriod), 5)
  const merchants = merchantTotals(inPeriod).slice(0, 5)
  const axis = chartMonths(dataMonths, last, 12)
  const series = monthlyTotals(all, axis)
  const periodLabel = n === 1 ? formatMonthTR(last) : `${formatMonthTR(months[0])} – ${formatMonthTR(last)}`

  const today = todayISO()
  const dues = (statements ?? [])
    .filter((s) => s.dueDate && s.dueDate >= today && (!cardId || s.cardId === cardId))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 4)

  const perCard = cards
    .map((c) => ({ c, amount: inPeriod.filter((t) => t.cardId === c.id && t.type === 'expense').reduce((s, t) => s + t.amount, 0) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  const openMonth = (m: string, state?: object) => {
    setMonth(m)
    navigate('/trend', { state })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <img src={mascot} alt="Bütçe maskotu" className="size-14 shrink-0 rounded-2xl shadow-md ring-2 ring-emerald-800/20" />
        <div className="min-w-0 flex-1">
          <div className="text-xl font-extrabold tracking-tight text-emerald-800 dark:text-emerald-300">Bütçe</div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{quip(sum.count, delta)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <Segmented value={span} options={SPANS} onChange={setSpan} />
        </div>
        {cards.length > 1 && (
          <SelectChip
            label="Kart"
            value={cardId}
            onChange={setCardId}
            options={[['', 'Tüm kartlar'], ...cards.map((c): [string, string] => [c.id, cardLabel(c)])]}
          />
        )}
      </div>

      {/* Ana rakam ve kutucuklar */}
      <section className="card space-y-3">
        <div>
          <div className="text-sm text-zinc-500">{periodLabel} · toplam harcama</div>
          <Money value={sum.total} sign="expense" className="text-4xl font-bold tracking-tight" />
          {delta !== null && Math.round(delta * 100) !== 0 && (
            <p className={`mt-0.5 text-sm ${delta > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {delta > 0 ? '▲' : '▼'} Önceki {n === 1 ? 'aya' : `${months.length} aya`} göre %{Math.abs(Math.round(delta * 100))} {delta > 0 ? 'fazla' : 'az'}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {n === 1 ? (
            <Tile label="12 ay ortalaması" value={formatTRY(year.average)} />
          ) : (
            <Tile label="Aylık ortalama" value={formatTRY(sum.average)} />
          )}
          <Tile label="İşlem" value={String(sum.count)} />
          {n === 1 ? (
            <Tile label="Geçen ay" value={formatTRY(prev.total)} />
          ) : (
            <Tile label="En yüksek ay" value={sum.peak ? formatTRY(sum.peak.amount) : '—'} sub={sum.peak && formatMonthTR(sum.peak.month)} />
          )}
          <Tile
            label="En büyük harcama"
            value={sum.biggest ? formatTRY(sum.biggest.amount) : '—'}
            sub={sum.biggest && `${sum.biggest.merchant} · ${formatDateTR(sum.biggest.date)}`}
          />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Harcama dağılımı</h2>
        <ShareBar segments={shares} catById={catById} onPick={(key) => openMonth(last, { open: key })} />
      </section>

      <section className="card space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Aylık harcama</h2>
          <span className="text-xs text-zinc-500">
            <AvgSwatch /> ort. {formatTRY(monthlyAverage(series))}
          </span>
        </div>
        <MonthChart
          label="Aylara göre toplam harcama"
          data={series.map((m) => ({ month: m.month, value: m.expense, note: `${m.count} işlem` }))}
          average={monthlyAverage(series)}
          onSelect={(m) => openMonth(m)}
        />
        <p className="text-xs text-zinc-500">Bir aya dokununca Trend'de o ayın ayrıntısı açılır.</p>
      </section>

      {merchants.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">En çok harcanan yerler</h2>
          <RankList
            rows={merchants.map((m) => {
              const cat = catById[inPeriod.find((t) => t.type === 'expense' && t.merchant === m.name)?.categoryId ?? '']
              return { key: m.key, icon: cat?.icon ?? '🏪', name: m.name, sub: `${m.count} işlem`, amount: m.amount }
            })}
          />
        </section>
      )}

      {perCard.length > 1 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Kartlara göre</h2>
          <RankList rows={perCard.map(({ c, amount }) => ({ key: c.id, icon: kindIcon(c.kind), name: c.name, sub: c.last4 ? `•• ${c.last4}` : undefined, amount }))} onPick={setCardId} />
        </section>
      )}

      {dues.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Yaklaşan son ödemeler</h2>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {dues.map((s) => {
              const days = daysBetween(today, s.dueDate!)
              return (
                <li key={s.id}>
                  <Link to={`/ekstreler/${s.id}`} className="flex min-h-12 items-center gap-3 py-2">
                    <span className="text-xl">{kindIcon(cardById[s.cardId]?.kind)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{cardById[s.cardId]?.name ?? 'Silinmiş kart'}</span>
                      <span className={`block text-xs ${days <= 3 ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-zinc-500'}`}>
                        {cardById[s.cardId]?.last4 && `•• ${cardById[s.cardId]!.last4} · `}
                        {formatDateTR(s.dueDate!)} · {days === 0 ? 'bugün' : `${days} gün kaldı`}
                      </span>
                    </span>
                    {s.statementBalance !== undefined && <Money value={s.statementBalance} className="font-semibold" />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function monthlyAverage(series: { expense: number }[]): number {
  const withData = series.filter((m) => m.expense > 0)
  return withData.length ? Math.round(withData.reduce((s, m) => s + m.expense, 0) / withData.length) : 0
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/60">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="truncate text-lg font-semibold">{value}</div>
      {sub && <div className="truncate text-xs text-zinc-500">{sub}</div>}
    </div>
  )
}

function Welcome() {
  return (
    <div className="space-y-4 pt-4 text-center">
      <img src={mascot} alt="Bütçe maskotu" className="mx-auto size-24 rounded-3xl shadow-md ring-2 ring-emerald-800/20" />
      <div>
        <h1 className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-300">Bütçe</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Ekstreni okut, nereye ne kadar harcadığını ay ay gör.</p>
      </div>
      <ol className="card space-y-2 text-left text-sm">
        <li>
          1. Kart ekstresinin fotoğrafını ya da PDF'ini{' '}
          <a className="font-medium text-emerald-700 underline dark:text-emerald-400" href={EKSTRE_OKUYUCU_URL} target="_blank" rel="noreferrer">
            Ekstre Okuyucu
          </a>
          'da okut, "Bütçe dosyasını indir"e dokun.
        </li>
        <li>2. İndirdiğin dosyayı buraya yükle; harcamalar kategorilere ayrılmış gelir.</li>
      </ol>
      <Link to="/ice-aktar" className="btn-primary w-full">
        İlk ekstreni yükle
      </Link>
    </div>
  )
}

/** Maskotun döneme göre lafı */
function quip(count: number, delta: number | null): string {
  if (!count) return 'Bu dönemde ekstre yok. Yükle de bakalım 👇'
  if (delta === null) return 'İlk veriler geldi. Bakalım gelecek ay ne olacak 👀'
  if (delta > 0.2) return 'Öncekinden epey fazla harcamışsın. Sana diyorum! 👆'
  if (delta > 0) return 'Öncekinden biraz fazla. Gözüm üstünde 👀'
  return 'Öncekinden az harcamışsın. Böyle devam ✨'
}
