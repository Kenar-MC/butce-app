import { useState } from 'react'
import { Link } from 'react-router'
import mascot from '../../assets/mascot.webp'
import { useApp } from '../../components/AppContext'
import MonthChart from '../../components/MonthChart'
import { TxList } from '../../components/TxList'
import { BarRow, Money, MonthStepper, SelectChip } from '../../components/ui'
import { byId, EKSTRE_OKUYUCU_URL, useCards, useCategories, useTransactions } from '../../db/hooks'
import type { Transaction } from '../../db/types'
import { formatMonthTR, shiftMonth } from '../../domain/dates'
import { merchantKey } from '../../domain/merchant'
import { categoryTotals, change, chartMonths, merchantTotals, monthlyTotals } from '../../domain/stats'

const MERCHANT_LIMIT = 8

export default function DashboardPage() {
  const { month, setMonth, cardId, setCardId, openTx } = useApp()
  const cards = useCards()
  const categories = useCategories()
  const catById = byId(categories)
  const cardById = byId(cards)
  const all = useTransactions(cardId)
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [openMerchant, setOpenMerchant] = useState<string | null>(null)
  const [allMerchants, setAllMerchants] = useState(false)

  if (!all) return null
  if (!all.length && !cardId) return <Welcome />

  const dataMonths = [...new Set(all.map((t) => t.month))].sort()
  const cur = all.filter((t) => t.month === month)
  const axis = chartMonths(dataMonths, month, 12)
  const series = monthlyTotals(all, axis)
  const sum = monthlyTotals(cur, [month])[0]
  const prev = monthlyTotals(all, [shiftMonth(month, -1)])[0]
  const delta = change(sum.expense, prev.expense)
  const cats = categoryTotals(cur)
  const merchants = merchantTotals(cur)
  const shownMerchants = allMerchants ? merchants : merchants.slice(0, MERCHANT_LIMIT)
  const multiCard = cards.length > 1
  const list = (txs: Transaction[]) => <TxList txs={txs} catById={catById} cardById={multiCard ? cardById : undefined} onPick={openTx} />

  const pickMonth = (m: string) => {
    setMonth(m)
    setOpenCat(null)
    setOpenMerchant(null)
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

      {multiCard && (
        <div className="flex flex-wrap gap-2">
          <SelectChip
            label="Kart"
            value={cardId}
            onChange={setCardId}
            options={[['', 'Tüm kartlar'], ...cards.map((c): [string, string] => [c.id, c.name])]}
          />
        </div>
      )}

      <MonthStepper month={month} months={dataMonths} onChange={pickMonth} />

      <section className="card space-y-1">
        <div className="text-sm text-zinc-500">{formatMonthTR(month)} harcaması</div>
        <Money value={sum.expense} sign="expense" className="text-3xl font-bold" />
        <p className="flex flex-wrap gap-x-3 text-sm text-zinc-600 dark:text-zinc-400">
          <span>{sum.count} işlem</span>
          {delta !== null && Math.round(delta * 100) !== 0 && (
            <span className={delta > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}>
              {delta > 0 ? '▲' : '▼'} Geçen aya göre %{Math.abs(Math.round(delta * 100))} {delta > 0 ? 'fazla' : 'az'}
            </span>
          )}
          {sum.income > 0 && (
            <span>
              İade / gelen <Money value={sum.income} sign="income" />
            </span>
          )}
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Aylık harcama</h2>
        <MonthChart
          label="Aylara göre toplam harcama"
          data={series.map((m) => ({ month: m.month, value: m.expense, note: `${m.count} işlem` }))}
          selected={month}
          onSelect={pickMonth}
        />
        <p className="text-xs text-zinc-500">Bir aya dokununca o ayın ayrıntısı açılır.</p>
      </section>

      <section className="card space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Kategoriler</h2>
          <Money value={sum.expense} className="text-sm text-zinc-500" />
        </div>
        {cats.length === 0 && <p className="py-4 text-center text-sm text-zinc-500">Bu ay harcama yok.</p>}
        {cats.map((c) => {
          const cat = catById[c.categoryId]
          const pct = Math.round(c.share * 100)
          return (
            <BarRow
              key={c.categoryId}
              icon={cat?.icon ?? '❔'}
              title={cat?.name ?? 'Kategorisiz'}
              sub={`${c.count} işlem · %${pct}`}
              amount={c.amount}
              pct={pct}
              color={cat?.color ?? '#94a3b8'}
              open={openCat === c.categoryId}
              onToggle={() => setOpenCat(openCat === c.categoryId ? null : c.categoryId)}
            >
              {list(cur.filter((t) => t.type === 'expense' && t.categoryId === c.categoryId))}
            </BarRow>
          )
        })}
      </section>

      {merchants.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">En çok harcanan yerler</h2>
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

/** Maskotun ayın durumuna göre lafı */
function quip(count: number, delta: number | null): string {
  if (!count) return 'Bu ay için ekstre yok. Yükle de bakalım 👇'
  if (delta === null) return 'İlk ay. Bakalım gelecek ay ne olacak 👀'
  if (delta > 0.2) return 'Geçen aydan epey fazla harcamışsın. Sana diyorum! 👆'
  if (delta > 0) return 'Geçen aydan biraz fazla. Gözüm üstünde 👀'
  return 'Geçen aydan az harcamışsın. Böyle devam ✨'
}
