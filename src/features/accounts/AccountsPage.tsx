import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../../components/AppContext'
import { Empty, Money } from '../../components/ui'
import { db } from '../../db/db'
import { ACCOUNT_TYPES, byId, useAccounts, useBalances, useCategories } from '../../db/hooks'
import type { Account, Category, Transaction } from '../../db/types'
import { formatMonthTR, monthRange } from '../../domain/dates'
import { categoryBreakdown } from '../../domain/reports'
import AccountSheet from './AccountSheet'

export default function AccountsPage() {
  const accounts = useAccounts()
  const balances = useBalances(accounts)
  const { month } = useApp()
  const catById = byId(useCategories())
  const monthTxs = useLiveQuery(() => {
    const [s, e] = monthRange(month)
    return db.transactions.where('date').between(s, e, true, true).toArray()
  }, [month])
  const [adding, setAdding] = useState(false)
  const active = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)
  const total = active.reduce((s, a) => s + (balances[a.id] ?? 0), 0)
  const list = { balances, monthTxs: monthTxs ?? [], catById, monthLabel: formatMonthTR(month) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Hesaplar</h1>
        <button className="btn-ghost" onClick={() => setAdding(true)}>
          + Hesap ekle
        </button>
      </div>

      <div className="card">
        <div className="text-sm text-zinc-500">Toplam</div>
        <Money value={total} className="text-2xl font-bold" />
      </div>

      {active.length === 0 && <Empty>Henüz hesap yok.</Empty>}
      <AccountList items={active} {...list} />

      {archived.length > 0 && (
        <details>
          <summary className="cursor-pointer px-1 text-sm text-zinc-500">Arşivlenmiş ({archived.length})</summary>
          <div className="mt-2 opacity-70">
            <AccountList items={archived} {...list} />
          </div>
        </details>
      )}

      {adding && <AccountSheet onClose={() => setAdding(false)} />}
    </div>
  )
}

function AccountList({
  items,
  balances,
  monthTxs,
  catById,
  monthLabel,
}: {
  items: Account[]
  balances: Record<string, number>
  monthTxs: Transaction[]
  catById: Record<string, Category>
  monthLabel: string
}) {
  const navigate = useNavigate()
  if (!items.length) return null
  return (
    <ul className="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
      {items.map((a) => {
        const spent = categoryBreakdown(
          monthTxs.filter((t) => t.accountId === a.id),
          'expense',
        )
        const sum = spent.reduce((s, c) => s + c.amount, 0)
        const top = spent.slice(0, 2).map((c) => catById[c.categoryId]?.name ?? 'Diğer')
        return (
          <li key={a.id}>
            <button onClick={() => navigate(`/hesaplar/${a.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <span className="text-2xl">{ACCOUNT_TYPES[a.type].icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{a.name}</span>
                <span className="block truncate text-sm text-zinc-500">
                  {sum > 0 ? (
                    <>
                      {monthLabel}: <Money value={sum} sign="expense" /> · {top.join(', ')}
                    </>
                  ) : (
                    ACCOUNT_TYPES[a.type].label
                  )}
                </span>
              </span>
              <Money value={balances[a.id] ?? 0} className="font-semibold" />
              <span className="text-zinc-400" aria-hidden>
                ›
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
