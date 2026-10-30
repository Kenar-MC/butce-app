import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useApp } from '../../components/AppContext'
import { TxList } from '../../components/TxList'
import { Empty, Money, MonthPicker } from '../../components/ui'
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

  const txs = useLiveQuery(() => {
    const [s, e] = monthRange(month)
    return db.transactions
      .where('date')
      .between(s, e, true, true)
      .filter((t) => t.accountId === id || t.toAccountId === id)
      .toArray()
  }, [month, id])

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

      <MonthPicker
        month={month}
        onChange={(m) => {
          setMonth(m)
          setCatFilter(null)
        }}
      />

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
        <TxList txs={shown} accById={accById} catById={catById} onPick={openTx} emptyText="Bu hesapta bu ay işlem yok." />
      )}

      {editing && <AccountSheet acc={acc} onClose={() => setEditing(false)} />}
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
    <section className="card space-y-1">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Money value={total} sign={sign} className="font-semibold" />
      </div>
      {rows.length === 0 && <p className="text-sm text-zinc-500">Bu ay yok.</p>}
      {rows.map((r) => {
        const cat = catById[r.categoryId]
        const pct = total ? Math.round((r.amount / total) * 100) : 0
        return (
          <button
            key={r.categoryId}
            onClick={() => onPick(r.categoryId)}
            aria-pressed={active === r.categoryId}
            className={`block w-full rounded-xl px-2 py-2 text-left ${active === r.categoryId ? 'bg-emerald-50 dark:bg-emerald-950' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
          >
            <span className="flex items-center gap-2">
              <span>{cat?.icon ?? '❔'}</span>
              <span className="flex-1 truncate">{cat?.name ?? 'Kategorisiz'}</span>
              <span className="text-xs text-zinc-500">
                {r.count} işlem · %{pct}
              </span>
              <Money value={r.amount} className="w-28 text-right font-medium" />
            </span>
            <span className="mt-1 block h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: cat?.color ?? '#94a3b8' }} />
            </span>
          </button>
        )
      })}
    </section>
  )
}
