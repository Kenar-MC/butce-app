import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useApp } from '../../components/AppContext'
import { TxList } from '../../components/TxList'
import { Empty, Money, MonthPicker, Segmented } from '../../components/ui'
import { db } from '../../db/db'
import { ACCOUNT_TYPES, byId, useAccounts, useBalances, useCategories } from '../../db/hooks'
import type { Category } from '../../db/types'
import { monthRange } from '../../domain/dates'
import { categoryBreakdown, type CategoryTotal } from '../../domain/reports'
import AccountSheet from './AccountSheet'

export default function AccountDetailPage() {
  const { id = '' } = useParams()
  const { month, setMonth, openTx } = useApp()
  const accounts = useAccounts()
  const categories = useCategories()
  const balances = useBalances(accounts)
  const accById = byId(accounts)
  const catById = byId(categories)
  const [editing, setEditing] = useState(false)
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  // İçe aktarmadan gelince tüm zamanlar açık (işlemler farklı aylara düşebilir)
  const [range, setRange] = useState<'month' | 'all'>((location.state as { all?: boolean } | null)?.all ? 'all' : 'month')

  const txs = useLiveQuery(() => {
    if (range === 'all') return db.transactions.where('accountId').equals(id).or('toAccountId').equals(id).toArray()
    const [s, e] = monthRange(month)
    return db.transactions
      .where('date')
      .between(s, e, true, true)
      .filter((t) => t.accountId === id || t.toAccountId === id)
      .toArray()
  }, [month, id, range])

  const acc = accById[id]
  if (!acc) return accounts.length ? <Empty>Hesap bulunamadı.</Empty> : null

  const own = (txs ?? []).filter((t) => t.accountId === id)
  const expenses = categoryBreakdown(own, 'expense')
  const incomes = categoryBreakdown(own, 'income')
  const shown = catFilter === null ? (txs ?? []) : (txs ?? []).filter((t) => (t.categoryId ?? '') === catFilter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/hesaplar" className="-ml-2 flex min-h-11 items-center px-2 text-emerald-700 dark:text-emerald-400">
          ‹ Hesaplar
        </Link>
        <button className="btn-ghost" onClick={() => setEditing(true)}>
          Düzenle
        </button>
      </div>

      <div className="card flex items-center gap-3">
        <span className="text-3xl">{ACCOUNT_TYPES[acc.type].icon}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{acc.name}</h1>
          <div className="text-sm text-zinc-500">
            {ACCOUNT_TYPES[acc.type].label}
            {acc.type === 'credit_card' ? ' · borç' : ' · bakiye'}
          </div>
        </div>
        <Money value={balances[id] ?? 0} className="text-xl font-bold" />
      </div>

      <Segmented
        value={range}
        options={[
          ['month', 'Ay ay'],
          ['all', 'Tüm zamanlar'],
        ]}
        onChange={(r) => {
          setRange(r)
          setCatFilter(null)
        }}
      />
      {range === 'month' && (
        <MonthPicker
          month={month}
          onChange={(m) => {
            setMonth(m)
            setCatFilter(null)
          }}
        />
      )}

      <Breakdown
        title="Harcamalar"
        rows={expenses}
        catById={catById}
        sign="expense"
        active={catFilter}
        onPick={(c) => setCatFilter(catFilter === c ? null : c)}
      />
      {incomes.length > 0 && (
        <Breakdown
          title="Gelirler"
          rows={incomes}
          catById={catById}
          sign="income"
          active={catFilter}
          onPick={(c) => setCatFilter(catFilter === c ? null : c)}
        />
      )}

      <div className="flex items-center justify-between px-1">
        <h2 className="font-semibold">
          İşlemler{catFilter !== null && ` · ${catById[catFilter]?.name ?? 'Kategorisiz'}`}
        </h2>
        {catFilter !== null && (
          <button className="text-sm text-emerald-700 dark:text-emerald-400" onClick={() => setCatFilter(null)}>
            Tümünü göster
          </button>
        )}
      </div>
      {txs && (
        <TxList txs={shown} accById={accById} catById={catById} onPick={openTx} emptyText={range === 'all' ? 'Bu hesapta işlem yok.' : 'Bu hesapta bu ay işlem yok.'} />
      )}

      {editing && <AccountSheet acc={acc} onClose={() => setEditing(false)} onDeleted={() => navigate('/hesaplar')} />}
    </div>
  )
}

function Breakdown({
  title,
  rows,
  catById,
  sign,
  active,
  onPick,
}: {
  title: string
  rows: CategoryTotal[]
  catById: Record<string, Category>
  sign: 'expense' | 'income'
  active: string | null
  onPick: (categoryId: string) => void
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return (
    <section className="card space-y-2">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Money value={total} sign={sign} className="font-semibold" />
      </div>
      {rows.length === 0 && <p className="text-sm text-zinc-500">Yok.</p>}
      {rows.map((r) => {
        const cat = catById[r.categoryId]
        const pct = total ? Math.round((r.amount / total) * 100) : 0
        return (
          <button
            key={r.categoryId}
            onClick={() => onPick(r.categoryId)}
            aria-pressed={active === r.categoryId}
            className={`relative block min-h-12 w-full overflow-hidden rounded-xl bg-zinc-50 text-left dark:bg-zinc-800/60 ${active === r.categoryId ? 'ring-2 ring-emerald-500' : ''}`}
          >
            {/* Çubuk satırın tamamı: dolu kısım kategorinin payı, yazı üstünde */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-xl"
              style={{ width: `${Math.max(pct, 2)}%`, background: `${cat?.color ?? '#94a3b8'}40` }}
            />
            <span className="relative flex items-center gap-2 px-3 py-2.5">
              <span className="text-lg">{cat?.icon ?? '❔'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{cat?.name ?? 'Kategorisiz'}</span>
                <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                  {r.count} işlem · %{pct}
                </span>
              </span>
              <Money value={r.amount} className="font-semibold" />
            </span>
          </button>
        )
      })}
    </section>
  )
}
